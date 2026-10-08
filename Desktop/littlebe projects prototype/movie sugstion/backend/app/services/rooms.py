"""Movie Night room logic + Redis pub/sub bus (works across API instances).

Transport: async Redis client (real redis.asyncio, else fakeredis sharing one
FakeServer with the sync client). Every event is PUBLISHed to `room:{code}`;
each instance runs one subscriber task per active room that forwards channel
messages to its local WebSocket set. Single delivery path -> no duplicates.
"""
import asyncio
import json
import random
import string
from collections import defaultdict

from fastapi import WebSocket

_async_client = None
_fake_server = None
_local: dict[str, set] = defaultdict(set)
_listeners: dict[str, object] = {}


def channel(code: str) -> str:
    return f"room:{code.upper()}"


def get_fake_server():
    global _fake_server
    if _fake_server is None:
        from fakeredis import FakeServer

        _fake_server = FakeServer()
    return _fake_server


async def get_async_client():
    global _async_client
    if _async_client is not None:
        return _async_client
    try:
        import redis.asyncio as aioredis

        from app.core.config import get_settings

        c = aioredis.from_url(get_settings().redis_url, socket_connect_timeout=2)
        await c.ping()
        _async_client = c
        return c
    except Exception:
        from fakeredis.aioredis import FakeRedis

        _async_client = FakeRedis(server=get_fake_server(), decode_responses=True)
        return _async_client


def new_code(n: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(n))


def participants_of(room) -> list[int]:
    try:
        return [int(x) for x in json.loads(room.participants or "[]")]
    except Exception:
        return []


def deck_of(room) -> list[int]:
    try:
        return [int(x) for x in json.loads(room.deck or "[]")]
    except Exception:
        return []


def build_deck(db, size: int = 20) -> list[int]:
    from app.models.entities import Movie

    ids = [r[0] for r in db.query(Movie.id).order_by(Movie.id).all()]
    if len(ids) <= size:
        return ids
    stride = len(ids) / size
    return [ids[int(i * stride)] for i in range(size)]


def group_pick(db, room):
    """Max likes wins; ties broken by average taste similarity. Returns (movie, likes, total, explanation)."""
    from app.models.entities import Movie, RoomSwipe
    from app.services import taste as svc_taste

    deck = deck_of(room)
    users = participants_of(room)
    likes: dict[int, int] = {mid: 0 for mid in deck}
    for s in db.query(RoomSwipe).filter(RoomSwipe.room_id == room.id, RoomSwipe.liked.is_(True)).all():
        if s.movie_id in likes:
            likes[s.movie_id] += 1
    best_n = max(likes.values()) if likes else 0
    tied = [mid for mid, c in likes.items() if c == best_n] or deck[:1]
    vecs = {u: svc_taste.taste_vector(db, u) for u in users}
    scored = []
    for mid in tied:
        m = db.query(Movie).filter(Movie.id == mid).first()
        avg = sum(svc_taste.score_movie(m, vecs[u]) for u in users) / max(1, len(users)) if m else 0.0
        scored.append((avg, mid))
    scored.sort(reverse=True)
    winner = db.query(Movie).filter(Movie.id == scored[0][1]).first()
    genres = [g.strip() for g in (winner.genres or "").split(",") if g.strip()][:3] if winner else []
    expl = (
        f"Liked by {best_n}/{len(users)}" + (f" — top shared genres: {', '.join(genres)}" if genres else "")
    )
    return winner, best_n, len(users), expl


def finished_map(db, room) -> dict[int, bool]:
    from app.models.entities import RoomSwipe

    deck = set(deck_of(room))
    done: dict[int, bool] = {}
    for u in participants_of(room):
        swiped = {s.movie_id for s in db.query(RoomSwipe).filter(RoomSwipe.room_id == room.id, RoomSwipe.user_id == u).all()}
        done[u] = bool(deck) and deck <= swiped
    return done


async def publish(code: str, msg: dict) -> None:
    c = await get_async_client()
    await c.publish(channel(code), json.dumps(msg, default=str))


def publish_sync(code: str, msg: dict) -> None:
    """Best-effort publish from sync (REST) context sharing the FakeServer."""
    try:
        from app.core.config import get_settings

        try:
            import redis

            c = redis.Redis.from_url(get_settings().redis_url, socket_connect_timeout=1)
            c.publish(channel(code), json.dumps(msg, default=str))
            return
        except Exception:
            from fakeredis import FakeRedis

            FakeRedis(server=get_fake_server(), decode_responses=True).publish(channel(code), json.dumps(msg, default=str))
    except Exception:
        pass


async def ensure_listener(code: str) -> None:
    code = code.upper()
    if code in _listeners:
        return
    _listeners[code] = asyncio.create_task(_listen(code))


async def _listen(code: str) -> None:
    c = await get_async_client()
    pubsub = c.pubsub()
    await pubsub.subscribe(channel(code))
    try:
        async for raw in pubsub.listen():
            if raw.get("type") != "message":
                continue
            try:
                msg = json.loads(raw["data"])
            except Exception:
                continue
            for ws in list(_local.get(code, set())):
                try:
                    await ws.send_json(msg)
                except Exception:
                    pass
    finally:
        try:
            await pubsub.unsubscribe(channel(code))
        except Exception:
            pass


async def ws_connect(code: str, ws: WebSocket) -> None:
    code = code.upper()
    await ws.accept()
    _local[code].add(ws)
    await ensure_listener(code)


def ws_disconnect(code: str, ws: WebSocket) -> None:
    _local.get(code.upper(), set()).discard(ws)
