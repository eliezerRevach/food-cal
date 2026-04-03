"""Unit tests for OpenRouter assistant message text extraction."""

from __future__ import annotations

import pytest

from app.llm import _assistant_text, _extract_llm_reply_text


def test_assistant_text_none() -> None:
    with pytest.raises(ValueError, match="null"):
        _assistant_text(None)


def test_assistant_text_empty_list() -> None:
    with pytest.raises(ValueError, match="empty list"):
        _assistant_text([])


def test_extract_prefers_content_over_reasoning() -> None:
    msg = {
        "role": "assistant",
        "content": '{"items":[],"estimate_type":"estimated","calories_likely":1,"calories_low":1,"calories_high":1,"total_protein_g":1}',
        "reasoning": "ignore this",
    }
    out = _extract_llm_reply_text(msg, "stop")
    assert '"items"' in out


def test_extract_uses_reasoning_when_content_null() -> None:
    payload = '{"items":[{"food":"x","grams":100}],"estimate_type":"estimated","calories_likely":400,"calories_low":300,"calories_high":500,"total_protein_g":20}'
    msg = {"role": "assistant", "content": None, "reasoning": payload}
    out = _extract_llm_reply_text(msg, "stop")
    assert out == payload


def test_extract_raises_helpful_when_empty() -> None:
    msg = {"role": "assistant", "content": None}
    with pytest.raises(ValueError, match="OPENROUTER_HTTP_REFERER"):
        _extract_llm_reply_text(msg, "stop")
