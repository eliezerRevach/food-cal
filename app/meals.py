"""Log meals: local DB resolution first, LLM fallback for vague input."""

from __future__ import annotations

import math
import sqlite3
from typing import Any

import app.llm as llm_mod
from app import db
from app.food_resolve import resolve_food_row
from app.food_servings import bare_serving_grams
from app.hebrew_lexicon import english_bare_query_name, english_food_query_for_hebrew_bare
from app.nutrition import kcal_and_protein
from app.debug_agent_log import agent_log
from app.parse_local import meal_needs_estimate_heuristic, parse_local_meal


def _llm_required_float(field: str, raw: Any) -> float:
    if raw is None:
        raise ValueError(f"LLM JSON missing numeric {field}")
    try:
        v = float(raw)
    except (TypeError, ValueError) as e:
        raise ValueError(f"LLM JSON {field} must be a number, got {raw!r}") from e
    if not math.isfinite(v):
        raise ValueError(f"LLM JSON {field} must be a finite number, got {raw!r}")
    return v


def _llm_optional_float(field: str, raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        v = float(raw)
    except (TypeError, ValueError) as e:
        raise ValueError(f"LLM JSON {field} must be a number or null, got {raw!r}") from e
    if not math.isfinite(v):
        raise ValueError(f"LLM JSON {field} must be a finite number or null, got {raw!r}")
    return v


def _fetch_entry(conn: sqlite3.Connection, entry_id: int) -> dict[str, Any]:
    ent = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    if ent is None:
        raise ValueError(f"No entry row for id={entry_id}")
    rows = conn.execute(
        "SELECT label, grams, calories_allocated FROM items WHERE entry_id = ? ORDER BY id",
        (entry_id,),
    ).fetchall()
    items = [
        {
            "label": r["label"],
            "grams": r["grams"],
            **({"calories": r["calories_allocated"]} if r["calories_allocated"] is not None else {}),
        }
        for r in rows
    ]
    tc = ent["total_calories"]
    if tc is None:
        raise ValueError("Stored entry has null total_calories (invalid or legacy row)")
    out: dict[str, Any] = {
        "total_calories": float(tc),
        "items": items,
    }
    if ent["total_protein_g"] is not None:
        out["total_protein_g"] = float(ent["total_protein_g"])
    if ent["estimate_type"] is not None:
        out["estimate_type"] = ent["estimate_type"]
    if ent["calories_likely"] is not None:
        out["calories_likely"] = float(ent["calories_likely"])
    if ent["calories_low"] is not None:
        out["calories_low"] = float(ent["calories_low"])
    if ent["calories_high"] is not None:
        out["calories_high"] = float(ent["calories_high"])
    return out


def _persist_structured_entry(
    conn: sqlite3.Connection,
    date_iso: str,
    raw_text: str,
    resolved: list[tuple[float, str, sqlite3.Row]],
) -> dict[str, Any]:
    total_kcal = 0.0
    total_prot = 0.0
    lines: list[tuple[float, str, int, float]] = []
    for grams, name, food_row in resolved:
        k, p = kcal_and_protein(
            grams,
            float(food_row["kcal_per_100g"]),
            float(food_row["protein_per_100g"]),
        )
        total_kcal += k
        total_prot += p
        lines.append((grams, name, int(food_row["id"]), k))

    with db.transaction() as c:
        cur = c.execute(
            """
            INSERT INTO entries (
                date_iso, total_calories, total_protein_g,
                estimate_type, calories_likely, calories_low, calories_high,
                raw_text
            ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?)
            """,
            (
                date_iso,
                round(total_kcal, 1),
                round(total_prot, 2),
                raw_text,
            ),
        )
        eid = cur.lastrowid
        for grams, name, fid, k in lines:
            c.execute(
                """
                INSERT INTO items (entry_id, label, grams, food_id, calories_allocated)
                VALUES (?, ?, ?, ?, ?)
                """,
                (eid, name, grams, fid, round(k, 1)),
            )

    return _fetch_entry(conn, int(eid))


async def log_meal(text: str, date_iso: str) -> dict[str, Any]:
    conn = db.get_connection()
    needs_h = meal_needs_estimate_heuristic(text)
    local = None if needs_h else parse_local_meal(text)
    # region agent log
    agent_log(
        "meals.py:log_meal",
        "after_local_parse",
        {
            "needs_heuristic": needs_h,
            "local_segments": None if local is None else len(local),
        },
        "H1",
    )
    # endregion
    resolved: list[tuple[float, str, sqlite3.Row]] = []

    if local is not None:
        for grams, name in local:
            row = await resolve_food_row(conn, name)
            if row is None:
                break
            resolved.append((grams, name, row))
        else:
            return _persist_structured_entry(conn, date_iso, text, resolved)

    if not meal_needs_estimate_heuristic(text):
        en_query = english_food_query_for_hebrew_bare(text)
        if en_query:
            row = await resolve_food_row(conn, en_query)
            if row is not None:
                grams_bare = bare_serving_grams(row)
                if grams_bare is not None:
                    bare_resolved = [(grams_bare, en_query, row)]
                    return _persist_structured_entry(conn, date_iso, text, bare_resolved)
        bare_en = english_bare_query_name(text)
        if bare_en is not None:
            row = await resolve_food_row(conn, bare_en)
            if row is not None:
                grams_bare = bare_serving_grams(row)
                if grams_bare is not None:
                    bare_resolved = [(grams_bare, bare_en, row)]
                    return _persist_structured_entry(conn, date_iso, text, bare_resolved)

    # region agent log
    agent_log("meals.py:log_meal", "calling_llm", {"text_len": len(text)}, "H2")
    # endregion
    llm_data = await llm_mod.parse_meal_with_llm(text)
    # region agent log
    agent_log(
        "meals.py:log_meal",
        "llm_returned",
        {"keys": list(llm_data.keys())},
        "H5",
    )
    # endregion
    likely = _llm_required_float("calories_likely", llm_data.get("calories_likely"))
    est = str(llm_data.get("estimate_type", "estimated"))
    low = _llm_optional_float("calories_low", llm_data.get("calories_low"))
    high = _llm_optional_float("calories_high", llm_data.get("calories_high"))
    prot_raw = llm_data.get("total_protein_g")
    protein_g = (
        round(_llm_required_float("total_protein_g", prot_raw), 2) if prot_raw is not None else None
    )

    with db.transaction() as c:
        cur = c.execute(
            """
            INSERT INTO entries (
                date_iso, total_calories, total_protein_g,
                estimate_type, calories_likely, calories_low, calories_high,
                raw_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                date_iso,
                likely,
                protein_g,
                est,
                likely,
                low,
                high,
                text,
            ),
        )
        eid = cur.lastrowid
        for it in llm_data.get("items", []) or []:
            if not isinstance(it, dict):
                continue
            label = str(it.get("food", "")).strip()
            g = it.get("grams")
            try:
                grams_f = float(g) if g is not None else None
            except (TypeError, ValueError):
                grams_f = None
            c.execute(
                """
                INSERT INTO items (entry_id, label, grams, food_id, calories_allocated)
                VALUES (?, ?, ?, NULL, NULL)
                """,
                (eid, label or "unknown", grams_f),
            )

    return _fetch_entry(conn, int(eid))


def daily_summary(date_iso: str) -> dict[str, Any]:
    conn = db.get_connection()
    rows = conn.execute(
        "SELECT total_calories, total_protein_g FROM entries WHERE date_iso = ?",
        (date_iso,),
    ).fetchall()
    total_cal = sum(float(r["total_calories"] or 0.0) for r in rows)
    has_protein = any(r["total_protein_g"] is not None for r in rows)
    total_prot = sum(float(r["total_protein_g"] or 0.0) for r in rows)
    out: dict[str, Any] = {"total_calories": round(total_cal, 1)}
    if has_protein:
        out["total_protein_g"] = round(total_prot, 2)
    return out
