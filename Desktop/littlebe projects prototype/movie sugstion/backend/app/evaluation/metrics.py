"""Offline evaluation on MovieLens train/test split.

Protocol (per sampled user): hide 20% of liked (rating>=4) movies, use the
top-rated train movie as seed, recommend top-K via each algorithm, score hits
against the held-out set. Metrics: Precision@K, Recall@K, NDCG@K, coverage
(fraction of catalog ever recommended). Algorithms: content, collab,
hybrid alpha 0.3/0.5/0.7.
"""
import csv
import math
import random

ALGOS = ["content", "collab", "hybrid_0.3", "hybrid_0.5", "hybrid_0.7"]


def load_ratings(path):
    """Return {user: [(ml_id, rating)]}."""
    users: dict[int, list] = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                u, m, r = int(row["userId"]), int(row["movieId"]), float(row["rating"])
            except (ValueError, KeyError):
                continue
            users.setdefault(u, []).append((m, r))
    return users


def split(users: dict, test_frac: float = 0.2, seed: int = 42):
    """Return {user: (train[(ml,rating)], test_liked[ml])} for users with >=5 likes."""
    rng = random.Random(seed)
    out = {}
    for u, pairs in users.items():
        liked = sorted([m for m, r in pairs if r >= 4.0])
        if len(liked) < 5:
            continue
        liked = liked[:]
        rng.shuffle(liked)
        k = max(1, int(len(liked) * test_frac))
        test = set(liked[:k])
        train = [(m, r) for m, r in pairs if m not in test]
        out[u] = (train, test)
    return out


def _dcg(hits: list[int], k: int) -> float:
    return sum(h / math.log2(i + 2) for i, h in enumerate(hits[:k]))


def pr_ndcg(recommended: list, relevant: set, k: int):
    hits = [1 if m in relevant else 0 for m in recommended[:k]]
    h = sum(hits)
    ideal = sorted([1] * min(len(relevant), k) + [0] * k, reverse=True)
    idcg = _dcg(ideal, k)
    return {
        "p": h / k if k else 0.0,
        "r": h / len(relevant) if relevant else 0.0,
        "ndcg": (_dcg(hits, k) / idcg) if idcg else 0.0,
    }


def two_proportion_pvalue(c1: int, n1: int, c2: int, n2: int) -> float:
    """Two-sided z-test p-value for comparing two proportions (normal approx)."""
    if n1 <= 0 or n2 <= 0:
        return 1.0
    p1, p2 = c1 / n1, c2 / n2
    p = (c1 + c2) / (n1 + n2)
    se = math.sqrt(max(p * (1 - p), 0) * (1 / n1 + 1 / n2))
    if se == 0:
        return 1.0
    z = abs(p1 - p2) / se
    # two-sided p via erfc (no scipy needed)
    return float(math.erfc(z / math.sqrt(2)))


def _minmax(scores: dict) -> dict:
    if not scores:
        return {}
    hi = max(scores.values())
    if hi <= 0:
        return {k: 0.0 for k in scores}
    return {k: v / hi for k, v in scores.items()}


def evaluate_from_data(movies, train: dict, test: dict, k: int = 10) -> dict:
    """Pure evaluation over a catalog + per-user train/test maps.

    movies: catalog objects with .movielens_id (content docs come from them).
    train: {user: [(ml_id, rating)]}; test: {user: {liked ml_id}}.
    Returns {algo: {p, r, ndcg, coverage, users}}.
    """
    from app.services import collab as collab_svc
    from app.services import content as content_svc

    mlpos = {m.movielens_id: i for i, m in enumerate(movies) if m.movielens_id}
    tfidf, _ = content_svc.fit_tfidf(movies)
    triples = [(ml, u, r) for u, trs in train.items() for ml, r in trs]
    tml_ids, tmat = collab_svc.build_item_matrix(triples)
    tml_ids = tml_ids or []

    users = sorted(set(train) & set(test))
    agg: dict[str, dict] = {a: {"p": 0.0, "r": 0.0, "ndcg": 0.0, "users": 0} for a in ALGOS}
    covered: dict[str, set] = {a: set() for a in ALGOS}
    for u in users:
        trs = train[u]
        rel = set(test[u])
        if not rel:
            continue
        seed_ml = max(trs, key=lambda t: (t[1], -t[0]))[0]
        train_ids = {m for m, _ in trs}
        # content ranking (ml ids, train excluded)
        c_rank = []
        if seed_ml in mlpos:
            for pos, _ in content_svc.scores_from_matrix(tfidf, mlpos[seed_ml], len(movies)):
                ml = movies[pos].movielens_id
                if ml and ml not in train_ids:
                    c_rank.append(ml)
                if len(c_rank) >= k:
                    break
        # collab ranking (train excluded)
        k_rank = []
        if tml_ids and seed_ml in tml_ids:
            sims = collab_svc.cosine_to_target(tml_ids, tmat, seed_ml)
            k_rank = [ml for ml in sorted(sims, key=lambda m: -sims[m]) if ml not in train_ids][:k]
        cn, kn = _minmax({m: (k - i) for i, m in enumerate(c_rank)}), _minmax(
            {m: (k - i) for i, m in enumerate(k_rank)}
        )
        cands = [m for m in list(dict.fromkeys(c_rank + k_rank)) if m not in train_ids]
        hyb = {}
        for a in ("hybrid_0.3", "hybrid_0.5", "hybrid_0.7"):
            alpha = float(a.split("_")[1])
            hyb[a] = sorted(cands, key=lambda m: -(alpha * cn.get(m, 0.0) + (1 - alpha) * kn.get(m, 0.0)))[:k]
        recs = {"content": c_rank[:k], "collab": k_rank, **hyb}
        for a, rec in recs.items():
            m = pr_ndcg(rec, rel, k)
            for key in ("p", "r", "ndcg"):
                agg[a][key] += m[key]
            agg[a]["users"] += 1
            covered[a].update(rec)
    denom = max(1, len(mlpos))
    out = {}
    for a in ALGOS:
        n = max(1, agg[a]["users"])
        out[a] = {
            "p": round(agg[a]["p"] / n, 4),
            "r": round(agg[a]["r"] / n, 4),
            "ndcg": round(agg[a]["ndcg"] / n, 4),
            "coverage": round(len(covered[a]) / denom, 4),
            "users": agg[a]["users"],
        }
    return out


def evaluate(db, ratings_path: str, k: int = 10, max_users: int = 30, seed: int = 42) -> dict:
    """DB-backed evaluation: catalog movies + MovieLens split. Returns per-algo metrics."""
    from app.models.entities import Movie

    movies = db.query(Movie).filter(Movie.movielens_id.isnot(None)).order_by(Movie.id).all()
    users = load_ratings(ratings_path)
    parts = split(users, seed=seed)
    picked = dict(sorted(parts.items())[:max_users])
    train = {u: t for u, (t, _) in picked.items()}
    test = {u: s for u, (_, s) in picked.items()}
    return evaluate_from_data(movies, train, test, k=k)
