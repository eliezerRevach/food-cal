"""Saved composite meals (recipes) and portion logging."""

from __future__ import annotations

import math
import sqlite3
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app import db
from app.meals import log_manual_meal, validate_date_iso


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class RecipeIngredientInput:
    __slots__ = ("label", "grams", "calories", "protein_g")

    def __init__(self, label: str, grams: float, calories: float, protein_g: float) -> None:
        self.label = label
        self.grams = grams
        self.calories = calories
        self.protein_g = protein_g


def _validate_ingredients(ingredients: list[RecipeIngredientInput]) -> tuple[float, float, float]:
    if not ingredients:
        raise HTTPException(status_code=400, detail="at least one ingredient is required")
    batch_grams = 0.0
    total_cal = 0.0
    total_prot = 0.0
    for ing in ingredients:
        lab = ing.label.strip()
        if not lab:
            raise HTTPException(status_code=400, detail="each ingredient requires a non-empty label")
        if len(lab) > 120:
            raise HTTPException(status_code=400, detail="ingredient label must be at most 120 characters")
        if not math.isfinite(ing.grams) or ing.grams <= 0:
            raise HTTPException(status_code=400, detail="ingredient grams must be a positive finite number")
        if not math.isfinite(ing.calories) or ing.calories < 0:
            raise HTTPException(status_code=400, detail="ingredient calories must be a non-negative finite number")
        if not math.isfinite(ing.protein_g) or ing.protein_g < 0:
            raise HTTPException(status_code=400, detail="ingredient protein must be a non-negative finite number")
        batch_grams += ing.grams
        total_cal += ing.calories
        total_prot += ing.protein_g
    return batch_grams, total_cal, total_prot


def _recipe_row_to_summary(row: sqlite3.Row, ingredient_count: int) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "name": str(row["name"]),
        "batch_grams": float(row["batch_grams"]),
        "total_calories": float(row["total_calories"]),
        "total_protein_g": float(row["total_protein_g"]),
        "ingredient_count": ingredient_count,
        "created_at": str(row["created_at"]),
        "updated_at": str(row["updated_at"]),
    }


def _fetch_ingredients(conn: sqlite3.Connection, recipe_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT label, grams, calories, protein_g
        FROM recipe_ingredients
        WHERE recipe_id = ?
        ORDER BY sort_order ASC, id ASC
        """,
        (recipe_id,),
    ).fetchall()
    return [
        {
            "label": str(r["label"]),
            "grams": float(r["grams"]),
            "calories": float(r["calories"]),
            "protein": float(r["protein_g"]),
        }
        for r in rows
    ]


def list_recipes() -> list[dict[str, Any]]:
    conn = db.get_connection()
    rows = conn.execute(
        """
        SELECT r.*,
               (SELECT COUNT(*) FROM recipe_ingredients i WHERE i.recipe_id = r.id) AS ingredient_count
        FROM recipes r
        ORDER BY r.updated_at DESC, r.id DESC
        """
    ).fetchall()
    return [
        _recipe_row_to_summary(r, int(r["ingredient_count"] or 0))
        for r in rows
    ]


def get_recipe(recipe_id: int) -> dict[str, Any]:
    conn = db.get_connection()
    row = conn.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="recipe not found")
    out = _recipe_row_to_summary(row, 0)
    ings = _fetch_ingredients(conn, recipe_id)
    out["ingredient_count"] = len(ings)
    out["ingredients"] = ings
    return out


def _insert_recipe(
    conn: sqlite3.Connection,
    name: str,
    ingredients: list[RecipeIngredientInput],
) -> int:
    batch_grams, total_cal, total_prot = _validate_ingredients(ingredients)
    name_lbl = name.strip()
    if not name_lbl:
        raise HTTPException(status_code=400, detail="name is required")
    if len(name_lbl) > 120:
        raise HTTPException(status_code=400, detail="name must be at most 120 characters")
    now = _utc_now_iso()
    cur = conn.execute(
        """
        INSERT INTO recipes (
            name, batch_grams, total_calories, total_protein_g, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            name_lbl,
            round(batch_grams, 2),
            round(total_cal, 1),
            round(total_prot, 2),
            now,
            now,
        ),
    )
    rid = int(cur.lastrowid or 0)
    for idx, ing in enumerate(ingredients):
        conn.execute(
            """
            INSERT INTO recipe_ingredients (
                recipe_id, sort_order, label, grams, calories, protein_g
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                rid,
                idx,
                ing.label.strip(),
                round(ing.grams, 2),
                round(ing.calories, 1),
                round(ing.protein_g, 2),
            ),
        )
    return rid


def create_recipe(name: str, ingredients: list[RecipeIngredientInput]) -> dict[str, Any]:
    with db.transaction() as conn:
        rid = _insert_recipe(conn, name, ingredients)
    return get_recipe(rid)


def update_recipe(recipe_id: int, name: str, ingredients: list[RecipeIngredientInput]) -> dict[str, Any]:
    conn = db.get_connection()
    if conn.execute("SELECT id FROM recipes WHERE id = ?", (recipe_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="recipe not found")
    batch_grams, total_cal, total_prot = _validate_ingredients(ingredients)
    name_lbl = name.strip()
    if not name_lbl:
        raise HTTPException(status_code=400, detail="name is required")
    if len(name_lbl) > 120:
        raise HTTPException(status_code=400, detail="name must be at most 120 characters")
    now = _utc_now_iso()
    with db.transaction() as c:
        c.execute(
            """
            UPDATE recipes
            SET name = ?, batch_grams = ?, total_calories = ?, total_protein_g = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                name_lbl,
                round(batch_grams, 2),
                round(total_cal, 1),
                round(total_prot, 2),
                now,
                recipe_id,
            ),
        )
        c.execute("DELETE FROM recipe_ingredients WHERE recipe_id = ?", (recipe_id,))
        for idx, ing in enumerate(ingredients):
            c.execute(
                """
                INSERT INTO recipe_ingredients (
                    recipe_id, sort_order, label, grams, calories, protein_g
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    recipe_id,
                    idx,
                    ing.label.strip(),
                    round(ing.grams, 2),
                    round(ing.calories, 1),
                    round(ing.protein_g, 2),
                ),
            )
    return get_recipe(recipe_id)


def delete_recipe(recipe_id: int) -> None:
    conn = db.get_connection()
    with db.transaction() as c:
        cur = c.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="recipe not found")


def log_recipe_portion(date_iso: str, recipe_id: int, grams_eaten: float) -> dict[str, Any]:
    try:
        date_iso = validate_date_iso(date_iso)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not math.isfinite(grams_eaten) or grams_eaten <= 0:
        raise HTTPException(status_code=400, detail="grams_eaten must be a positive finite number")

    conn = db.get_connection()
    row = conn.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="recipe not found")

    batch = float(row["batch_grams"])
    if batch <= 0:
        raise HTTPException(status_code=502, detail="recipe has invalid batch weight")

    ratio = grams_eaten / batch
    calories = round(float(row["total_calories"]) * ratio, 1)
    protein = round(float(row["total_protein_g"]) * ratio, 2)
    name = str(row["name"])
    label = f"{name} ({round(grams_eaten, 1)}g)"

    return log_manual_meal(date_iso, label, grams_eaten, calories, protein)


def _recipe_name_exists(conn: sqlite3.Connection, name: str) -> bool:
    return (
        conn.execute(
            "SELECT 1 FROM recipes WHERE lower(name) = lower(?) LIMIT 1",
            (name.strip(),),
        ).fetchone()
        is not None
    )


def _unique_recipe_name(conn: sqlite3.Connection, base: str) -> str:
    candidate = base.strip()
    if not _recipe_name_exists(conn, candidate):
        return candidate
    n = 2
    while True:
        alt = f"{candidate} ({n})"
        if not _recipe_name_exists(conn, alt):
            return alt
        n += 1


def import_recipes_from_backup(recipes: list[dict[str, Any]]) -> int:
    """Insert recipes from backup; returns count inserted."""
    inserted = 0
    conn = db.get_connection()
    with db.transaction() as c:
        for rec in recipes:
            name = str(rec.get("name", "")).strip()
            if not name:
                continue
            raw_ings = rec.get("ingredients") or []
            ingredients: list[RecipeIngredientInput] = []
            for it in raw_ings:
                if not isinstance(it, dict):
                    continue
                lab = str(it.get("label", "")).strip()
                try:
                    g = float(it.get("grams", 0))
                    cal = float(it.get("calories", 0))
                    prot = float(it.get("protein", it.get("protein_g", 0)))
                except (TypeError, ValueError):
                    continue
                if not lab or g <= 0:
                    continue
                ingredients.append(RecipeIngredientInput(lab, g, cal, prot))
            if not ingredients:
                continue
            unique_name = _unique_recipe_name(c, name)
            _insert_recipe(c, unique_name, ingredients)
            inserted += 1
    return inserted


def export_recipes_for_backup() -> list[dict[str, Any]]:
    conn = db.get_connection()
    rows = conn.execute("SELECT id, name FROM recipes ORDER BY id ASC").fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        rid = int(r["id"])
        out.append(
            {
                "name": str(r["name"]),
                "ingredients": _fetch_ingredients(conn, rid),
            }
        )
    return out
