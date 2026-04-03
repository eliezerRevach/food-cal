"""Live USDA FoodData Central; opt-in when USDA_FDC_API_KEY is set (no OFF/USDA stub)."""

from __future__ import annotations

import os

import pytest

from app.usda_fdc import lookup_food_usda

pytestmark = [pytest.mark.integration, pytest.mark.live_usda]

_KEY = (os.environ.get("USDA_FDC_API_KEY") or "").strip()
_DISABLED = os.environ.get("USDA_FDC_DISABLED", "").lower() in ("1", "true", "yes")
_SKIP = not _KEY or _DISABLED
_SKIP_REASON = "Set USDA_FDC_API_KEY and unset USDA_FDC_DISABLED to run live USDA tests"


@pytest.mark.skipif(_SKIP, reason=_SKIP_REASON)
async def test_lookup_food_usda_apple_smoke() -> None:
    """FDC search top hit for a short query can vary (raw vs prepared); assert a usable NLEA-like row."""
    meta = await lookup_food_usda("apple")
    assert meta is not None
    assert meta.kcal_per_100g > 0
    assert meta.protein_per_100g >= 0
    assert meta.kcal_per_100g <= 900.0


@pytest.mark.skipif(_SKIP, reason=_SKIP_REASON)
async def test_log_meal_structured_apple_no_llm(
    client,
    today_iso: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def boom_llm(_text: str) -> dict:
        raise AssertionError("LLM must not run for 200g apple with USDA/OFF/fallback")

    monkeypatch.setattr("app.llm.parse_meal_with_llm", boom_llm)

    log_r = await client.post(
        "/log-meal",
        json={"text": "200g apple", "date": today_iso},
    )
    assert log_r.status_code == 200, log_r.text
    logged = log_r.json()
    assert logged.get("estimate_type") is None
    assert logged["total_calories"] > 0


@pytest.mark.skipif(_SKIP, reason=_SKIP_REASON)
async def test_log_meal_bare_banana_no_llm(
    client,
    today_iso: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def boom_llm(_text: str) -> dict:
        raise AssertionError("LLM must not run for bare English banana")

    monkeypatch.setattr("app.llm.parse_meal_with_llm", boom_llm)

    log_r = await client.post(
        "/log-meal",
        json={"text": "banana", "date": today_iso},
    )
    assert log_r.status_code == 200, log_r.text
    logged = log_r.json()
    assert logged.get("estimate_type") is None
    assert logged["total_calories"] > 0
