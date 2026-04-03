"""Bare-meal portions for one implicit unit (e.g. plain "apple").

Data-driven only: use API-provided serving grams when they represent a real portion
size. If unavailable (or likely a 100 g reference column), return None and let higher
layers decide the fallback path.
"""

from __future__ import annotations

import sqlite3

from app.food_types import is_likely_mass_reference_100g


def bare_serving_grams(row: sqlite3.Row) -> float | None:
    """Return implicit single-unit grams from row metadata."""
    raw = row["default_serving_grams"]
    if raw is not None:
        g = float(raw)
        if g > 0 and not is_likely_mass_reference_100g(g):
            return g
    return None
