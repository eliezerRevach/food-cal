"""SQLite schema, seed rows, and shared connection."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

# No bundled nutrition rows — foods table is filled from Open Food Facts on demand (+ cache).
SEED_FOODS: list[tuple[str, float, float]] = []
SEED_FOOD_BASELINES: list[tuple[str, float, float, str | None]] = [
    ("apple", 52.0, 0.3, "fruit"),
    ("banana", 89.0, 1.1, "fruit"),
    ("bread", 265.0, 9.0, "grain"),
    ("carrot", 41.0, 0.9, "vegetable"),
    ("cheese", 350.0, 23.0, "dairy"),
    ("chicken breast", 165.0, 31.0, "protein"),
    ("cucumber", 16.0, 0.7, "vegetable"),
    ("egg", 143.0, 12.6, "protein"),
    ("milk", 42.0, 3.4, "dairy"),
    ("oats", 389.0, 17.0, "grain"),
    ("pasta", 131.0, 5.0, "grain"),
    ("potato", 77.0, 2.0, "vegetable"),
    ("rice", 130.0, 2.7, "grain"),
    ("rice cooked", 130.0, 2.3, "grain"),
    ("salmon", 206.0, 22.0, "protein"),
    ("sweet potato", 86.0, 1.6, "vegetable"),
    ("tomato", 18.0, 0.9, "vegetable"),
    ("tuna", 144.0, 23.0, "protein"),
    ("yogurt", 59.0, 10.0, "dairy"),
]

_conn: sqlite3.Connection | None = None


def _db_path() -> str:
    return os.environ.get("SQLITE_PATH", str(Path("data") / "app.db"))


def get_connection() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        path = _db_path()
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(path, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA foreign_keys = ON")
        _init_schema(_conn)
        _seed_if_empty(_conn)
        _conn.commit()
    return _conn


def reset_for_testing() -> None:
    """Close and drop the singleton so the next get_connection() is fresh (for :memory: isolation)."""
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None


def _foods_column_names(conn: sqlite3.Connection) -> set[str]:
    cur = conn.execute("PRAGMA table_info(foods)")
    return {str(r[1]) for r in cur.fetchall()}


def _migrate_foods(conn: sqlite3.Connection) -> None:
    cols = _foods_column_names(conn)
    if "default_serving_grams" not in cols:
        conn.execute("ALTER TABLE foods ADD COLUMN default_serving_grams REAL")
    if "food_category" not in cols:
        conn.execute("ALTER TABLE foods ADD COLUMN food_category TEXT")


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            kcal_per_100g REAL NOT NULL,
            protein_per_100g REAL NOT NULL,
            default_serving_grams REAL,
            food_category TEXT
        );

        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_iso TEXT NOT NULL,
            total_calories REAL NOT NULL,
            total_protein_g REAL,
            estimate_type TEXT,
            calories_likely REAL,
            calories_low REAL,
            calories_high REAL,
            raw_text TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            grams REAL,
            food_id INTEGER,
            calories_allocated REAL,
            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
            FOREIGN KEY (food_id) REFERENCES foods(id)
        );

        CREATE TABLE IF NOT EXISTS food_baselines (
            name TEXT PRIMARY KEY,
            kcal_per_100g REAL NOT NULL,
            protein_per_100g REAL NOT NULL,
            food_category TEXT
        );
        """
    )
    _migrate_foods(conn)


def _seed_if_empty(conn: sqlite3.Connection) -> None:
    if SEED_FOODS:
        row = conn.execute("SELECT COUNT(*) AS c FROM foods").fetchone()
        if row and row["c"] == 0:
            conn.executemany(
                "INSERT INTO foods (name, kcal_per_100g, protein_per_100g) VALUES (?, ?, ?)",
                SEED_FOODS,
            )

    if not SEED_FOOD_BASELINES:
        return
    row2 = conn.execute("SELECT COUNT(*) AS c FROM food_baselines").fetchone()
    if row2 and row2["c"] > 0:
        return
    conn.executemany(
        """
        INSERT INTO food_baselines (name, kcal_per_100g, protein_per_100g, food_category)
        VALUES (?, ?, ?, ?)
        """,
        SEED_FOOD_BASELINES,
    )


def find_food_by_name(conn: sqlite3.Connection, normalized_name: str) -> sqlite3.Row | None:
    cur = conn.execute(
        "SELECT * FROM foods WHERE lower(name) = ?",
        (normalized_name,),
    )
    return cur.fetchone()


def get_food_baseline(conn: sqlite3.Connection, normalized_name: str) -> sqlite3.Row | None:
    cur = conn.execute(
        "SELECT * FROM food_baselines WHERE lower(name) = ?",
        (normalized_name.strip().lower(),),
    )
    return cur.fetchone()


@contextmanager
def transaction():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
