"""Resolve a normalized food name: SQLite cache kept in sync with USDA + Open Food Facts."""

from __future__ import annotations

import sqlite3

import app.off_foods as off_foods
from app import db


async def resolve_food_row(conn: sqlite3.Connection, normalized_name: str) -> sqlite3.Row | None:
    """Return a `foods` row, refreshing from APIs whenever `lookup_food` succeeds.

    Stale rows (e.g. dairy yogurt matched for ``banana`` before USDA fruit filtering) are overwritten
    on the next log — we only skipped refresh when `food_category` was null, which kept bad rows forever.
    If `lookup_food` fails (offline), the last cached row is still returned.
    """
    meta = await off_foods.lookup_food(normalized_name)
    if meta is None:
        return db.find_food_by_name(conn, normalized_name)

    row = db.find_food_by_name(conn, normalized_name)
    if row is None:
        try:
            with db.transaction() as c:
                c.execute(
                    """
                    INSERT INTO foods (name, kcal_per_100g, protein_per_100g, default_serving_grams, food_category)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        normalized_name,
                        meta.kcal_per_100g,
                        meta.protein_per_100g,
                        meta.default_serving_grams,
                        meta.food_category,
                    ),
                )
        except sqlite3.IntegrityError:
            with db.transaction() as c:
                c.execute(
                    """
                    UPDATE foods SET
                        kcal_per_100g = ?,
                        protein_per_100g = ?,
                        default_serving_grams = ?,
                        food_category = ?
                    WHERE lower(name) = lower(?)
                    """,
                    (
                        meta.kcal_per_100g,
                        meta.protein_per_100g,
                        meta.default_serving_grams,
                        meta.food_category,
                        normalized_name,
                    ),
                )
    else:
        with db.transaction() as c:
            c.execute(
                """
                UPDATE foods SET
                    kcal_per_100g = ?,
                    protein_per_100g = ?,
                    default_serving_grams = ?,
                    food_category = ?
                WHERE id = ?
                """,
                (
                    meta.kcal_per_100g,
                    meta.protein_per_100g,
                    meta.default_serving_grams,
                    meta.food_category,
                    int(row["id"]),
                ),
            )

    return db.find_food_by_name(conn, normalized_name)
