"""Mood mode: GET /recommend/mood?mood=...&n=10 (config in core/mood_config.json)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core import cache as cache_mod
from app.models.db import get_db
from app.schemas.movie import movie_to_out
from app.services import explain as svc_explain
from app.services.store import all_movies

router = APIRouter()
TTL_MOOD = 600


@router.get("/recommend/mood")
def recommend_mood(
    response: Response,
    mood: str = Query(..., description="happy|sad|bored|romantic|thrilling|family"),
    n: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    mood = mood.strip().lower()
    ck = cache_mod.key("mood", mood=mood, n=n)
    hit = cache_mod.get_json(ck)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
    try:
        ranked = svc_explain.mood_movies(all_movies(db), mood, n=n)
    except KeyError:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown mood '{mood}'. Choose from: {', '.join(sorted(svc_explain.MOODS))}.",
        )
    data = {
        "mood": mood,
        "recommendations": [m.title for m, _ in ranked],
        "items": [
            {**movie_to_out(m).model_dump(), "reasons": reasons} for m, reasons in ranked
        ],
    }
    cache_mod.set_json(ck, data, TTL_MOOD)
    response.headers["X-Cache"] = "MISS"
    return data
