"""Taste vector + profile: likes pull the vector toward movies, skips push away."""
from app.models.entities import Movie, Rating, Swipe, WatchlistItem

LIKE_W = 1.0
SKIP_W = -0.3
RATE_W = 0.5  # per star above 3.0


def _genres(m: Movie) -> list[str]:
    return [g.strip() for g in (m.genres or "").split(",") if g.strip()]


def taste_vector(db, user_id: int) -> dict[str, float]:
    """Genre weights from swipes (+1 like / -0.3 skip), ratings, watchlist (+0.5)."""
    vec: dict[str, float] = {}
    for s in db.query(Swipe).filter(Swipe.user_id == user_id).all():
        m = db.query(Movie).filter(Movie.id == s.movie_id).first()
        if m is None:
            continue
        w = LIKE_W if s.liked else SKIP_W
        for g in _genres(m):
            vec[g] = vec.get(g, 0.0) + w
    for r in db.query(Rating).filter(Rating.user_id == user_id).all():
        m = db.query(Movie).filter(Movie.id == r.movie_id).first()
        if m is None:
            continue
        for g in _genres(m):
            vec[g] = vec.get(g, 0.0) + (r.score - 3.0) * RATE_W
    for wl in db.query(WatchlistItem).filter(WatchlistItem.user_id == user_id).all():
        m = db.query(Movie).filter(Movie.id == wl.movie_id).first()
        if m is None:
            continue
        for g in _genres(m):
            vec[g] = vec.get(g, 0.0) + 0.5
    # Drop non-positive noise
    return {g: round(w, 3) for g, w in vec.items() if w > 0}


def score_movie(m: Movie, vec: dict[str, float]) -> float:
    if not vec:
        return 0.0
    return sum(vec.get(g, 0.0) for g in _genres(m))


def unseen_ids(db, user_id: int) -> set[int]:
    seen = {s.movie_id for s in db.query(Swipe).filter(Swipe.user_id == user_id).all()}
    seen |= {r.movie_id for r in db.query(Rating).filter(Rating.user_id == user_id).all()}
    return seen


def taste_profile(db, user_id: int) -> dict:
    """Genre %, top languages, decade distribution from likes+ratings+watchlist."""
    liked_movies: list[Movie] = []
    for s in db.query(Swipe).filter(Swipe.user_id == user_id, Swipe.liked.is_(True)).all():
        m = db.query(Movie).filter(Movie.id == s.movie_id).first()
        if m:
            liked_movies.append(m)
    for wl in db.query(WatchlistItem).filter(WatchlistItem.user_id == user_id).all():
        m = db.query(Movie).filter(Movie.id == wl.movie_id).first()
        if m and m not in liked_movies:
            liked_movies.append(m)
    genres: dict[str, int] = {}
    langs: dict[str, int] = {}
    decades: dict[str, int] = {}
    for m in liked_movies:
        for g in _genres(m):
            genres[g] = genres.get(g, 0) + 1
        langs[m.original_language or "en"] = langs.get(m.original_language or "en", 0) + 1
        dec = ((m.year or "")[:3] + "0s") if (m.year or "").isdigit() else "Unknown"
        decades[dec] = decades.get(dec, 0) + 1
    total = max(1, sum(genres.values()))
    return {
        "genre_percent": {g: round(c * 100 / total, 1) for g, c in sorted(genres.items(), key=lambda kv: -kv[1])[:10]},
        "top_languages": sorted(langs.items(), key=lambda kv: -kv[1])[:5],
        "decades": dict(sorted(decades.items())),
        "liked_count": len(liked_movies),
    }
