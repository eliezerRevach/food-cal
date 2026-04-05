"""Rule-based parsing for structured `Ng food` segments (comma-separated)."""

from __future__ import annotations

import re

from app.hebrew_lexicon import normalize_food_input

_SEGMENT = re.compile(r"^(\d+(?:\.\d+)?[gG])\s+(.+)$")
_GRAMS = re.compile(r"^(\d+(?:\.\d+)?)\s*[gG]\s*$")
# Hebrew: "100 גרם סלמון" (grams first — try before RTL to avoid ambiguity)
_SEGMENT_HE = re.compile(r"^(\d+(?:\.\d+)?)\s*גרם\s+(.+)$")
# Hebrew RTL: "סלמון מעושן 20 גרם"
_SEGMENT_HE_RTL = re.compile(r"^(.+?)\s+(\d+(?:\.\d+)?)\s*גרם\s*$")
# Latin RTL: "chicken breast 200g"
_SEGMENT_LATIN_RTL = re.compile(r"^(.+?)\s+(\d+(?:\.\d+)?)\s*[gG]\s*$")

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
    """Return list of (grams, raw_item) or None if text is not fully structured.

    `raw_item` is the food phrase only (no grams). Hebrew is not translated here — use
    :func:`resolve_item_for_db` for lexicon / LLM / DB resolution.
    """
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


def _normalize_item_string(name: str) -> str:
    """Lowercase ASCII letters; collapse whitespace (Hebrew unchanged)."""
    return " ".join(name.strip().lower().split())


def _finalize_item(name: str) -> str:
    """NFC + whitespace normalization for stable resolution keys."""
    return normalize_food_input(_normalize_item_string(name))


def _parse_one_segment(part: str) -> tuple[float, str] | None:
    part = part.strip()
    # 1) Grams-first Hebrew
    m_he = _SEGMENT_HE.match(part)
    if m_he:
        grams = float(m_he.group(1))
        item = _finalize_item(m_he.group(2))
        if grams <= 0 or not item:
            return None
        return (grams, item)

    # 2) Grams-first Latin (e.g. 200g chicken)
    m = _SEGMENT.match(part)
    if m:
        raw_amt = m.group(1)
        gm = _GRAMS.match(raw_amt)
        if gm:
            grams = float(gm.group(1))
            item = _finalize_item(m.group(2))
            if grams <= 0 or not item:
                return None
            return (grams, item)

    # 3) RTL Hebrew: food … N גרם
    m_h_rtl = _SEGMENT_HE_RTL.match(part)
    if m_h_rtl:
        grams = float(m_h_rtl.group(2))
        item = _finalize_item(m_h_rtl.group(1))
        if grams <= 0 or not item:
            return None
        return (grams, item)

    # 4) RTL Latin: food … Ng
    m_l_rtl = _SEGMENT_LATIN_RTL.match(part)
    if m_l_rtl:
        grams = float(m_l_rtl.group(2))
        item = _finalize_item(m_l_rtl.group(1))
        if grams <= 0 or not item:
            return None
        return (grams, item)

    return None
