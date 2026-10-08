"""Item-based collaborative filtering from MovieLens ratings (surprise-free).

Builds a movie-user rating matrix from ratings.csv, maps MovieLens ids to DB
movie ids via Movie.movielens_id, and computes item-item cosine similarity.
Scores are cosine similarities in [0, 1] (ratings are non-negative).
Cold-start: movies with no ratings return an empty list (caller falls back).
"""
import csv
from functools import lru_cache
from pathlib import Path

import numpy as np

DATA_CANDIDATES = [
    Path(__file__).resolve().parents[2] / "data" / "ml-latest-small" / "ratings.csv",
    Path.cwd() / "backend" / "data" / "ml-latest-small" / "ratings.csv",
]


def find_ratings_csv() -> Path | None:
    for p in DATA_CANDIDATES:
        if p.exists():
            return p
    return None


@lru_cache(maxsize=1)
def _load_matrix():
    """Return (ml_ids: list[int], matrix: np.ndarray items x users) or (None, None)."""
    path = find_ratings_csv()
    if path is None:
        return None, None
    user_index: dict[int, int] = {}
    item_index: dict[int, int] = {}
    triples: list[tuple[int, int, float]] = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                u, ml, r = int(row["userId"]), int(row["movieId"]), float(row["rating"])
            except (ValueError, KeyError):
                continue
            if u not in user_index:
                user_index[u] = len(user_index)
            if ml not in item_index:
                item_index[ml] = len(item_index)
            triples.append((item_index[ml], user_index[u], r))
    if not triples:
        return None, None
    mat = np.zeros((len(item_index), len(user_index)), dtype=np.float32)
    for i, u, r in triples:
        mat[i, u] = r
    # Mean-center per user (baseline) for better similarity; keep non-negative scale
    means = np.where((mat != 0).sum(axis=0) > 0, mat.sum(axis=0) / np.maximum((mat != 0).sum(axis=0), 1), 0)
    centered = mat - means[np.newaxis, :] * (mat != 0)
    ml_ids = [0] * len(item_index)
    for ml, i in item_index.items():
        ml_ids[i] = ml
    return ml_ids, centered


def collab_scores(db_ml_ids: list[int | None], target_ml_id: int) -> dict[int, float]:
    """Item-item cosine similarity of target to all DB movies.

    db_ml_ids: movielens ids aligned with the caller's movie list (None = no ratings).
    Returns {position: score} sorted insertion; empty dict on cold-start.
    """
    ml_ids, mat = _load_matrix()
    if ml_ids is None or target_ml_id not in ml_ids:
        return {}
    norms = np.linalg.norm(mat, axis=1)
    norms[norms == 0] = 1.0
    normed = mat / norms[:, np.newaxis]
    t = normed[ml_ids.index(target_ml_id)]
    sims = normed @ t
    pos_of_ml = {ml: i for i, ml in enumerate(ml_ids)}
    out: dict[int, float] = {}
    for pos, ml in enumerate(db_ml_ids):
        if ml is None or ml == target_ml_id:
            continue
        j = pos_of_ml.get(ml)
        if j is None:
            continue
        out[pos] = round(float(max(0.0, min(1.0, sims[j]))), 4)
    return out


def has_ratings_data() -> bool:
    return find_ratings_csv() is not None
