"""Multilingual semantic search: LaBSE when available, TF-IDF fallback otherwise.

Design decision (documented): sentence-transformers/LaBSE + torch are heavy and
need network to download (~500MB). The service tries LaBSE first; if the import
or model load fails it uses a TF-IDF fallback over title+overview+genres, which
handles English well and returns graceful results for Tamil/Sinhala queries
(plus language-filter parsing which works regardless of backend).
Precomputed embeddings live in backend/data/embeddings/ (.npy + ids.json).
"""
import json
import re
from functools import lru_cache
from pathlib import Path

import numpy as np

MODEL_NAME = "sentence-transformers/LaBSE"
EMB_DIR = Path(__file__).resolve().parents[2] / "data" / "embeddings"

# Language mentions -> ISO code. Covers English names + native scripts.
LANG_PATTERNS: list[tuple[str, list[str]]] = [
    ("ta", ["tamil", "tamil movie", "tamil movies", "தமிழ்", r"\bta\b"]),
    ("si", ["sinhala", "sinhalese", "සිංහල", "සිංහala", r"\bsi\b"]),
    ("en", ["english", "ஆங்கிலம்", r"\ben\b"]),
    ("hi", ["hindi", "இந்தி", "हिन्दी", r"\bhi\b"]),
]


def parse_language(query: str) -> str | None:
    q = (query or "").lower()
    for code, pats in LANG_PATTERNS:
        for p in pats:
            if re.search(p.lower(), q):
                return code
    return None


def _lase_model():
    """Return cached LaBSE model or None. NEVER downloads at runtime/tests.

    sentence-transformers would otherwise fetch ~500MB on first use and hang
    CI/offline machines. `local_files_only=True` makes a missing cache fail
    fast so the TF-IDF fallback takes over. Use scripts/build_embeddings.py
    (with network) to pre-warm the cache.
    """
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(MODEL_NAME, local_files_only=True)
    except Exception:
        return None


@lru_cache(maxsize=1)
def _lase_or_none():
    return _lase_model()


def doc_for_semantic(m) -> str:
    parts = [m.title or "", m.original_title or "", m.overview or "", (m.genres or "").replace(",", " ")]
    return " ".join(p for p in parts if p).strip() or "unknown"


@lru_cache(maxsize=1)
def _tfidf_index_key(n_docs: int) -> int:
    return n_docs


_tfidf_cache: dict = {}


def _tfidf_search(movies, query: str, n: int):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    docs = [doc_for_semantic(m) for m in movies]
    key = len(docs)
    entry = _tfidf_cache.get(key)
    if entry is None:
        vec = TfidfVectorizer(stop_words="english")
        mat = vec.fit_transform([d if d else "unknown" for d in docs])
        entry = (vec, mat)
        _tfidf_cache[key] = entry
    vec, mat = entry
    qv = vec.transform([query or "movie"])
    sims = cosine_similarity(qv, mat).flatten()
    order = sorted(range(len(movies)), key=lambda i: sims[i], reverse=True)[: max(0, n)]
    return [(movies[i], float(sims[i])) for i in order]


def semantic_search(movies, query: str, n: int = 10, language: str | None = None):
    """Nearest movies to query. Applies language filter when detected/given.

    Degraded-mode rule: if the filter matches nothing in the catalog (e.g.
    Tamil requested but only MovieLens English titles ingested), fall back to
    the full catalog so the user still gets results. The detected language is
    still reported so the UI can show it. Once TMDB ingest adds ta/si titles,
    the filter becomes effective.
    """
    lang = language or parse_language(query)
    pool = list(movies)
    if lang:
        filtered = [m for m in movies if (m.original_language or "en") == lang]
        pool = filtered or pool
    if not pool:
        return [], lang
    model = _lase_or_none()
    if model is not None:
        try:
            docs = [doc_for_semantic(m) for m in pool]
            qv = model.encode([query], normalize_embeddings=True)[0]
            ev = model.encode(docs, normalize_embeddings=True)
            sims = ev @ qv
            order = sorted(range(len(pool)), key=lambda i: sims[i], reverse=True)[: max(0, n)]
            return [(pool[i], float(sims[i])) for i in order], lang
        except Exception:
            pass  # fall through to TF-IDF
    return _tfidf_search(pool, query, n), lang


def _load_precomputed(pool_ids: list[int]):
    """Load .npy matrix if ids cover the pool; else None."""
    npy = EMB_DIR / "embeddings.npy"
    ids_j = EMB_DIR / "ids.json"
    if not (npy.exists() and ids_j.exists()):
        return None
    try:
        ids = json.loads(ids_j.read_text())
        if set(pool_ids) - set(ids):
            return None
        import numpy as np

        return np.load(str(npy)), ids
    except Exception:
        return None


def llm_parse_filters(query: str) -> tuple[dict, bool]:
    """Optional Claude layer: query -> {mood, language, genres, era}. Silent skip.

    Returns (filters, used). Never raises: missing key, no network, or any
    error -> ({}, False).
    """
    import os

    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        return {}, False
    try:
        import json as _json
        import urllib.request

        prompt = (
            "Parse this movie request into JSON with keys mood, language (iso code), "
            f"genres (list), era (e.g. 90s or null). Query: {query!r}. Reply with JSON only."
        )
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=_json.dumps({
                "model": "claude-3-haiku-20240307",
                "max_tokens": 200,
                "messages": [{"role": "user", "content": prompt}],
            }).encode(),
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            body = _json.loads(r.read().decode())
        text = "".join(b.get("text", "") for b in body.get("content", []) if isinstance(b, dict))
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end < 0:
            return {}, False
        return _json.loads(text[start : end + 1]), True
    except Exception:
        return {}, False
