"""Phase-2 tests: hybrid endpoint, alpha extremes, cold-start fallback."""
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cinematch.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app  # noqa: E402
from app.models.db import SessionLocal, init_db  # noqa: E402
from app.models.entities import Movie  # noqa: E402
from app.services import content as svc_content  # noqa: E402
from app.services import collab as svc_collab  # noqa: E402
from app.services import hybrid as svc_hybrid  # noqa: E402
from app.services.store import all_movies  # noqa: E402

init_db()
client = TestClient(create_app())


def _movies():
    db = SessionLocal()
    try:
        return all_movies(db)
    finally:
        db.close()


def test_hybrid_endpoint_ok():
    r = client.get("/search", params={"q": "Toy Story", "n": 1})
    mid = r.json()["results"][0]["id"]
    r = client.get("/recommend/hybrid", params={"movie_id": mid, "alpha": 0.5, "n": 5})
    assert r.status_code == 200
    data = r.json()
    assert len(data["items"]) == 5
    item = data["items"][0]
    assert {"content_score", "collab_score", "hybrid_score"} <= set(item)


def test_alpha_validation_and_missing_params():
    assert client.get("/recommend/hybrid", params={"alpha": 2}).status_code in (404, 422)
    r = client.get("/recommend/hybrid")
    assert r.status_code == 422
    r = client.get("/recommend/hybrid", params={"movie_id": 99999999})
    assert r.status_code == 404


def test_alpha1_equals_content_order():
    movies = _movies()
    target = next(m for m in movies if "Toy Story (1995)" in m.title)
    _, ranked = svc_hybrid.hybrid_by_id(movies, target.id, alpha=1.0, n=5)
    idx = movies.index(target)
    expected = [movies[i].id for i, _ in content_order(movies, idx)[:5]]
    assert [m.id for m, _, _, _ in ranked] == expected


def content_order(movies, idx):
    return svc_content.content_scores(movies, idx)


def test_alpha0_equals_collab_order():
    movies = _movies()
    target = next(m for m in movies if "Toy Story (1995)" in m.title)
    _, ranked = svc_hybrid.hybrid_by_id(movies, target.id, alpha=0.0, n=5)
    k = svc_collab.collab_scores([m.movielens_id for m in movies], target.movielens_id)
    norm = max(k.values()) if k else 1.0
    expected = [p for p in sorted(k, key=lambda p: k[p], reverse=True)[:5]]
    got = [movies.index(m) for m, _, _, _ in ranked]
    # collab-normalized ordering must match (both min-max normalized identically)
    assert got == expected
    assert norm > 0


def test_cold_start_falls_back_to_content():
    db = SessionLocal()
    try:
        cold = Movie(title="ZZZ Cold Start Test (2099)", original_title="ZZZ Cold Start Test (2099)",
                     genres="Documentary", year="2099", original_language="en", movielens_id=None)
        db.add(cold)
        db.commit()
        db.refresh(cold)
        movies = all_movies(db)
        target = next(m for m in movies if m.title.startswith("ZZZ Cold Start"))
        _, ranked = svc_hybrid.hybrid_by_id(movies, target.id, alpha=0.0, n=5)
        assert len(ranked) == 5  # content fallback, not empty
        assert all(ks == 0.0 for _, _, ks, _ in ranked)
    finally:
        db.query(Movie).filter(Movie.title.like("ZZZ Cold Start%")).delete()
        db.commit()
        db.close()
