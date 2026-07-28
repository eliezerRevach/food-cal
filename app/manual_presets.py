"""Server-persisted manual food presets (Save to List)."""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app import db

MAX_PRESETS = 100


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _preset_signature(name: str, grams: float, protein: float, calories: float) -> str:
    n = name.strip().lower()
    return f"{n}|{grams}|{protein}|{calories}"


def _row_to_dict(row: Any) -> dict[str, Any]:
    saved = str(row["saved_at"] or "")
    # Expose epoch ms for frontend sort/compat with prior localStorage shape.
    try:
        if saved.endswith("Z"):
            dt = datetime.fromisoformat(saved.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(saved)
        saved_at_ms = int(dt.timestamp() * 1000)
    except ValueError:
        saved_at_ms = 0
    return {
        "id": str(row["id"]),
        "name": str(row["name"]),
        "grams": float(row["grams"]),
        "protein": float(row["protein"]),
        "calories": float(row["calories"]),
        "savedAt": saved_at_ms,
    }


def _validate_macros(name: str, grams: float, protein: float, calories: float) -> str:
    name_lbl = name.strip()
    if not name_lbl:
        raise HTTPException(status_code=400, detail="name is required")
    if len(name_lbl) > 120:
        raise HTTPException(status_code=400, detail="name must be at most 120 characters")
    if not math.isfinite(grams) or grams <= 0:
        raise HTTPException(status_code=400, detail="grams must be a positive finite number")
    if not math.isfinite(calories) or calories < 0:
        raise HTTPException(status_code=400, detail="calories must be a non-negative finite number")
    if not math.isfinite(protein) or protein < 0:
        raise HTTPException(status_code=400, detail="protein must be a non-negative finite number")
    return name_lbl


def list_manual_presets(
    *,
    q: str = "",
    limit: int = MAX_PRESETS,
    required_words: list[str] | None = None,
) -> list[dict[str, Any]]:
    if limit < 1:
        return []
    limit = min(limit, MAX_PRESETS)
    conn = db.get_connection()
    rows = conn.execute(
        """
        SELECT id, name, grams, protein, calories, saved_at
        FROM manual_presets
        ORDER BY saved_at DESC, id DESC
        """
    ).fetchall()
    needle = q.strip().lower()
    reqs = [w.strip().lower() for w in (required_words or []) if w.strip()]
    out: list[dict[str, Any]] = []
    for r in rows:
        name_l = str(r["name"]).lower()
        if reqs and not all(rw in name_l for rw in reqs):
            continue
        if needle and needle not in name_l:
            continue
        out.append(_row_to_dict(r))
        if len(out) >= limit:
            break
    return out


def save_manual_preset(
    name: str,
    grams: float,
    protein: float,
    calories: float,
) -> dict[str, Any]:
    name_lbl = _validate_macros(name, grams, protein, calories)
    grams_r = float(grams)
    protein_r = float(protein)
    calories_r = float(calories)
    sig = _preset_signature(name_lbl, grams_r, protein_r, calories_r)
    now = _utc_now_iso()

    with db.transaction() as conn:
        rows = conn.execute(
            "SELECT id, name, grams, protein, calories, saved_at FROM manual_presets"
        ).fetchall()
        existing_id: str | None = None
        for r in rows:
            if (
                _preset_signature(
                    str(r["name"]),
                    float(r["grams"]),
                    float(r["protein"]),
                    float(r["calories"]),
                )
                == sig
            ):
                existing_id = str(r["id"])
                break

        if existing_id is not None:
            conn.execute(
                """
                UPDATE manual_presets
                SET name = ?, grams = ?, protein = ?, calories = ?, saved_at = ?
                WHERE id = ?
                """,
                (name_lbl, grams_r, protein_r, calories_r, now, existing_id),
            )
            updated = True
            pid = existing_id
        else:
            pid = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO manual_presets (id, name, grams, protein, calories, saved_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (pid, name_lbl, grams_r, protein_r, calories_r, now),
            )
            updated = False
            # Cap: drop oldest beyond MAX_PRESETS
            overflow = conn.execute(
                """
                SELECT id FROM manual_presets
                ORDER BY saved_at DESC, id DESC
                LIMIT -1 OFFSET ?
                """,
                (MAX_PRESETS,),
            ).fetchall()
            for o in overflow:
                conn.execute("DELETE FROM manual_presets WHERE id = ?", (str(o["id"]),))

        row = conn.execute(
            "SELECT id, name, grams, protein, calories, saved_at FROM manual_presets WHERE id = ?",
            (pid,),
        ).fetchone()

    assert row is not None
    out = _row_to_dict(row)
    out["updated"] = updated
    return out


def delete_manual_preset(preset_id: str) -> bool:
    pid = (preset_id or "").strip()
    if not pid:
        return False
    with db.transaction() as conn:
        cur = conn.execute("DELETE FROM manual_presets WHERE id = ?", (pid,))
        return cur.rowcount > 0


def export_manual_presets_for_backup() -> list[dict[str, Any]]:
    conn = db.get_connection()
    rows = conn.execute(
        """
        SELECT name, grams, protein, calories, saved_at
        FROM manual_presets
        ORDER BY saved_at ASC, id ASC
        """
    ).fetchall()
    return [
        {
            "name": str(r["name"]),
            "grams": float(r["grams"]),
            "protein": float(r["protein"]),
            "calories": float(r["calories"]),
            "saved_at": str(r["saved_at"]) if r["saved_at"] is not None else None,
        }
        for r in rows
    ]


def import_manual_presets_from_backup(presets: list[dict[str, Any]]) -> int:
    """Upsert presets from backup; returns count of rows written/updated."""
    written = 0
    for p in presets:
        if not isinstance(p, dict):
            continue
        name = str(p.get("name", "")).strip()
        try:
            grams = float(p.get("grams", 0))
            protein = float(p.get("protein", 0))
            calories = float(p.get("calories", 0))
        except (TypeError, ValueError):
            continue
        if not name or grams <= 0:
            continue
        try:
            save_manual_preset(name, grams, protein, calories)
            written += 1
        except HTTPException:
            continue
    return written
