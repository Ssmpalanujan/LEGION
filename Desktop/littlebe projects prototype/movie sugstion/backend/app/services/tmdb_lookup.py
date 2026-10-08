"""TMDB lookups (videos) with Redis caching. Degraded without TMDB_API_KEY."""
import json
import urllib.request

from app.core import cache as cache_mod
from app.core.config import get_settings

BASE = "https://api.themoviedb.org/3"
TTL_TMDB = 3600


def _get(path: str) -> dict | None:
    key = get_settings().tmdb_api_key
    if not key:
        return None
    ck = cache_mod.key("tmdb", path=path)
    hit = cache_mod.get_json(ck)
    if hit is not None:
        return hit
    try:
        with urllib.request.urlopen(f"{BASE}{path}?api_key={key}&language=en-US", timeout=15) as r:
            payload = json.loads(r.read().decode())
        cache_mod.set_json(ck, payload, TTL_TMDB)
        return payload
    except Exception:
        return None


def youtube_trailer_key(tmdb_id: int) -> str | None:
    """Prefer Official Trailer, then Trailer, then Teaser (YouTube only)."""
    payload = _get(f"/movie/{tmdb_id}/videos")
    if not payload:
        return None
    vids = [v for v in payload.get("results", []) if v.get("site") == "YouTube"]
    for kind in ("Official Trailer", "Trailer", "Teaser"):
        for v in vids:
            if v.get("type") == kind and v.get("key"):
                return v["key"]
    return vids[0].get("key") if vids else None
