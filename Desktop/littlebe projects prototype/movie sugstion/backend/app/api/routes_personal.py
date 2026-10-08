"""Personalization: swipes, next-card, watchlist, taste profile, for-you feed."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core import security as sec
from app.models.db import get_db
from app.models.entities import Movie, Swipe, User, WatchlistItem
from app.schemas.movie import movie_to_out
from app.schemas.user import SwipeIn
from app.services import taste as svc_taste
from app.services.store import all_movies

router = APIRouter(tags=["personal"])


@router.post("/swipes", status_code=201)
def swipe(body: SwipeIn, user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    if db.query(Movie).filter(Movie.id == body.movie_id).first() is None:
        raise HTTPException(status_code=404, detail=f"Movie id {body.movie_id} not found.")
    db.add(Swipe(user_id=user.id, movie_id=body.movie_id, liked=body.liked))
    db.commit()
    return {"ok": True, "taste_vector": svc_taste.taste_vector(db, user.id)}


@router.get("/swipes/next")
def swipes_next(user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    """Next card: highest taste-vector score among unseen movies (fallback: id order)."""
    movies = all_movies(db)
    seen = svc_taste.unseen_ids(db, user.id)
    vec = svc_taste.taste_vector(db, user.id)
    cands = [m for m in movies if m.id not in seen]
    if not cands:
        return {"card": None, "reason": "No unseen movies left."}
    if vec:
        cands.sort(key=lambda m: (-svc_taste.score_movie(m, vec), m.id))
        reason = "Picked from your taste vector"
    else:
        cands.sort(key=lambda m: m.id)
        reason = "New user — showing popular catalog order"
    return {"card": movie_to_out(cands[0]).model_dump(), "reason": reason}


@router.get("/watchlist")
def watchlist_list(user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    rows = db.query(WatchlistItem).filter(WatchlistItem.user_id == user.id).all()
    out = []
    for w in rows:
        m = db.query(Movie).filter(Movie.id == w.movie_id).first()
        if m:
            out.append(movie_to_out(m).model_dump())
    return {"items": out}


@router.post("/watchlist/{movie_id}", status_code=201)
def watchlist_add(movie_id: int, user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    if db.query(Movie).filter(Movie.id == movie_id).first() is None:
        raise HTTPException(status_code=404, detail=f"Movie id {movie_id} not found.")
    if db.query(WatchlistItem).filter(WatchlistItem.user_id == user.id, WatchlistItem.movie_id == movie_id).first():
        return {"ok": True, "duplicate": True}
    db.add(WatchlistItem(user_id=user.id, movie_id=movie_id))
    db.commit()
    return {"ok": True}


@router.delete("/watchlist/{movie_id}")
def watchlist_del(movie_id: int, user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    w = db.query(WatchlistItem).filter(WatchlistItem.user_id == user.id, WatchlistItem.movie_id == movie_id).first()
    if w is None:
        raise HTTPException(status_code=404, detail="Not in watchlist.")
    db.delete(w)
    db.commit()
    return {"ok": True}


@router.get("/profile/taste")
def profile_taste(user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    return svc_taste.taste_profile(db, user.id)


@router.get("/recommend/for-you")
def for_you(n: int = Query(10, ge=1, le=20), user: User = Depends(sec.get_current_user), db: Session = Depends(get_db)):
    """Personalized feed: taste-vector ranking over unseen movies."""
    movies = all_movies(db)
    seen = svc_taste.unseen_ids(db, user.id)
    vec = svc_taste.taste_vector(db, user.id)
    cands = [m for m in movies if m.id not in seen]
    cands.sort(key=lambda m: (-svc_taste.score_movie(m, vec), m.id))
    top = cands[:n]
    return {
        "items": [
            {**movie_to_out(m).model_dump(), "reasons": [f"Matches your taste ({', '.join([g for g in [x.strip() for x in (m.genres or '').split(',')] if g in vec][:3]) or 'popular picks'})"]}
            for m in top
        ]
    }
