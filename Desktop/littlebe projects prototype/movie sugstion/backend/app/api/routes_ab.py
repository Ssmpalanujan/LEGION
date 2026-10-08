"""A/B endpoints: assign, variant recommendations (A=content, B=hybrid), event log."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.schemas.movie import movie_to_out
from app.services import ab as svc_ab
from app.services import content as svc_content
from app.services import explain as svc_explain
from app.services import hybrid as svc_hybrid
from app.services.store import MovieNotFoundError, all_movies, find_best_match

router = APIRouter(tags=["ab"])


class ABEventIn(BaseModel):
    session_id: str = "anon"
    kind: str  # click | like
    movie_id: int | None = None


@router.get("/ab/assign")
def ab_assign(session_id: str = Query("anon")):
    return {"session_id": session_id, "variant": svc_ab.assign_variant(session_id)}


@router.get("/recommend/ab")
def recommend_ab(
    title: str = Query(...),
    session_id: str = Query("anon"),
    n: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """Variant A = content-based, B = hybrid(0.5). Logs an impression."""
    variant = svc_ab.assign_variant(session_id)
    try:
        movies = all_movies(db)
        target = find_best_match(db, title)
        if variant == "A":
            ranked = [
                (m, cs, 0.0, cs) for m, cs in svc_content.recommend_with_scores(movies, title, n=n)[1]
            ]
        else:
            ranked = svc_hybrid.hybrid_for_movie(movies, target, alpha=0.5, n=n)
    except MovieNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    svc_ab.log_event(db, variant, "impression")
    items = []
    for m, cs, ks, hs in ranked:
        exp = svc_explain.build_reasons(target, m, content_score=cs, collab_score=ks)
        items.append({**movie_to_out(m).model_dump(), **exp, "hybrid_score": round(hs, 4)})
    return {"variant": variant, "matched_title": target.title, "items": items}


@router.post("/ab/event", status_code=201)
def ab_event(body: ABEventIn, db: Session = Depends(get_db)):
    if body.kind not in ("click", "like"):
        raise HTTPException(status_code=422, detail="kind must be click or like.")
    svc_ab.log_event(db, svc_ab.assign_variant(body.session_id), body.kind)
    return {"ok": True}
