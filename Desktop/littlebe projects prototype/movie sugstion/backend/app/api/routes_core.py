"""Phase-1 routes: health, search, movies, recommend. All responses typed."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core import cache as cache_mod
from app.core.config import get_settings
from app.models.db import get_db
from app.schemas.movie import MovieOut, RecommendOut, SearchOut, movie_to_out
from app.services import content as svc_content
from app.services import explain as svc_explain
from app.services.store import (
    MovieNotFoundError,
    all_movies,
    search_movies,
)

TTL_SEARCH = 300
TTL_RECOMMEND = 600

router = APIRouter()


@router.get("/health")
def health():
    s = get_settings()
    degraded = []
    checks: dict = {}
    try:
        from app.models.db import SessionLocal

        db = SessionLocal()
        try:
            db.execute(__import__("sqlalchemy").text("SELECT 1"))
            from app.models.entities import Movie

            checks["db"] = {"ok": True, "movies": db.query(Movie).count()}
        finally:
            db.close()
    except Exception as e:
        checks["db"] = {"ok": False, "error": str(e)[:200]}
    try:
        cache_mod.get_client().ping()
        checks["redis"] = {"ok": True}
    except Exception as e:
        checks["redis"] = {"ok": False, "error": str(e)[:200]}
    if not s.tmdb_api_key:
        degraded.append("tmdb (TMDB_API_KEY missing — MovieLens-only mode)")
    if not checks.get("db", {}).get("ok"):
        degraded.append("db")
    if not checks.get("redis", {}).get("ok"):
        degraded.append("redis (using in-memory fallback)")
    status = "ok" if checks.get("db", {}).get("ok") else "degraded"
    return {
        "status": status,
        "tmdb": "ok" if s.tmdb_api_key else "degraded",
        "degraded": degraded,
        "checks": checks,
    }


@router.get("/search", response_model=SearchOut)
def search(
    response: Response,
    q: str = Query("", description="Partial title, any language"),
    n: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    ck = cache_mod.key("search", q=q, n=n)
    hit = cache_mod.get_json(ck)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
    rows = search_movies(db, q, limit=n)
    data = {"query": q, "results": [movie_to_out(m).model_dump() for m in rows]}
    cache_mod.set_json(ck, data, TTL_SEARCH)
    response.headers["X-Cache"] = "MISS"
    return data


@router.get("/movies/{movie_id}", response_model=MovieOut)
def movie_detail(movie_id: int, db: Session = Depends(get_db)):
    from app.models.entities import Movie

    m = db.query(Movie).filter(Movie.id == movie_id).first()
    if m is None:
        raise HTTPException(status_code=404, detail=f"Movie id {movie_id} not found.")
    return movie_to_out(m)


@router.get("/recommend", response_model=RecommendOut)
def recommend(
    response: Response,
    title: str = Query(..., description="Movie title (partial, case-insensitive)"),
    n: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    ck = cache_mod.key("recommend", title=title.lower(), n=n)
    hit = cache_mod.get_json(ck)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
    try:
        movies = all_movies(db)
        matched, ranked = svc_content.recommend_with_scores(movies, title, n=n)
    except MovieNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    items = []
    for m, cs in ranked:
        exp = svc_explain.build_reasons(matched, m, content_score=cs)
        items.append({**movie_to_out(m).model_dump(), **exp})
    data = {
        "query": title,
        "matched_title": matched.title,
        "matched": movie_to_out(matched).model_dump(),
        "recommendations": [m.title for m, _ in ranked],
        "items": items,
    }
    cache_mod.set_json(ck, data, TTL_RECOMMEND)
    response.headers["X-Cache"] = "MISS"
    return data
