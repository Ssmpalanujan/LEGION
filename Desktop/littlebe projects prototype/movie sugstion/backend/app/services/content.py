"""Content-based recommender: TF-IDF over genres + overview + cast, cosine similarity.

Phase 1 scope: genres carry most signal (MovieLens seed has no overviews);
overview/cast automatically contribute once TMDB ingest fills them.
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.models.entities import Movie
from app.services.store import MovieNotFoundError, find_best_match


def doc_for(m: Movie) -> str:
    genres = (m.genres or "").replace(",", " ")
    cast = (m.cast or "").replace(",", " ")
    overview = m.overview or ""
    director = (m.director or "").replace(" ", "_")
    # Weight genres 2x by repetition so short genre strings are not drowned out
    return f"{genres} {genres} {overview} {cast} {director}".strip()


def content_scores(movies: list[Movie], idx: int) -> list[tuple[int, float]]:
    """Cosine similarity of movie[idx] to all others, sorted desc (excludes self)."""
    tfidf, _ = fit_tfidf(movies)
    return scores_from_matrix(tfidf, idx, len(movies))


def fit_tfidf(movies: list[Movie]):
    """Fit TF-IDF once (evaluation reuses it instead of refitting per user)."""
    from sklearn.feature_extraction.text import TfidfVectorizer

    docs = [doc_for(m) or "unknown" for m in movies]
    vec = TfidfVectorizer()
    return vec.fit_transform(docs), vec


def scores_from_matrix(tfidf, idx: int, n: int) -> list[tuple[int, float]]:
    sims = cosine_similarity(tfidf[idx], tfidf).flatten()
    order = sorted(range(n), key=lambda i: sims[i], reverse=True)
    return [(i, float(sims[i])) for i in order if i != idx]


def recommend_by_title(movies: list[Movie], title: str, n: int = 5) -> tuple[Movie, list[Movie]]:
    """Match title (partial, case-insensitive) then return top-n similar movies."""
    matched, ranked = recommend_with_scores(movies, title, n=n)
    return matched, [m for m, _ in ranked]


def recommend_with_scores(movies: list[Movie], title: str, n: int = 5) -> tuple[Movie, list[tuple[Movie, float]]]:
    """Same as recommend_by_title but keeps normalized content scores (0..1)."""
    if not movies:
        raise MovieNotFoundError("Movie catalog is empty. Run ingestion first.")
    # Reuse store matching rule via a lightweight local search
    needle = (title or "").strip().lower()
    if not needle:
        raise MovieNotFoundError("Empty title. Please provide a movie title.")
    cands = [m for m in movies if needle in (m.title or "").lower()]
    if not cands:
        raise MovieNotFoundError(
            f"No movie found matching '{title}'. Try another title or use /search?q=... for suggestions."
        )
    matched = sorted(cands, key=lambda m: (len(m.title), m.id))[0]
    idx = movies.index(matched)
    ranked = content_scores(movies, idx)[: max(0, n)]
    hi = max((s for _, s in ranked), default=0.0)
    norm = [(movies[i], (s / hi if hi > 0 else 0.0)) for i, s in ranked]
    return matched, norm


__all__ = ["content_scores", "doc_for", "recommend_by_title", "MovieNotFoundError", "find_best_match"]
