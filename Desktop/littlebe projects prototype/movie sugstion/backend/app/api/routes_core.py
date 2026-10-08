"""Phase-1 routes: health, search, movies, recommend. All responses typed."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.db import get_db
from app.schemas.movie import MovieOut, RecommendOut, SearchOut, movie_to_out
from app.services import content as svc_content
from app.services import explain as svc_explain
from app.services.store import MovieNotFoundError, all_movies, find_best_match, search_movies

router = APIRouter()


@router.get("/health")
def health():
    s = get_settings()
    degraded = []
    if not s.tmdb_api_key:
        degraded.append("tmdb (TMDB_API_KEY missing — MovieLens-only mode)")
    return {"status": "ok", "tmdb": "ok" if s.tmdb_api_key else "degraded", "degraded": degraded}


@router.get("/search", response_model=SearchOut)
def search(q: str = Query("", description="Partial title, any language"), n: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    rows = search_movies(db, q, limit=n)
    return {"query": q, "results": [movie_to_out(m) for m in rows]}


@router.get("/movies/{movie_id}", response_model=MovieOut)
def movie_detail(movie_id: int, db: Session = Depends(get_db)):
    from app.models.entities import Movie

    m = db.query(Movie).filter(Movie.id == movie_id).first()
    if m is None:
        raise HTTPException(status_code=404, detail=f"Movie id {movie_id} not found.")
    return movie_to_out(m)


@router.get("/recommend", response_model=RecommendOut)
def recommend(
    title: str = Query(..., description="Movie title (partial, case-insensitive)"),
    n: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    try:
        movies = all_movies(db)
        matched, ranked = svc_content.recommend_with_scores(movies, title, n=n)
    except MovieNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    items = []
    for m, cs in ranked:
        exp = svc_explain.build_reasons(matched, m, content_score=cs)
        items.append({**movie_to_out(m).model_dump(), **exp})
    return {
        "query": title,
        "matched_title": matched.title,
        "matched": movie_to_out(matched),
        "recommendations": [m.title for m, _ in ranked],
        "items": items,
    }
