"""Map a structured segment food phrase (from parse_local) to a foods row and display label."""

from __future__ import annotations

import sqlite3

from app.food_resolve import resolve_food_row
from app.hebrew_lexicon import HEBREW_TO_ENGLISH_FOOD_QUERY, normalize_food_input


async def resolve_item_for_db(
    conn: sqlite3.Connection, raw_item: str
) -> tuple[str, str, sqlite3.Row] | None:
    """Return (display_label, lookup_query, foods row) or None if the DB cannot resolve.

    Order: exact Hebrew lexicon key → direct Latin lookup. Unknown Hebrew is not translated
    (no LLM); callers fall through to meal LLM with the user's original text.
    """
    key = normalize_food_input(raw_item.strip())
    if not key:
        return None

    mapped = HEBREW_TO_ENGLISH_FOOD_QUERY.get(key)
    if mapped is not None:
        row = await resolve_food_row(conn, mapped)
        return (key, mapped, row) if row is not None else None

    row = await resolve_food_row(conn, key)
    return (key, key, row) if row is not None else None
