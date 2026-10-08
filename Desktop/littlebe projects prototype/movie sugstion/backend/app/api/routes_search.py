"""Semantic search route: GET /search/semantic?q=...&n=10."""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core import cache as cache_mod
from app.models.db import get_db
from app.schemas.movie import movie_to_out
from app.services import semantic as svc
from app.services.store import all_movies

router = APIRouter()
TTL_SEMANTIC = 300


@router.get("/search/semantic")
def search_semantic(
    response: Response,
    q: str = Query(..., description="Natural-language query (EN/TA/SI)"),
    n: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
):
    ck = cache_mod.key("semantic", q=q.lower(), n=n)
    hit = cache_mod.get_json(ck)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
    movies = all_movies(db)
    filters, llm_used = svc.llm_parse_filters(q)
    lang_hint = filters.get("language") if isinstance(filters, dict) else None
    ranked, detected = svc.semantic_search(movies, q, n=n, language=lang_hint)
    data = {
        "query": q,
        "detected_language": detected,
        "llm_used": llm_used,
        "llm_filters": filters,
        "results": [
            {**movie_to_out(m).model_dump(), "semantic_score": round(s, 4)} for m, s in ranked
        ],
    }
    cache_mod.set_json(ck, data, TTL_SEMANTIC)
    response.headers["X-Cache"] = "MISS"
    return data
