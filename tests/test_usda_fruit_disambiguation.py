"""USDA candidate pool: prefer FDC fruit category and plausible portions (no per-food name lists)."""

from __future__ import annotations

from app.food_types import FoodLookupResult
from app.usda_fdc import _filter_pool_by_fdc_fruit_category, _pick_best_usda_candidate


def test_pool_prefers_rows_mapped_as_fruit_when_any_exist() -> None:
    dairy = (FoodLookupResult(74.0, 3.0, 23.0, "dairy"), None, "banana yogurt", 0)
    raw = (FoodLookupResult(89.0, 1.1, 118.0, "fruit"), "Foundation", "banana raw", 1)
    pool = [dairy, raw]
    filtered = _filter_pool_by_fdc_fruit_category(pool)
    assert len(filtered) == 1
    assert filtered[0][0].food_category == "fruit"


def test_pool_unchanged_when_no_fruit_category() -> None:
    grain = (FoodLookupResult(365.0, 12.0, 30.0, "grain"), None, "oats dry", 0)
    pool = [grain]
    assert _filter_pool_by_fdc_fruit_category(pool) == pool


def test_pick_prefers_plausible_serving_over_tiny_slice() -> None:
    tiny = (FoodLookupResult(52.0, 0.3, 25.0, "fruit"), "Branded", "apple raw", 0)
    medium = (FoodLookupResult(52.0, 0.3, 150.0, "fruit"), "Foundation", "apple raw", 1)
    best = _pick_best_usda_candidate("apple", [tiny, medium])
    assert best.default_serving_grams == 150.0


def test_pick_prefers_better_name_match_not_low_outlier_kcal() -> None:
    exact = (FoodLookupResult(52.0, 0.3, 182.0, "fruit"), "Foundation", "apple", 1)
    loose = (
        FoodLookupResult(25.0, 0.6, 50.0, "fruit"),
        "Foundation",
        "apple juice drink",
        0,
    )
    best = _pick_best_usda_candidate("apple", [loose, exact])
    assert best.kcal_per_100g == 52.0
