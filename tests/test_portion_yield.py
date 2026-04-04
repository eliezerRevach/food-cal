"""portion_yield: longest phrase match and effective grams."""

from __future__ import annotations

import pytest

from app import db
from app.portion_yield import effective_grams, lookup_yield, normalize_label


def test_normalize_label_collapses_space_and_case() -> None:
    assert normalize_label("  Chicken   WINGS  ") == "chicken wings"


def test_lookup_yield_longest_phrase_wins() -> None:
    conn = db.get_connection()
    assert lookup_yield(conn, "fried chicken wings") is not None
    ratio, bone = lookup_yield(conn, "fried chicken wings")
    assert ratio == pytest.approx(0.6)
    assert bone is True


def test_lookup_yield_no_match() -> None:
    conn = db.get_connection()
    assert lookup_yield(conn, "200g tofu") is None


def test_effective_grams_scales_when_rule_matches() -> None:
    conn = db.get_connection()
    assert effective_grams(conn, "chicken wings", 100.0) == pytest.approx(60.0)


def test_effective_grams_none_passthrough() -> None:
    conn = db.get_connection()
    assert effective_grams(conn, "chicken wings", None) is None


def test_effective_grams_unchanged_without_rule() -> None:
    conn = db.get_connection()
    assert effective_grams(conn, "rice", 150.0) == pytest.approx(150.0)
