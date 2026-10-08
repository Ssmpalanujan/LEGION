"""Semantic search route: GET /search/semantic?q=...&n=10."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.schemas.movie import movie_to_out
from app.services import semantic as svc
from app.services.store import all_movies

router = APIRouter()


@router.get("/search/semantic")
def search_semantic(
    q: str = Query(..., description="Natural-language query (EN/TA/SI)"),
    n: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
):
    movies = all_movies(db)
    filters, llm_used = svc.llm_parse_filters(q)
    lang_hint = filters.get("language") if isinstance(filters, dict) else None
    ranked, detected = svc.semantic_search(movies, q, n=n, language=lang_hint)
    return {
        "query": q,
        "detected_language": detected,
        "llm_used": llm_used,
        "llm_filters": filters,
        "results": [
            {**movie_to_out(m).model_dump(), "semantic_score": round(s, 4)} for m, s in ranked
        ],
    }
