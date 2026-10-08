"""Phase-8 tests: room REST logic + WebSocket broadcast with 2 simulated clients."""
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
STAMP = int(time.time())


def _user(tag):
    r = client.post("/auth/register", json={"email": f"room8_{tag}_{STAMP}@example.com", "password": "secret123"})
    assert r.status_code == 201, r.text
    toks = r.json()
    return {"Authorization": f"Bearer {toks['access_token']}"}, toks["access_token"]


H1, TOK1 = _user("a")
H2, TOK2 = _user("b")
H3, TOK3 = _user("c")
H4, TOK4 = _user("d")
H5, TOK5 = _user("e")


def test_create_join_and_code_format():
    r = client.post("/rooms", headers=H1)
    assert r.status_code == 201
    room = r.json()
    assert len(room["code"]) == 6 and room["code"].isalnum()
    assert len(room["deck"]) == 20
    assert room["participants"] == [room["participants"][0]]
    # join unknown code 404
    assert client.post("/rooms/ZZZZZZ/join", headers=H2).status_code == 404
    # join ok
    r = client.post(f"/rooms/{room['code']}/join", headers=H2)
    assert r.status_code == 200
    assert len(r.json()["participants"]) == 2
    # state forbidden for outsider
    assert client.get(f"/rooms/{room['code']}", headers=H3).status_code == 403
    assert client.get(f"/rooms/{room['code']}", headers=H1).status_code == 200


def test_room_full_at_four():
    r = client.post("/rooms", headers=H1).json()
    code = r["code"]
    for h in (H2, H3, H4):
        assert client.post(f"/rooms/{code}/join", headers=h).status_code == 200
    assert client.post(f"/rooms/{code}/join", headers=H5).status_code == 409


def _drain_until_result(ws, cap=200):
    for _ in range(cap):
        msg = ws.receive_json()
        if msg.get("type") == "result":
            return msg
    raise AssertionError("no result broadcast received")


def test_websocket_two_clients_shared_deck_and_result():
    code = client.post("/rooms", headers=H1).json()["code"]
    client.post(f"/rooms/{code}/join", headers=H2)
    deck = [m["id"] for m in client.get(f"/rooms/{code}", headers=H1).json()["deck"]]
    assert len(deck) == 20
    with client.websocket_connect(f"/ws/rooms/{code}?token={TOK1}") as ws1:
        with client.websocket_connect(f"/ws/rooms/{code}?token={TOK2}") as ws2:
            # both swipe the full deck: agree on deck[0], disagree elsewhere
            for i, mid in enumerate(deck):
                ws1.send_json({"type": "swipe", "movie_id": mid, "liked": True})
                ws2.send_json({"type": "swipe", "movie_id": mid, "liked": i == 0})
            res1 = _drain_until_result(ws1)
            res2 = _drain_until_result(ws2)
    assert res1["movie"]["id"] == res2["movie"]["id"] == deck[0]
    assert res1["likes"] == 2 and res1["of"] == 2
    assert isinstance(res1["explanation"], str) and "2/2" in res1["explanation"]
    # room finished: further swipes rejected, state shows result
    state = client.get(f"/rooms/{code}", headers=H1).json()
    assert state["status"] == "finished"
    assert state["result_movie_id"] == deck[0]
