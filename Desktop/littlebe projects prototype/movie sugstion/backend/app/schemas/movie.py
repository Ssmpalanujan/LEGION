"""Pydantic schemas for movies/search/recommend."""
from pydantic import BaseModel


class MovieOut(BaseModel):
    id: int
    tmdb_id: int | None = None
    title: str
    original_title: str = ""
    overview: str = ""
    genres: list[str] = []
    genres_display: str = ""
    year: str = ""
    original_language: str = "en"
    poster_path: str = ""
    backdrop_path: str = ""
    cast: list[str] = []
    director: str = ""
    vote_average: float = 0.0

    model_config = {"from_attributes": True}


class SearchOut(BaseModel):
    query: str
    results: list[MovieOut]


class RecommendOut(BaseModel):
    query: str
    matched_title: str
    matched: MovieOut | None = None
    recommendations: list[str] = []  # title strings (backwards compatible)
    items: list[MovieOut] = []  # rich objects


def movie_to_out(m) -> MovieOut:
    genres = [g.strip() for g in (m.genres or "").split(",") if g.strip()]
    cast = [c.strip() for c in (m.cast or "").split(",") if c.strip()]
    return MovieOut(
        id=m.id,
        tmdb_id=m.tmdb_id,
        title=m.title,
        original_title=m.original_title or "",
        overview=m.overview or "",
        genres=genres,
        genres_display=", ".join(genres),
        year=m.year or "",
        original_language=m.original_language or "en",
        poster_path=m.poster_path or "",
        backdrop_path=m.backdrop_path or "",
        cast=cast,
        director=m.director or "",
        vote_average=m.vote_average or 0.0,
    )
