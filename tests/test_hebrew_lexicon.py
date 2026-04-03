"""Hebrew bare-phrase → English query (no LLM path prep)."""

import unicodedata

from app.hebrew_lexicon import english_food_query_for_hebrew_bare, normalize_food_input


def test_bare_apple_maps() -> None:
    assert english_food_query_for_hebrew_bare("תפוח") == "apple"


def test_mixed_latin_skips_lexicon() -> None:
    assert english_food_query_for_hebrew_bare("תפוח apple") is None


def test_unknown_hebrew_returns_none() -> None:
    assert english_food_query_for_hebrew_bare("שווארמה בפיתה") is None


def test_normalize_food_input_strips_word_joiner() -> None:
    dirty = "תפ" + "\u2060" + "וח"
    assert normalize_food_input(dirty) == "תפוח"
    assert english_food_query_for_hebrew_bare(dirty) == "apple"
    assert english_food_query_for_hebrew_bare(unicodedata.normalize("NFC", "תפוח")) == "apple"
