"""Map a structured segment food phrase (from parse_local) to a foods row and English label."""

from __future__ import annotations

import sqlite3

import app.llm as llm_mod
from app.food_resolve import resolve_food_row
from app.hebrew_lexicon import (
    HEBREW_TO_ENGLISH_FOOD_QUERY,
    contains_hebrew_script,
    normalize_food_input,
)


async def resolve_item_for_db(conn: sqlite3.Connection, raw_item: str) -> tuple[str, sqlite3.Row] | None:
    """Return (english_query, foods row) or None if the DB cannot resolve this phrase.

    Order: exact Hebrew lexicon key → Hebrew script + LLM English query → direct Latin lookup.
    """
    key = normalize_food_input(raw_item.strip())
    if not key:
        return None

    mapped = HEBREW_TO_ENGLISH_FOOD_QUERY.get(key)
    if mapped is not None:
        row = await resolve_food_row(conn, mapped)
        return (mapped, row) if row is not None else None

    if contains_hebrew_script(key):
        try:
            english = await llm_mod.food_query_from_phrase_llm(key)
        except Exception:
            return None
        row = await resolve_food_row(conn, english)
        return (english, row) if row is not None else None

    row = await resolve_food_row(conn, key)
    return (key, row) if row is not None else None
