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
_COUNTED_LATIN_BARE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s+([A-Za-z][A-Za-z\-]*)\s*$")
# USDA FDC-style one-line descriptions (autocomplete); excludes gram amounts and Hebrew.
_HEBREW_SCRIPT = re.compile(r"[\u0590-\u05FF]")
_GRAM_SUFFIX_EN = re.compile(r"\d+(?:\.\d+)?\s*[gG]")
_GRAM_HE = re.compile(r"גרם")
# Allowed chars for a Latin FDC description line (commas inside the name).
_FDC_LATIN_LINE = re.compile(r"^[a-zA-Z][a-zA-Z,\s'\-]*$")
_FDC_TAIL_SINGLE = re.compile(
    r"^(raw|cooked|canned|frozen|dried|drained|boiled|baked|peeled|unpared|sliced|cubed|mashed|whole|"
    r"refried|reheated|smoked|pickled|stewed|grilled|roasted|fried|blanched|parboiled|steamed|microwaved|"
    r"prepared|unprepared|uncooked|unsweetened|sweetened|unsalted|salted|low\s+fat|reduced\s+fat)$",
    re.IGNORECASE | re.VERBOSE,
)


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


def _fdc_tail_matches_usda_style(last_segment: str) -> bool:
    """Last comma-separated segment looks like FDC state (not a second food like `rice`)."""
    tl = last_segment.strip()
    if not tl:
        return False
    low = tl.lower()
    if low.startswith("with "):
        return True
    return _FDC_TAIL_SINGLE.match(tl) is not None


def fdc_style_single_food_query(text: str) -> str | None:
    """Single-line USDA/FDC description (e.g. `Orange, raw`) → lowercase query for lookup; else None.

    Avoids misclassifying casual two-food lists (`chicken, rice`) by requiring a known-style tail segment.
    """
    t = normalize_food_input(text)
    if not t or "," not in t or len(t) > 200:
        return None
    if _HEBREW_SCRIPT.search(t) is not None:
        return None
    if not _LATIN.search(t):
        return None
    if _GRAM_SUFFIX_EN.search(t) is not None or _GRAM_HE.search(t) is not None:
        return None
    if _FDC_LATIN_LINE.fullmatch(t) is None:
        return None
    parts = [p.strip() for p in t.split(",") if p.strip()]
    if len(parts) < 2:
        return None
    if not _fdc_tail_matches_usda_style(parts[-1]):
        return None
    return t.lower()


def _singular_candidates(word: str) -> list[str]:
    w = word.strip().lower()
    out: list[str] = []
    if len(w) > 3 and w.endswith("ies"):
        out.append(w[:-3] + "y")
    if len(w) > 3 and w.endswith("es"):
        out.append(w[:-2])
    if len(w) > 2 and w.endswith("s"):
        out.append(w[:-1])
    out.append(w)
    seen: set[str] = set()
    uniq: list[str] = []
    for x in out:
        if x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def english_counted_bare_query(text: str) -> tuple[float, list[str]] | None:
    """Parse `2 bananas` style input into count + normalized query candidates.

    Returns (count, [candidate_names]) where candidates include simple plural-normalized
    forms (e.g. bananas -> banana). Returns None for non-matching shapes.
    """
    t = normalize_food_input(text)
    m = _COUNTED_LATIN_BARE.match(t)
    if m is None:
        return None
    count = float(m.group(1))
    if count <= 0:
        return None
    token = m.group(2).lower()
    return (count, _singular_candidates(token))
