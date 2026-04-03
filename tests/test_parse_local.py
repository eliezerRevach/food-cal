"""Unit tests for structured local meal parsing."""

from app.parse_local import meal_needs_estimate_heuristic, parse_local_meal


def test_single_segment() -> None:
    out = parse_local_meal("200g chicken breast")
    assert out == [(200.0, "chicken breast")]


def test_multi_segment() -> None:
    out = parse_local_meal("200g chicken breast, 50g rice")
    assert out == [(200.0, "chicken breast"), (50.0, "rice")]


def test_vague_returns_none() -> None:
    assert parse_local_meal("shawarma in laffa from restaurant") is None


def test_empty_returns_none() -> None:
    assert parse_local_meal("") is None


def test_kitchen_context_triggers_estimate_heuristic() -> None:
    assert meal_needs_estimate_heuristic("chicken breast on a pan with a bit of oil")
    assert meal_needs_estimate_heuristic("200g chicken breast cooked in olive oil")


def test_plain_structured_does_not_trigger_heuristic() -> None:
    assert not meal_needs_estimate_heuristic("200g chicken breast")
    assert not meal_needs_estimate_heuristic("200g chicken breast, 50g rice")


def test_hebrew_grams_parse() -> None:
    out = parse_local_meal("100 גרם סלמון")
    assert out == [(100.0, "salmon")]


def test_hebrew_grams_apple_alias() -> None:
    out = parse_local_meal("150 גרם תפוח")
    assert out == [(150.0, "apple")]


def test_hebrew_oven_triggers_estimate() -> None:
    assert meal_needs_estimate_heuristic("100 גרם פילה סלמון בתנור ללא שמן כלל")
