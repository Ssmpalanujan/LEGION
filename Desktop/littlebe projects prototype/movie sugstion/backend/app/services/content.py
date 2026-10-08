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
    docs = [doc_for(m) or "unknown" for m in movies]
    tfidf = TfidfVectorizer().fit_transform(docs)
    sims = cosine_similarity(tfidf[idx], tfidf).flatten()
    order = sorted(range(len(movies)), key=lambda i: sims[i], reverse=True)
    return [(i, float(sims[i])) for i in order if i != idx]


def recommend_by_title(movies: list[Movie], title: str, n: int = 5) -> tuple[Movie, list[Movie]]:
    """Match title (partial, case-insensitive) then return top-n similar movies."""
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
    return matched, [movies[i] for i, _ in ranked]


__all__ = ["content_scores", "doc_for", "recommend_by_title", "MovieNotFoundError", "find_best_match"]
