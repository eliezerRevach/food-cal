"""Recipes CRUD, portion logging, and parse-ingredient API."""

import pytest


RECIPE_PAYLOAD = {
    "name": "Pasta with tomato sauce",
    "ingredients": [
        {"label": "pasta", "grams": 300.0, "calories": 393.0, "protein": 15.0},
        {"label": "tomato sauce", "grams": 500.0, "calories": 90.0, "protein": 4.0},
    ],
}


async def test_create_list_get_recipe(client) -> None:
    create_r = await client.post("/recipes", json=RECIPE_PAYLOAD)
    assert create_r.status_code == 200, create_r.text
    created = create_r.json()
    assert created["name"] == RECIPE_PAYLOAD["name"]
    assert created["batch_grams"] == 800.0
    assert created["total_calories"] == pytest.approx(483.0, abs=0.1)
    assert created["total_protein_g"] == pytest.approx(19.0, abs=0.01)
    assert len(created["ingredients"]) == 2
    rid = created["id"]

    list_r = await client.get("/recipes")
    assert list_r.status_code == 200
    recipes = list_r.json()["recipes"]
    assert any(r["id"] == rid for r in recipes)

    get_r = await client.get(f"/recipes/{rid}")
    assert get_r.status_code == 200
    assert get_r.json()["ingredients"][0]["label"] == "pasta"


async def test_log_recipe_portion_scales_macros(client, today_iso: str) -> None:
    create_r = await client.post("/recipes", json=RECIPE_PAYLOAD)
    rid = create_r.json()["id"]

    log_r = await client.post(
        "/log-recipe",
        json={"date": today_iso, "recipe_id": rid, "grams_eaten": 400.0},
    )
    assert log_r.status_code == 200, log_r.text
    logged = log_r.json()
    # 400 / 800 = 0.5 of 483 kcal, 19g protein
    assert logged["total_calories"] == pytest.approx(241.5, abs=0.2)
    assert logged["total_protein_g"] == pytest.approx(9.5, abs=0.05)
    assert "Pasta with tomato sauce (400" in logged["items"][0]["label"]

    ent_r = await client.get("/entries", params={"date": today_iso})
    entries = ent_r.json()["entries"]
    assert any("Pasta with tomato sauce" in e.get("name", "") for e in entries)


async def test_log_recipe_full_batch(client, today_iso: str) -> None:
    create_r = await client.post("/recipes", json=RECIPE_PAYLOAD)
    created = create_r.json()
    rid = created["id"]
    batch = created["batch_grams"]

    log_r = await client.post(
        "/log-recipe",
        json={"date": today_iso, "recipe_id": rid, "grams_eaten": batch},
    )
    assert log_r.status_code == 200, log_r.text
    logged = log_r.json()
    assert logged["total_calories"] == pytest.approx(created["total_calories"], abs=0.2)
    assert logged["total_protein_g"] == pytest.approx(created["total_protein_g"], abs=0.05)
    assert f"Pasta with tomato sauce ({batch}" in logged["items"][0]["label"]


async def test_parse_ingredient_local_chicken(client, monkeypatch) -> None:
    async def boom_llm(_text: str):
        raise AssertionError("LLM must not run for structured chicken breast")

    monkeypatch.setattr("app.llm.parse_meal_with_llm", boom_llm)

    r = await client.post(
        "/parse-ingredient",
        json={"text": "200g chicken breast", "llm_fallback": True},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["grams"] == pytest.approx(200.0, abs=0.1)
    assert "chicken" in data["name"].lower()
    assert data["calories"] > 0
    assert data["protein"] > 0


async def test_parse_ingredient_rejects_multi_segment(client, monkeypatch) -> None:
    async def boom_llm(_text: str):
        raise AssertionError("LLM must not run")

    monkeypatch.setattr("app.llm.parse_meal_with_llm", boom_llm)

    r = await client.post(
        "/parse-ingredient",
        json={"text": "200g chicken breast, 100g rice", "llm_fallback": False},
    )
    assert r.status_code == 422


async def test_delete_recipe(client) -> None:
    create_r = await client.post("/recipes", json=RECIPE_PAYLOAD)
    rid = create_r.json()["id"]
    del_r = await client.delete(f"/recipes/{rid}")
    assert del_r.status_code == 200
    get_r = await client.get(f"/recipes/{rid}")
    assert get_r.status_code == 404


async def test_backup_includes_recipes(client) -> None:
    await client.post("/recipes", json=RECIPE_PAYLOAD)
    ex = await client.get("/backup/export")
    assert ex.status_code == 200
    payload = ex.json()
    assert "recipes" in payload
    assert len(payload["recipes"]) >= 1
    assert payload["recipes"][0]["name"] == RECIPE_PAYLOAD["name"]
