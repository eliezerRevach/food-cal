"""Manual presets CRUD and history food suggest API."""

import pytest

from app.manual_presets import MAX_PRESETS


async def test_manual_preset_save_list_delete(client) -> None:
    create = await client.post(
        "/manual-presets",
        json={"name": "Chicken breast", "grams": 150, "calories": 248, "protein": 46.5},
    )
    assert create.status_code == 200, create.text
    body = create.json()
    assert body["name"] == "Chicken breast"
    assert body["grams"] == 150
    assert body["updated"] is False
    pid = body["id"]

    listed = await client.get("/manual-presets")
    assert listed.status_code == 200
    presets = listed.json()["presets"]
    assert any(p["id"] == pid for p in presets)

    filtered = await client.get("/manual-presets", params={"q": "chicken"})
    assert filtered.status_code == 200
    assert len(filtered.json()["presets"]) >= 1

    deleted = await client.delete(f"/manual-presets/{pid}")
    assert deleted.status_code == 200
    after = await client.get("/manual-presets")
    assert all(p["id"] != pid for p in after.json()["presets"])


async def test_manual_preset_upsert_same_signature(client) -> None:
    payload = {"name": "Rice", "grams": 100, "calories": 130, "protein": 2.7}
    first = await client.post("/manual-presets", json=payload)
    assert first.status_code == 200
    pid = first.json()["id"]

    second = await client.post("/manual-presets", json=payload)
    assert second.status_code == 200
    assert second.json()["updated"] is True
    assert second.json()["id"] == pid

    listed = await client.get("/manual-presets")
    rice = [p for p in listed.json()["presets"] if p["name"] == "Rice"]
    assert len(rice) == 1


async def test_manual_preset_cap(client) -> None:
    for i in range(MAX_PRESETS + 5):
        r = await client.post(
            "/manual-presets",
            json={
                "name": f"Food {i}",
                "grams": 10 + i,
                "calories": 50 + i,
                "protein": 1 + (i % 10),
            },
        )
        assert r.status_code == 200, r.text

    listed = await client.get("/manual-presets", params={"limit": 100})
    assert listed.status_code == 200
    assert len(listed.json()["presets"]) == MAX_PRESETS


async def test_history_food_suggest_dedupes(client, today_iso: str) -> None:
    payload = {
        "date": today_iso,
        "name": "Oats bowl",
        "grams": 200,
        "calories": 380,
        "protein": 14,
    }
    a = await client.post("/log-meal-manual", json=payload)
    b = await client.post("/log-meal-manual", json=payload)
    assert a.status_code == 200
    assert b.status_code == 200

    sug = await client.get("/history-food-suggest", params={"q": "oats"})
    assert sug.status_code == 200
    rows = sug.json()["suggestions"]
    oats = [
        r
        for r in rows
        if r["name"].lower() == "oats bowl"
        and r["grams"] == 200
        and r["calories"] == 380
        and r["protein"] == 14
    ]
    assert len(oats) == 1


async def test_history_food_suggest_empty_q_returns_recent(client, today_iso: str) -> None:
    await client.post(
        "/log-meal-manual",
        json={"date": today_iso, "name": "Banana", "grams": 118, "calories": 105, "protein": 1},
    )
    sug = await client.get("/history-food-suggest")
    assert sug.status_code == 200
    names = [r["name"] for r in sug.json()["suggestions"]]
    assert "Banana" in names
