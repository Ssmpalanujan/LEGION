"""Redis cache with in-memory fallback.

Decision: the suite must run without services, so if REDIS_URL is unreachable
we use fakeredis (same API, process-local). Tests therefore exercise the real
HIT/MISS code path. Cache keys always include every request parameter.
"""
import json
from functools import lru_cache

_client = None


def get_client():
    global _client
    if _client is not None:
        return _client
    try:
        import redis

        from app.core.config import get_settings

        c = redis.Redis.from_url(get_settings().redis_url, socket_connect_timeout=2)
        c.ping()
        _client = c
        return _client
    except Exception:
        import fakeredis

        _client = fakeredis.FakeRedis(decode_responses=True)
        return _client


def reset_client() -> None:
    """Test helper: drop the singleton so each test module starts clean."""
    global _client
    _client = None


def key(prefix: str, **params) -> str:
    parts = [f"{k}={params[k]}" for k in sorted(params)]
    return f"cinematch:{prefix}:" + ":".join(parts)


def get_json(k: str):
    try:
        raw = get_client().get(k)
    except Exception:
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def set_json(k: str, value, ttl: int) -> None:
    try:
        get_client().setex(k, ttl, json.dumps(value, default=str))
    except Exception:
        pass


def invalidate(prefix: str = "cinematch:") -> int:
    """Delete keys under prefix (re-ingest invalidation + admin clear)."""
    try:
        c = get_client()
        keys = list(c.scan_iter(f"{prefix}*"))
        if keys:
            return int(c.delete(*keys))
        return 0
    except Exception:
        return 0


@lru_cache(maxsize=1)
def using_real_redis() -> bool:
    try:
        get_client().ping()
        import redis  # noqa: F401

        return type(get_client()).__module__.startswith("redis")
    except Exception:
        return False
