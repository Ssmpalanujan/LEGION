"""Mood mode: GET /recommend/mood?mood=...&n=10 (config in core/mood_config.json)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.schemas.movie import movie_to_out
from app.services import explain as svc_explain
from app.services.store import all_movies

router = APIRouter()


@router.get("/recommend/mood")
def recommend_mood(
    mood: str = Query(..., description="happy|sad|bored|romantic|thrilling|family"),
    n: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    try:
        ranked = svc_explain.mood_movies(all_movies(db), mood.strip().lower(), n=n)
    except KeyError:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown mood '{mood}'. Choose from: {', '.join(sorted(svc_explain.MOODS))}.",
        )
    return {
        "mood": mood.strip().lower(),
        "recommendations": [m.title for m, _ in ranked],
        "items": [
            {**movie_to_out(m).model_dump(), "reasons": reasons} for m, reasons in ranked
        ],
    }
