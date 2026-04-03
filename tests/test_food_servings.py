"""bare_serving_grams uses stored grams only (data-driven)."""

from __future__ import annotations

import sqlite3

import pytest

from app.food_servings import bare_serving_grams


def _row(default_serving_grams: float | None, food_category: str | None) -> sqlite3.Row:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE f (name TEXT, default_serving_grams REAL, food_category TEXT)"
    )
    conn.execute("INSERT INTO f VALUES (?, ?, ?)", (None, default_serving_grams, food_category))
    return conn.execute("SELECT * FROM f").fetchone()


def test_returns_positive_grams() -> None:
    assert bare_serving_grams(_row(118.0, "fruit")) == 118.0


def test_none_when_missing() -> None:
    assert bare_serving_grams(_row(None, None)) is None


@pytest.mark.parametrize("grams", [0.0, -5.0])
def test_none_when_non_positive(grams: float) -> None:
    assert bare_serving_grams(_row(grams, None)) is None


def test_none_when_missing_even_with_category() -> None:
    assert bare_serving_grams(_row(None, "fruit")) is None


def test_none_when_serving_is_100g_reference() -> None:
    assert bare_serving_grams(_row(100.0, "fruit")) is None
