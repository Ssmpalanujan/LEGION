"""Trailers (Phase 6): GET /movies/{id}/trailer -> YouTube key.

Resolution order: stored trailer_key -> TMDB videos API (then persisted) ->
404 with a degraded-mode message when TMDB_API_KEY is missing.
Frontend embeds via the privacy-enhanced YouTube domain (youtube-nocookie).
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core import cache as cache_mod
from app.core.config import get_settings
from app.models.db import get_db
from app.models.entities import Movie
from app.services import tmdb_lookup

router = APIRouter()
TTL_TRAILER = 3600


@router.get("/movies/{movie_id}/trailer")
def movie_trailer(movie_id: int, response: Response, db: Session = Depends(get_db)):
    ck = cache_mod.key("trailer", movie_id=movie_id)
    hit = cache_mod.get_json(ck)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
    m = db.query(Movie).filter(Movie.id == movie_id).first()
    if m is None:
        raise HTTPException(status_code=404, detail=f"Movie id {movie_id} not found.")
    key = m.trailer_key or None
    source = "db"
    if not key:
        if m.tmdb_id and get_settings().tmdb_api_key:
            key = tmdb_lookup.youtube_trailer_key(m.tmdb_id)
            source = "tmdb"
            if key:
                m.trailer_key = key
                db.commit()
    if not key:
        raise HTTPException(
            status_code=404,
            detail="No trailer stored for this title and TMDB lookup unavailable "
            "(TMDB_API_KEY missing or no videos) — degraded mode.",
        )
    data = {
        "movie_id": m.id,
        "title": m.title,
        "youtube_key": key,
        "embed_url": f"https://www.youtube-nocookie.com/embed/{key}",
        "watch_url": f"https://www.youtube.com/watch?v={key}",
        "source": source,
    }
    cache_mod.set_json(ck, data, TTL_TRAILER)
    response.headers["X-Cache"] = "MISS"
    return data
