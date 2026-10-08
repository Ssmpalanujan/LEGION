"""Pytest tests for the recommender logic and API endpoints."""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure `backend/` is importable whether pytest runs from root or backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402
from recommender import MovieNotFoundError, recommend, search_titles  # noqa: E402

client = TestClient(app)


def test_recommend_toy_story_returns_five():
    result = recommend("Toy Story", n=5)
    assert "matched_title" in result
    assert "Toy Story" in result["matched_title"]
    assert isinstance(result["recommendations"], list)
    assert len(result["recommendations"]) == 5
    # Matched movie must not appear in its own recommendations
    assert result["matched_title"] not in result["recommendations"]


def test_recommend_case_insensitive_partial_match():
    lower = recommend("toy story", n=5)
    upper = recommend("TOY STORY", n=5)
    partial = recommend("toy stor", n=5)
    assert lower["matched_title"] == upper["matched_title"] == partial["matched_title"]


def test_recommend_unknown_title_raises():
    with pytest.raises(MovieNotFoundError):
        recommend("This Movie Definitely Does Not Exist 12345")


def test_search_returns_up_to_10():
    results = search_titles("Toy", limit=10)
    assert isinstance(results, list)
    assert 0 < len(results) <= 10
    assert any("Toy Story" in t for t in results)


def test_api_recommend_ok():
    r = client.get("/recommend", params={"title": "Toy Story", "n": 5})
    assert r.status_code == 200
    data = r.json()
    assert "matched_title" in data
    assert len(data["recommendations"]) == 5


def test_api_recommend_404():
    r = client.get("/recommend", params={"title": "No Such Movie 987654321"})
    assert r.status_code == 404
    assert "detail" in r.json()


def test_api_search_ok():
    r = client.get("/search", params={"q": "Toy"})
    assert r.status_code == 200
    assert "results" in r.json()


def test_api_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
