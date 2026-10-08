"""Unit tests for ingest helpers (pure functions, no network)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from ingest_tmdb import cache_path, genre_names, movie_kwargs  # noqa: E402


def test_genre_names_mapping():
    gmap = {28: "Action", 35: "Comedy"}
    assert genre_names(gmap, [28, 35]) == "Action, Comedy"
    assert genre_names(gmap, [28, 999]) == "Action"
    assert genre_names({}, [28]) == ""
    assert genre_names(gmap, None) == ""


def test_cache_path_stable():
    url = "https://api.themoviedb.org/3/discover/movie?page=3"
    assert cache_path(url) == cache_path(url)
    assert cache_path(url).suffix == ".json"


def test_movie_kwargs_shapes_row():
    item = {
        "id": 111,
        "title": "Test Film",
        "original_title": "டெஸ்ட்",
        "overview": "A story.",
        "genre_ids": [18],
        "release_date": "2021-05-01",
        "original_language": "ta",
        "poster_path": "/p.jpg",
        "backdrop_path": "/b.jpg",
        "vote_average": 7.5,
        "popularity": 42.0,
    }
    kw = movie_kwargs(item, {18: "Drama"})
    assert kw["tmdb_id"] == 111
    assert kw["genres"] == "Drama"
    assert kw["year"] == "2021"
    assert kw["original_language"] == "ta"
    assert kw["title"] == "Test Film"
    assert kw["original_title"] == "டெஸ்ட்"
