"""resolve_item_for_db: lexicon, Latin, and Hebrew + LLM query paths."""

from __future__ import annotations

import pytest

from app import db
from app.food_types import FoodLookupResult
from app.resolve_structured import resolve_item_for_db


async def test_resolve_exact_hebrew_lexicon_calls_lookup_with_english(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[str] = []

    async def fake_lookup(q: str) -> FoodLookupResult | None:
        seen.append(q)
        if q.lower() == "salmon":
            return FoodLookupResult(206.0, 22.0, 150.0, "protein")
        return None

    monkeypatch.setattr("app.off_foods.lookup_food", fake_lookup)
    conn = db.get_connection()
    out = await resolve_item_for_db(conn, "סלמון")
    assert out is not None
    en, row = out
    assert en == "salmon"
    assert float(row["kcal_per_100g"]) == 206.0
    assert seen == ["salmon"]


async def test_resolve_hebrew_unknown_uses_food_query_llm_then_lookup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_food_query(phrase: str) -> str:
        assert phrase == "סלמון מעושן"
        return "smoked salmon"

    seen: list[str] = []

    async def fake_lookup(q: str) -> FoodLookupResult | None:
        seen.append(q)
        if q.lower() == "smoked salmon":
            return FoodLookupResult(150.0, 21.0, 150.0, "protein")
        return None

    monkeypatch.setattr("app.llm.food_query_from_phrase_llm", fake_food_query)
    monkeypatch.setattr("app.off_foods.lookup_food", fake_lookup)
    conn = db.get_connection()
    out = await resolve_item_for_db(conn, "סלמון מעושן")
    assert out is not None
    en, row = out
    assert en == "smoked salmon"
    assert float(row["kcal_per_100g"]) == 150.0
    assert seen == ["smoked salmon"]


async def test_resolve_latin_phrase_direct_lookup(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_lookup(q: str) -> FoodLookupResult | None:
        if q.lower() == "chicken breast":
            return FoodLookupResult(165.0, 31.0, 150.0, "protein")
        return None

    monkeypatch.setattr("app.off_foods.lookup_food", fake_lookup)
    conn = db.get_connection()
    out = await resolve_item_for_db(conn, "chicken breast")
    assert out is not None
    en, _row = out
    assert en == "chicken breast"


async def test_resolve_hebrew_llm_failure_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom_food_query(_phrase: str) -> str:
        raise RuntimeError("network")

    monkeypatch.setattr("app.llm.food_query_from_phrase_llm", boom_food_query)
    conn = db.get_connection()
    out = await resolve_item_for_db(conn, "סלמון מעושן")
    assert out is None
