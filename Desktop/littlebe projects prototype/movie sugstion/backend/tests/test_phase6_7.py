"""Phase 6+7 tests: trailer resolution + Redis HIT/MISS + invalidation."""
import os
import sys
import time
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cinematch.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import cache as cache_mod  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.db import SessionLocal, init_db  # noqa: E402
from app.models.entities import Movie, User  # noqa: E402

init_db()
client = TestClient(create_app())
cache_mod.reset_client()

ADMIN_EMAIL = f"admin67_{int(time.time())}@example.com"


def _auth(email, pw="secret123"):
    r = client.post("/auth/register", json={"email": email, "password": pw})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_trailer_degraded_404_without_key():
    db = SessionLocal()
    try:
        m = db.query(Movie).filter(Movie.title.like("Toy Story (1995)%")).first()
        m.trailer_key = ""
        db.commit()
        mid = m.id
    finally:
        db.close()
    cache_mod.invalidate()
    r = client.get(f"/movies/{mid}/trailer")
    assert r.status_code == 404
    assert "degraded" in r.json()["detail"]


def test_trailer_stored_key_hit_miss():
    db = SessionLocal()
    try:
        m = db.query(Movie).filter(Movie.title.like("Toy Story (1995)%")).first()
        m.trailer_key = "dQw4w9WgXcQ"
        db.commit()
        mid = m.id
    finally:
        db.close()
    cache_mod.invalidate()
    r1 = client.get(f"/movies/{mid}/trailer")
    assert r1.status_code == 200
    assert r1.headers.get("X-Cache") == "MISS"
    assert r1.json()["youtube_key"] == "dQw4w9WgXcQ"
    assert "youtube-nocookie" in r1.json()["embed_url"]
    r2 = client.get(f"/movies/{mid}/trailer")
    assert r2.headers.get("X-Cache") == "HIT"
    assert r2.json() == r1.json()
    # cleanup so other runs stay deterministic
    db = SessionLocal()
    try:
        db.query(Movie).filter(Movie.id == mid).first().trailer_key = ""
        db.commit()
    finally:
        db.close()


def test_search_cache_hit_miss_and_key_params():
    cache_mod.invalidate()
    p = {"q": "Zyzzyva Unmatched", "n": 7}
    r1 = client.get("/search", params=p)
    assert r1.headers.get("X-Cache") == "MISS"
    r2 = client.get("/search", params=p)
    assert r2.headers.get("X-Cache") == "HIT"
    assert r2.json() == r1.json()
    # different params -> different key -> MISS
    r3 = client.get("/search", params={"q": "Zyzzyva Unmatched", "n": 8})
    assert r3.headers.get("X-Cache") == "MISS"


def test_recommend_hybrid_semantic_cached():
    cache_mod.invalidate()
    for url, params in [
        ("/recommend", {"title": "Jumanji", "n": 3}),
        ("/recommend/hybrid", {"title": "Jumanji", "alpha": 0.5, "n": 3}),
        ("/search/semantic", {"q": "jungle board game adventure", "n": 3}),
        ("/recommend/mood", {"mood": "thrilling", "n": 3}),
    ]:
        a = client.get(url, params=params)
        assert a.status_code == 200, url
        assert a.headers.get("X-Cache") == "MISS", url
        b = client.get(url, params=params)
        assert b.headers.get("X-Cache") == "HIT", url
        assert b.json() == a.json(), url


def test_admin_cache_clear_requires_admin_and_invalidates():
    # anonymous + non-admin forbidden
    assert client.delete("/admin/cache").status_code in (401, 403)
    head = _auth(f"user67_{int(time.time())}@example.com")
    assert client.delete("/admin/cache", headers=head).status_code == 403
    # promote to admin
    ahead = _auth(ADMIN_EMAIL)
    db = SessionLocal()
    try:
        db.query(User).filter(User.email == ADMIN_EMAIL).first().is_admin = True
        db.commit()
    finally:
        db.close()
    p = {"q": "Grumpier Old Men", "n": 2}
    client.get("/search", params=p)
    assert client.get("/search", params=p).headers.get("X-Cache") == "HIT"
    r = client.delete("/admin/cache", headers=ahead)
    assert r.status_code == 200 and r.json()["ok"] is True
    assert client.get("/search", params=p).headers.get("X-Cache") == "MISS"
