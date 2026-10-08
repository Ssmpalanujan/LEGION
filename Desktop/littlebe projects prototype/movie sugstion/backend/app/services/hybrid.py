"""Hybrid recommender: alpha * content + (1 - alpha) * collab, scores in 0..1.

alpha=1 -> pure content; alpha=0 -> pure collab. Cold-start (no collab scores)
falls back to content-only ordering.
"""
from app.models.entities import Movie
from app.services import collab, content
from app.services.store import MovieNotFoundError


def _norm(scores: dict[int, float]) -> dict[int, float]:
    if not scores:
        return {}
    hi = max(scores.values())
    if hi <= 0:
        return {k: 0.0 for k in scores}
    return {k: v / hi for k, v in scores.items()}


def hybrid_for_movie(movies: list[Movie], target: Movie, alpha: float = 0.5, n: int = 10):
    """Return [(movie, content_score, collab_score, hybrid_score)] sorted desc."""
    if not 0.0 <= alpha <= 1.0:
        raise ValueError("alpha must be between 0 and 1")
    idx = movies.index(target)
    c_raw = dict(content.content_scores(movies, idx))
    c = _norm(c_raw)
    ml_ids = [m.movielens_id for m in movies]
    k_raw = collab.collab_scores(ml_ids, target.movielens_id) if target.movielens_id else {}
    k = _norm(k_raw)
    combined: dict[int, float] = {}
    for pos in set(c) | set(k):
        cs = c.get(pos, 0.0)
        ks = k.get(pos, 0.0)
        # Cold-start: no collab signal at all -> content-only
        combined[pos] = cs if not k else alpha * cs + (1 - alpha) * ks
    order = sorted(combined, key=lambda p: combined[p], reverse=True)[: max(0, n)]
    return [(movies[p], c.get(p, 0.0), k.get(p, 0.0), combined[p]) for p in order]


def hybrid_by_id(movies: list[Movie], movie_id: int, alpha: float = 0.5, n: int = 10):
    target = next((m for m in movies if m.id == movie_id), None)
    if target is None:
        raise MovieNotFoundError(f"Movie id {movie_id} not found.")
    return target, hybrid_for_movie(movies, target, alpha=alpha, n=n)
