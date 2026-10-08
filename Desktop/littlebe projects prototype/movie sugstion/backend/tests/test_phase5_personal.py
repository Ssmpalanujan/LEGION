"""Phase-5 tests: auth flows, swipe->next updates, watchlist, taste, for-you."""
import os
import sys
import time
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cinematch.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app  # noqa: E402
from app.models.db import init_db  # noqa: E402

init_db()
client = TestClient(create_app())
EMAIL = f"phase5_{int(time.time())}@example.com"
PW = "secret123"
HEAD = {}


def _register():
    r = client.post("/auth/register", json={"email": EMAIL, "password": PW})
    assert r.status_code == 201, r.text
    toks = r.json()
    HEAD["Authorization"] = f"Bearer {toks['access_token']}"
    return toks


def test_register_login_refresh_me():
    toks = _register()
    assert toks["token_type"] == "bearer"
    # duplicate
    assert client.post("/auth/register", json={"email": EMAIL, "password": PW}).status_code == 409
    # login ok + bad password
    r = client.post("/auth/login", json={"email": EMAIL, "password": PW})
    assert r.status_code == 200
    assert client.post("/auth/login", json={"email": EMAIL, "password": "wrongpw1"}).status_code == 401
    # refresh + me
    r = client.post("/auth/refresh", json={"refresh_token": toks["refresh_token"]})
    assert r.status_code == 200
    HEAD["Authorization"] = f"Bearer {r.json()['access_token']}"
    r = client.get("/auth/me", headers=HEAD)
    assert r.status_code == 200 and r.json()["email"] == EMAIL
    # no token -> 401/403
    assert client.get("/auth/me").status_code in (401, 403)


def _movie_id(q="Toy Story"):
    return client.get("/search", params={"q": q, "n": 1}).json()["results"][0]["id"]


def test_swipe_and_next_uses_taste_vector():
    _register() if not HEAD else None
    mid = _movie_id()
    r = client.get("/swipes/next", headers=HEAD)
    first_card = r.json()["card"]["id"]
    # Like an Animation movie; next card must change and vector must mention Animation
    r = client.post("/swipes", json={"movie_id": mid, "liked": True}, headers=HEAD)
    assert r.status_code == 201
    assert "Animation" in (r.json()["taste_vector"] or {})
    r = client.get("/swipes/next", headers=HEAD)
    assert r.json()["card"]["id"] != mid
    assert r.json()["reason"] == "Picked from your taste vector"
    assert first_card is not None


def test_swipe_unknown_movie_404():
    r = client.post("/swipes", json={"movie_id": 99999999, "liked": True}, headers=HEAD)
    assert r.status_code == 404


def test_watchlist_crud():
    mid = _movie_id("Matrix")
    assert client.get("/watchlist", headers=HEAD).json()["items"] == []
    assert client.post(f"/watchlist/{mid}", headers=HEAD).status_code == 201
    items = client.get("/watchlist", headers=HEAD).json()["items"]
    assert len(items) == 1 and items[0]["id"] == mid
    assert client.delete(f"/watchlist/{mid}", headers=HEAD).status_code == 200
    assert client.get("/watchlist", headers=HEAD).json()["items"] == []
    assert client.delete(f"/watchlist/{mid}", headers=HEAD).status_code == 404


def test_taste_profile_and_for_you():
    r = client.get("/profile/taste", headers=HEAD)
    assert r.status_code == 200
    data = r.json()
    assert {"genre_percent", "top_languages", "decades", "liked_count"} <= set(data)
    assert data["liked_count"] >= 1
    r = client.get("/recommend/for-you", params={"n": 5}, headers=HEAD)
    assert r.status_code == 200
    assert len(r.json()["items"]) == 5
    # for-you must not include swiped movies
    swiped = mid = _movie_id()
    assert all(i["id"] != swiped for i in r.json()["items"])
