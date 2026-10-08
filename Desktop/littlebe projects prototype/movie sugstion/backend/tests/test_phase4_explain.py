"""Phase-4 tests: explanation structure, mood mapping, mood endpoint."""
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cinematch.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app  # noqa: E402
from app.models.db import SessionLocal, init_db  # noqa: E402
from app.services import explain as svc  # noqa: E402
from app.services.store import all_movies  # noqa: E402

init_db()
client = TestClient(create_app())
MOODS = ["happy", "sad", "bored", "romantic", "thrilling", "family"]


def test_explanation_structure_from_recommend():
    r = client.get("/recommend", params={"title": "Toy Story", "n": 3})
    assert r.status_code == 200
    for item in r.json()["items"]:
        assert isinstance(item["reasons"], list) and len(item["reasons"]) >= 1
        assert set(item["breakdown"]) >= {"content", "collab"}
        assert isinstance(item["friendly"], str) and len(item["friendly"]) > 10


def test_hybrid_explanations_include_collab_reason():
    r = client.get("/search", params={"q": "Toy Story", "n": 1})
    mid = r.json()["results"][0]["id"]
    r = client.get("/recommend/hybrid", params={"movie_id": mid, "alpha": 0.0, "n": 5})
    assert r.status_code == 200
    items = r.json()["items"]
    assert all("reasons" in i and "friendly" in i and "hybrid" in i["breakdown"] for i in items)
    # Pure-collab top hit must carry the "users who liked" reason
    assert any("also liked this" in x for i in items for x in i["reasons"])


def test_mood_config_covers_all_moods():
    assert set(MOODS) <= set(svc.MOODS)
    for m in MOODS:
        assert len(svc.MOODS[m]["genres"]) > 0


def test_mood_endpoint_all_moods_return_results():
    for mood in MOODS:
        r = client.get("/recommend/mood", params={"mood": mood, "n": 5})
        assert r.status_code == 200, mood
        data = r.json()
        assert data["mood"] == mood
        assert len(data["items"]) == 5
        assert all("reasons" in i and mood in i["reasons"][0] for i in data["items"])


def test_mood_invalid_422():
    r = client.get("/recommend/mood", params={"mood": "sleepy"})
    assert r.status_code == 422
    assert "happy" in r.json()["detail"]


def test_template_friendly_without_api_key():
    db = SessionLocal()
    try:
        movies = all_movies(db)
        a = next(m for m in movies if "Toy Story (1995)" in m.title)
        b = next(m for m in movies if "Toy Story 2 (1999)" in m.title)
        exp = svc.build_reasons(a, b, content_score=0.9)
        assert exp["friendly"].startswith("Because you watched")
    finally:
        db.close()
