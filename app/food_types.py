"""Shared value objects for food resolution."""

from __future__ import annotations

from dataclasses import dataclass


def is_likely_mass_reference_100g(g: float | None) -> bool:
    """True when a stored serving is almost certainly the 100 g nutrition column, not one item."""
    if g is None:
        return False
    return abs(float(g) - 100.0) < 0.25


@dataclass(frozen=True)
class FoodLookupResult:
    kcal_per_100g: float
    protein_per_100g: float
    default_serving_grams: float | None = None
    food_category: str | None = None
