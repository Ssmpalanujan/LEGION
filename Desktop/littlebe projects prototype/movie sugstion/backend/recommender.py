"""Content-based movie recommender using TF-IDF on genres + cosine similarity."""
import re
from functools import lru_cache
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = Path(__file__).resolve().parent
CANDIDATE_PATHS = [
    BASE_DIR / "data" / "ml-latest-small" / "movies.csv",
    BASE_DIR / "data" / "movies.csv",
]


class MovieNotFoundError(ValueError):
    """Raised when no movie matches the requested title."""


def _resolve_movies_csv() -> Path:
    for p in CANDIDATE_PATHS:
        if p.exists():
            return p
    raise FileNotFoundError(
        "movies.csv not found. Run `python backend/download_data.py` first. "
        f"Looked in: {', '.join(str(p) for p in CANDIDATE_PATHS)}"
    )


@lru_cache(maxsize=1)
def _load_model():
    """Load movies.csv, build TF-IDF matrix and cosine similarity. Cached."""
    csv_path = _resolve_movies_csv()
    movies = pd.read_csv(csv_path)
    # Replace "|" in genres with spaces for TF-IDF tokenization
    movies["genres_clean"] = movies["genres"].fillna("").str.replace("|", " ", regex=False)

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(movies["genres_clean"])
    similarity = cosine_similarity(tfidf_matrix)

    return movies, similarity


def _find_match_index(title: str) -> int:
    """Case-insensitive partial title matching. Returns row index of best match."""
    movies, _ = _load_model()
    query = title.strip().lower()
    if not query:
        raise MovieNotFoundError("Empty title. Please provide a movie title.")

    mask = movies["title"].str.lower().str.contains(query, na=False, regex=False)
    matches = movies[mask]
    if matches.empty:
        raise MovieNotFoundError(
            f"No movie found matching '{title}'. Try another title or use /search?q=... for suggestions."
        )
    # Prefer the shortest title among matches (closest match), then smallest movieId
    best = matches.assign(_len=matches["title"].str.len()).sort_values(
        ["_len", "movieId"]
    ).iloc[0]
    return int(best.name)


def search_titles(query: str, limit: int = 10) -> list[str]:
    """Return up to `limit` movie titles containing `query` (case-insensitive)."""
    movies, _ = _load_model()
    q = (query or "").strip().lower()
    if not q:
        return []
    mask = movies["title"].str.lower().str.contains(q, na=False, regex=False)
    matches = (
        movies[mask]
        .assign(_len=movies["title"].str.len())
        .sort_values(["_len", "movieId"])
        .head(limit)
    )
    return matches["title"].tolist()


_YEAR_RE = re.compile(r"\((\d{4})\)\s*$")


def parse_year(title: str) -> str:
    """Extract 4-digit year from a MovieLens title like 'Toy Story (1995)'."""
    m = _YEAR_RE.search(title or "")
    return m.group(1) if m else ""


def movie_to_dict(row) -> dict:
    """Convert a movies.csv row to a JSON-friendly dict with title/genres/year."""
    title = str(row["title"])
    genres_raw = str(row.get("genres", "") or "")
    genres = [g for g in genres_raw.split("|") if g and g != "(no genres listed)"]
    return {
        "movieId": int(row["movieId"]),
        "title": title,
        "genres": genres,
        "genres_display": ", ".join(genres) if genres else "Unknown",
        "year": parse_year(title),
    }


def recommend(title: str, n: int = 5) -> dict:
    """Return dict with matched title + list of n similar movie titles.

    Similarity is cosine similarity over TF-IDF vectors of genres.
    The matched movie itself is excluded from results.

    Keeps ``recommendations`` as a list of title strings for backwards
    compatibility, and adds ``matched`` / ``items`` dicts with
    title, genres and year for richer UIs.
    """
    movies, similarity = _load_model()
    idx = _find_match_index(title)
    matched_row = movies.iloc[idx]
    matched_title = str(matched_row["title"])

    scores = list(enumerate(similarity[idx]))
    # Sort by similarity desc, exclude the movie itself
    scores = sorted(scores, key=lambda x: x[1], reverse=True)
    scores = [s for s in scores if s[0] != idx][: max(0, n)]

    recommendations = [str(movies.iloc[i]["title"]) for i, _ in scores]
    items = [movie_to_dict(movies.iloc[i]) for i, _ in scores]
    return {
        "matched_title": matched_title,
        "matched": movie_to_dict(matched_row),
        "recommendations": recommendations,
        "items": items,
    }
