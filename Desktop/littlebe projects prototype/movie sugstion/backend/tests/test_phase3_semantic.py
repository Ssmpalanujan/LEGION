"""Phase-3 tests: semantic search in Tamil/Sinhala/English (3 queries each)."""
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cinematch.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app  # noqa: E402
from app.models.db import init_db  # noqa: E402
from app.services import semantic as svc  # noqa: E402

init_db()
client = TestClient(create_app())

TAMIL = [
    "ஒரு sad ஆனால் inspiring Tamil movie",
    "சிரிக்க வைக்கும் குடும்ப படம்",
    "தமிழ் காதல் படம்",
]
SINHALA = [
    "සතුටුදායක පවුල් චිත්‍රපටයක්",
    "සිංහල ආදර චිත්‍රපට",
    "funny සිංහල movie",
]
ENGLISH = [
    "feel-good comedy for a rainy day",
    "sad but inspiring drama",
    "space adventure with robots",
]


def test_language_detection():
    assert svc.parse_language("ஒரு Tamil movie") == "ta"
    assert svc.parse_language("தமிழ் படம்") == "ta"
    assert svc.parse_language("සිංහල චිත්‍රපටයක්") == "si"
    assert svc.parse_language("Sinhala film") == "si"
    assert svc.parse_language("සතුටුදායක පවුල් චිත්‍රපටයක්") is None  # no language mention
    assert svc.parse_language("feel-good comedy") is None
    assert svc.parse_language("Hindi dubbed action") == "hi"


def test_tamil_queries():
    for q in TAMIL:
        r = client.get("/search/semantic", params={"q": q, "n": 5})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["results"], list)
        assert data["llm_used"] is False  # no ANTHROPIC_API_KEY in tests
    # Queries that mention Tamil must report ta (fallback still returns results)
    r = client.get("/search/semantic", params={"q": TAMIL[0], "n": 5})
    assert r.json()["detected_language"] == "ta"
    assert len(r.json()["results"]) > 0


def test_sinhala_queries():
    expected = [None, "si", "si"]  # first query mentions no language
    for q, lang in zip(SINHALA, expected):
        r = client.get("/search/semantic", params={"q": q, "n": 5})
        assert r.status_code == 200
        data = r.json()
        assert data["detected_language"] == lang
        assert len(data["results"]) > 0  # fallback keeps results useful


def test_english_queries_return_results():
    for q in ENGLISH:
        r = client.get("/search/semantic", params={"q": q, "n": 5})
        assert r.status_code == 200
        data = r.json()
        assert data["detected_language"] is None
        assert len(data["results"]) > 0
        assert "semantic_score" in data["results"][0]


def test_llm_layer_skips_silently_without_key():
    filters, used = svc.llm_parse_filters("happy tamil movie")
    assert used is False and filters == {}


def test_multilingual_autocomplete_matches_original_title():
    r = client.get("/search", params={"q": "Toy Story"})
    assert r.status_code == 200
    assert any("original_title" in m for m in r.json()["results"])
