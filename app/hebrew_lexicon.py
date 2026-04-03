"""Hebrew food phrases → English canonical name for DB lookup (avoids LLM for simple logs).

Structured lines like `100 גרם תפוח` still use user-provided grams via parse_local. Bare Hebrew/English
uses `foods` row (from USDA/OFF) and `food_servings.bare_serving_grams` for bare portions.
"""

from __future__ import annotations

import re
import unicodedata

# Extend freely; longest multi-word keys should appear before shorter keys sharing words (dict order; bare lookup is exact key only).
HEBREW_TO_ENGLISH_FOOD_QUERY: dict[str, str] = {
    "פילה סלמון": "salmon",
    "סלמון": "salmon",
    "תפוח עץ": "apple",
    "תפוח": "apple",
    "בננה": "banana",
    "אורז": "rice",
    "אורז מבושל": "rice cooked",
    "לחם": "bread",
    "חלב": "milk",
    "ביצה": "egg",
    "עגבנייה": "tomato",
    "מלפפון": "cucumber",
    "גזר": "carrot",
    "עוף": "chicken breast",
    "חזה עוף": "chicken breast",
    "טונה": "tuna",
    "גבינה": "cheese",
    "יוגורט": "yogurt",
    "שיבולת שועל": "oats",
    "פסטה": "pasta",
    "תפוח אדמה": "potato",
    "בטטה": "sweet potato",
}

_LATIN = re.compile(r"[A-Za-z]")


def normalize_food_input(text: str) -> str:
    """NFC, strip formatting controls, collapse whitespace — for reliable Hebrew dict matches."""
    t = unicodedata.normalize("NFC", (text or "").strip())
    t = "".join(ch for ch in t if unicodedata.category(ch) != "Cf")
    return " ".join(t.split())


def english_food_query_for_hebrew_bare(text: str) -> str | None:
    """If `text` is exactly one known Hebrew food phrase (no Latin), return English search name; else None."""
    t = normalize_food_input(text)
    if not t:
        return None
    if _LATIN.search(t):
        return None
    return HEBREW_TO_ENGLISH_FOOD_QUERY.get(t)


def english_bare_query_name(text: str) -> str | None:
    """Single-token Latin input (e.g. `apple`) → lowercase canonical query for `foods` / OFF. Minimum 2 chars."""
    t = normalize_food_input(text)
    if len(t) < 2 or " " in t:
        return None
    if not _LATIN.search(t):
        return None
    return t.lower()
