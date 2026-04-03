"""Merge: primary (USDA) serving wins whenever set; OFF only backfills."""

from __future__ import annotations

from app.off_foods import _merge_servings


def test_primary_used_when_set_even_if_secondary_larger() -> None:
    assert _merge_servings(100.0, 150.0) == 100.0


def test_primary_used_when_set_even_if_secondary_smaller() -> None:
    assert _merge_servings(100.0, 25.0) == 100.0


def test_secondary_only_when_primary_missing() -> None:
    assert _merge_servings(None, 25.0) == 25.0


def test_none_when_both_missing() -> None:
    assert _merge_servings(None, None) is None
