"""Rule-based parsing for structured `Ng food` segments (comma-separated)."""

from __future__ import annotations

import re

from app.hebrew_lexicon import HEBREW_TO_ENGLISH_FOOD_QUERY

_SEGMENT = re.compile(r"^(\d+(?:\.\d+)?[gG])\s+(.+)$")
_GRAMS = re.compile(r"^(\d+(?:\.\d+)?)\s*[gG]\s*$")
# Hebrew: "100 גרם סלמון"
_SEGMENT_HE = re.compile(r"^(\d+(?:\.\d+)?)\s*גרם\s+(.+)$")

# Hebrew (and future) segment aliases → English OFF query string.
ALIASES: dict[str, str] = dict(HEBREW_TO_ENGLISH_FOOD_QUERY)

# Cooking / added fat / vague prep → do not trust plain DB rows even when a `Ng food` prefix looks structured.
_KITCHEN_OR_VAGUE_CONTEXT = re.compile(
    r"""
    \boil\b
    | \bbutter\b
    | \b(ghee|lard|mayo|mayonnaise)\b
    | \bpan\b
    | fried|frying|saut[eé]|grilled|roasted
    | \brestaurant\b
    | \bresturant\b
    | bit\s+of\s+(oil|butter)
    | splash\s+of | dash\s+of | drizzle
    | \b(tbsp|tsp)\b
    | \b(marinade|dressing)\b
    | cooked\s+in
    | on\s+a\s+pan
    | in\s+(a\s+)?pan
    | in\s+the\s+oven
    | deep\s*fried
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Hebrew / general RTL prep (avoid bare "שמן" — matches "ללא שמן" false positive)
_HEB_PREP_OR_CONTEXT = re.compile(
    r"בתנור|במחבת|מחבת|מטוגנ|טיגון|צלוי|בגריל|מסעדה",
)


def meal_needs_estimate_heuristic(text: str) -> bool:
    """True if wording suggests preparation, extra fat, or vague portions (route to LLM, not DB-only)."""
    t = text.strip()
    if not t:
        return False
    if _KITCHEN_OR_VAGUE_CONTEXT.search(t) is not None:
        return True
    return _HEB_PREP_OR_CONTEXT.search(t) is not None


def parse_local_meal(text: str) -> list[tuple[float, str]] | None:
    """Return list of (grams, canonical_query) or None if text is not fully structured."""
    t = " ".join(text.strip().split())
    if not t:
        return None
    parts = [p.strip() for p in t.split(",") if p.strip()]
    if not parts:
        return None
    out: list[tuple[float, str]] = []
    for part in parts:
        parsed = _parse_one_segment(part)
        if parsed is None:
            return None
        out.append(parsed)
    return out


def _parse_one_segment(part: str) -> tuple[float, str] | None:
    part = part.strip()
    m_he = _SEGMENT_HE.match(part)
    if m_he:
        grams = float(m_he.group(1))
        name = _normalize_name_multilingual(m_he.group(2))
        if grams <= 0 or not name:
            return None
        return (grams, _apply_aliases(name))

    m = _SEGMENT.match(part)
    if not m:
        return None
    raw_amt = m.group(1)
    gm = _GRAMS.match(raw_amt)
    if not gm:
        return None
    grams = float(gm.group(1))
    name = _normalize_name_multilingual(m.group(2))
    if grams <= 0 or not name:
        return None
    return (grams, _apply_aliases(name))


def _apply_aliases(name: str) -> str:
    if name in ALIASES:
        return ALIASES[name]
    for key in sorted(ALIASES.keys(), key=len, reverse=True):
        if key in name:
            return ALIASES[key]
    return name


def _normalize_name_multilingual(name: str) -> str:
    """Lowercase ASCII letters; collapse whitespace (Hebrew unchanged)."""
    return " ".join(name.strip().lower().split())
