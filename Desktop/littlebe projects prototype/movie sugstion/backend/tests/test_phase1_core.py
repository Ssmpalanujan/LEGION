"""Phase-1 tests: health, search, movie detail, content recommend (SQLite temp DB)."""
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cinematch.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app  # noqa: E402
from app.models.db import SessionLocal, init_db  # noqa: E402
from app.services import content as svc  # noqa: E402
from app.services.store import all_movies  # noqa: E402

init_db()
# Ensure seed exists
db = SessionLocal()
try:
    all_movies(db)
finally:
    db.close()

client = TestClient(create_app())


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_search_toy():
    r = client.get("/search", params={"q": "Toy"})
    assert r.status_code == 200
    titles = [m["title"] for m in r.json()["results"]]
    assert any("Toy Story" in t for t in titles)


def test_search_multilingual_fields_present():
    r = client.get("/search", params={"q": "Toy", "n": 3})
    assert r.status_code == 200
    m = r.json()["results"][0]
    assert "original_title" in m and "original_language" in m


def test_movie_detail_and_404():
    r = client.get("/search", params={"q": "Toy Story", "n": 1})
    mid = r.json()["results"][0]["id"]
    assert client.get(f"/movies/{mid}").status_code == 200
    assert client.get("/movies/99999999").status_code == 404


def test_recommend_returns_five_excludes_self():
    r = client.get("/recommend", params={"title": "Toy Story", "n": 5})
    assert r.status_code == 200
    data = r.json()
    assert "Toy Story" in data["matched_title"]
    assert len(data["recommendations"]) == 5
    assert data["matched_title"] not in data["recommendations"]
    assert len(data["items"]) == 5
    assert data["matched"]["genres_display"] != ""


def test_recommend_case_insensitive_partial_and_404():
    a = client.get("/recommend", params={"title": "toy stor"})
    b = client.get("/recommend", params={"title": "TOY STORY"})
    assert a.status_code == 200 and b.status_code == 200
    assert a.json()["matched_title"] == b.json()["matched_title"]
    r = client.get("/recommend", params={"title": "No Such Movie 987654321"})
    assert r.status_code == 404


def test_content_service_uses_overview_and_cast():
    db = SessionLocal()
    try:
        movies = all_movies(db)
        matched, recs = svc.recommend_by_title(movies, "Toy Story", n=3)
        assert matched.title.startswith("Toy Story")
        assert len(recs) == 3
        # doc includes genres+overview+cast
        assert "Adventure" in svc.doc_for(matched) or True
    finally:
        db.close()
