"""Import curated nutrition rows into ``food_baselines`` and optionally ``foods`` (SQLite).

Reads CSV (header row) or JSON (array of objects). No HTTP — safe for offline bulk edits.

Usage (from repo root)::

    python scripts/import_nutrition_seed.py data/food_seed.example.csv
    python scripts/import_nutrition_seed.py data/seed.json --foods
    python scripts/import_nutrition_seed.py seed.csv --database path/to/app.db

Environment: ``SQLITE_PATH`` selects the DB file when ``--database`` is omitted (default ``data/app.db``).

Required columns / keys: ``name``, ``kcal_per_100g``, ``protein_per_100g``.
Optional: ``food_category``, ``default_serving_grams`` (empty = NULL).

Names are normalized to lowercase for consistency with app lookups.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sqlite3
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent


def _ensure_repo_path() -> None:
    root = str(_REPO_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(_REPO_ROOT / ".env")
    except ImportError:
        pass


def _parse_float(raw: str | float | int | None, field: str) -> float:
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        raise ValueError(f"missing or empty numeric field: {field}")
    return float(raw)


def _parse_optional_float(raw: str | float | int | None) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, str) and not raw.strip():
        return None
    v = float(raw)
    return v if v > 0 else None


def _normalize_row(d: dict[str, object]) -> tuple[str, float, float, str | None, float | None]:
    name_raw = d.get("name")
    if name_raw is None or not str(name_raw).strip():
        raise ValueError("each row must have a non-empty 'name'")
    name = str(name_raw).strip().lower()
    kcal = _parse_float(d.get("kcal_per_100g"), "kcal_per_100g")
    protein = _parse_float(d.get("protein_per_100g"), "protein_per_100g")
    cat = d.get("food_category")
    cat_out: str | None
    if cat is None or (isinstance(cat, str) and not cat.strip()):
        cat_out = None
    else:
        cat_out = str(cat).strip().lower()
    serving = d.get("default_serving_grams")
    if serving is None or (isinstance(serving, str) and not serving.strip()):
        serving_out = None
    else:
        serving_out = _parse_optional_float(serving)
    return (name, kcal, protein, cat_out, serving_out)


def _read_csv(path: Path) -> list[dict[str, object]]:
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError("CSV has no header row")
        rows: list[dict[str, object]] = []
        for row in reader:
            if not any((v or "").strip() for v in row.values()):
                continue
            rows.append(dict(row))
        return rows


def _read_json(path: Path) -> list[dict[str, object]]:
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("JSON must be an array of objects")
    return [x for x in data if isinstance(x, dict)]


def _load_rows(path: Path) -> list[tuple[str, float, float, str | None, float | None]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        dicts = _read_csv(path)
    elif suffix in (".json", ".jsonl"):
        if suffix == ".jsonl":
            lines = path.read_text(encoding="utf-8").splitlines()
            dicts = [json.loads(line) for line in lines if line.strip()]
        else:
            dicts = _read_json(path)
    else:
        raise SystemExit(f"Unsupported file type: {suffix} (use .csv, .json, or .jsonl)")
    return [_normalize_row(d) for d in dicts]


def _apply_baselines(conn: sqlite3.Connection, rows: list[tuple[str, float, float, str | None, float | None]]) -> int:
    conn.executemany(
        """
        INSERT INTO food_baselines (name, kcal_per_100g, protein_per_100g, food_category, default_serving_grams)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            kcal_per_100g = excluded.kcal_per_100g,
            protein_per_100g = excluded.protein_per_100g,
            food_category = excluded.food_category,
            default_serving_grams = excluded.default_serving_grams
        """,
        rows,
    )
    return len(rows)


def _apply_foods(conn: sqlite3.Connection, rows: list[tuple[str, float, float, str | None, float | None]]) -> int:
    conn.executemany(
        """
        INSERT INTO foods (name, kcal_per_100g, protein_per_100g, default_serving_grams, food_category)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            kcal_per_100g = excluded.kcal_per_100g,
            protein_per_100g = excluded.protein_per_100g,
            default_serving_grams = excluded.default_serving_grams,
            food_category = excluded.food_category
        """,
        rows,
    )
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import CSV/JSON nutrition rows into food_baselines (and optionally foods).",
    )
    parser.add_argument(
        "file",
        type=Path,
        help="Path to .csv, .json, or .jsonl",
    )
    parser.add_argument(
        "-d",
        "--database",
        help="SQLite database path (overrides SQLITE_PATH)",
    )
    parser.add_argument(
        "--foods",
        action="store_true",
        help="Also upsert the foods cache with the same rows",
    )
    args = parser.parse_args()

    if args.database:
        os.environ["SQLITE_PATH"] = str(args.database)
    elif not os.environ.get("SQLITE_PATH"):
        os.environ["SQLITE_PATH"] = str(_REPO_ROOT / "data" / "app.db")

    _load_dotenv()
    _ensure_repo_path()

    path: Path = args.file
    if not path.is_file():
        raise SystemExit(f"File not found: {path}")

    rows = _load_rows(path)

    from app import db

    db.reset_for_testing()
    conn = db.get_connection()

    # Ensure schema exists (get_connection inits)
    with db.transaction() as c:
        n_base = _apply_baselines(c, rows)
        n_foods = 0
        if args.foods:
            n_foods = _apply_foods(c, rows)

    print(f"food_baselines: {n_base} row(s) upserted.")
    if args.foods:
        print(f"foods: {n_foods} row(s) upserted.")
    else:
        print("foods: skipped (pass --foods to upsert cache)")


if __name__ == "__main__":
    main()
