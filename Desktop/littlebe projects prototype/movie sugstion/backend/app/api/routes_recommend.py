"""Hybrid + explainable-light routes (Phase 2; reasons fully added in Phase 4)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core import cache as cache_mod
from app.models.db import get_db
from app.schemas.movie import movie_to_out
from app.services import explain as svc_explain
from app.services import hybrid as svc_hybrid
from app.services.store import MovieNotFoundError, all_movies, find_best_match

router = APIRouter()
TTL_HYBRID = 600


@router.get("/recommend/hybrid")
def recommend_hybrid(
    response: Response,
    movie_id: int | None = Query(None, description="DB movie id"),
    title: str | None = Query(None, description="Title fallback (partial match)"),
    alpha: float = Query(0.5, ge=0.0, le=1.0, description="1=content, 0=collab"),
    n: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    if movie_id is None and not title:
        raise HTTPException(status_code=422, detail="Provide movie_id or title.")
    ck = cache_mod.key("hybrid", movie_id=movie_id, title=(title or "").lower(), alpha=alpha, n=n)
    hit = cache_mod.get_json(ck)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
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
    items = []
    for m, cs, ks, hs in ranked:
        exp = svc_explain.build_reasons(target, m, content_score=cs, collab_score=ks)
        items.append({
            **movie_to_out(m).model_dump(),
            "content_score": round(cs, 4),
            "collab_score": round(ks, 4),
            "hybrid_score": round(hs, 4),
            "reasons": exp["reasons"],
            "breakdown": {**exp["breakdown"], "hybrid": round(hs, 4)},
            "friendly": exp["friendly"],
        })
    data = {
        "query": title or movie_id,
        "matched_title": target.title,
        "matched": movie_to_out(target).model_dump(),
        "alpha": alpha,
        "recommendations": [m.title for m, _, _, _ in ranked],
        "items": items,
    }
    cache_mod.set_json(ck, data, TTL_HYBRID)
    response.headers["X-Cache"] = "MISS"
    return data
