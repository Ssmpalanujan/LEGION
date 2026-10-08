"""Hybrid + explainable-light routes (Phase 2; reasons fully added in Phase 4)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.schemas.movie import movie_to_out
from app.services import hybrid as svc_hybrid
from app.services.store import MovieNotFoundError, all_movies, find_best_match

router = APIRouter()


@router.get("/recommend/hybrid")
def recommend_hybrid(
    movie_id: int | None = Query(None, description="DB movie id"),
    title: str | None = Query(None, description="Title fallback (partial match)"),
    alpha: float = Query(0.5, ge=0.0, le=1.0, description="1=content, 0=collab"),
    n: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    if movie_id is None and not title:
        raise HTTPException(status_code=422, detail="Provide movie_id or title.")
    try:
        movies = all_movies(db)
        if movie_id is not None:
            target, ranked = svc_hybrid.hybrid_by_id(movies, movie_id, alpha=alpha, n=n)
        else:
            target = find_best_match(db, title or "")
            ranked = svc_hybrid.hybrid_for_movie(movies, target, alpha=alpha, n=n)
    except MovieNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {
        "query": title or movie_id,
        "matched_title": target.title,
        "matched": movie_to_out(target),
        "alpha": alpha,
        "recommendations": [m.title for m, _, _, _ in ranked],
        "items": [
            {
                **movie_to_out(m).model_dump(),
                "content_score": round(cs, 4),
                "collab_score": round(ks, 4),
                "hybrid_score": round(hs, 4),
            }
            for m, cs, ks, hs in ranked
        ],
    }
