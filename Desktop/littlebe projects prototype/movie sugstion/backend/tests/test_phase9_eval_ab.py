"""Phase-9 tests: eval metrics math, synthetic end-to-end eval, A/B flow, admin guards."""
import os
import sys
import time
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cinematch.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.evaluation import metrics as ev  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.db import init_db  # noqa: E402
from app.models.entities import Movie, User  # noqa: E402
from app.models.db import SessionLocal  # noqa: E402
from app.services import ab as svc_ab  # noqa: E402

init_db()
client = TestClient(create_app())


def _fake_movie(mid, genres):
    return Movie(id=mid, movielens_id=mid, title=f"Film {mid} (200{mid % 10})",
                 original_title=f"Film {mid}", overview="", genres=genres, year="2000",
                 original_language="en")


def test_pr_ndcg_and_ztest_math():
    m = ev.pr_ndcg([1, 2, 3], {2, 3}, k=3)
    assert m["p"] == round(2 / 3, 4) or abs(m["p"] - 2 / 3) < 1e-9
    assert m["r"] == 1.0 and 0.0 < m["ndcg"] <= 1.0
    assert ev.pr_ndcg([], set(), k=10) == {"p": 0.0, "r": 0.0, "ndcg": 0.0}
    assert ev.two_proportion_pvalue(5, 100, 5, 100) == 1.0  # identical -> p=1
    p = ev.two_proportion_pvalue(90, 100, 10, 100)
    assert 0.0 <= p < 1e-6  # wildly different -> ~0
    assert ev.two_proportion_pvalue(0, 0, 1, 5) == 1.0


def test_evaluate_from_data_synthetic():
    movies = [
        _fake_movie(1, "Action,Adventure"),
        _fake_movie(2, "Action,Adventure"),
        _fake_movie(3, "Comedy,Romance"),
        _fake_movie(4, "Comedy,Romance"),
        _fake_movie(5, "Action,Thriller"),
        _fake_movie(6, "Documentary"),
    ]
    train = {10: [(1, 5.0), (3, 4.5), (5, 4.0)], 11: [(3, 5.0), (4, 4.0), (1, 3.0)]}
    test = {10: {2}, 11: {4}}
    out = ev.evaluate_from_data(movies, train, test, k=2)
    assert set(out) == set(ev.ALGOS)
    for a, m in out.items():
        assert set(m) == {"p", "r", "ndcg", "coverage", "users"}
        assert m["users"] == 2
        assert all(0.0 <= m[x] <= 1.0 for x in ("p", "r", "ndcg", "coverage"))


def test_ab_assign_deterministic_and_split():
    assert svc_ab.assign_variant("sess-x") == svc_ab.assign_variant("sess-x")
    variants = {svc_ab.assign_variant(f"s-{i}") for i in range(20)}
    assert variants == {"A", "B"}


def test_ab_endpoint_flow_and_results():
    s1, s2 = f"ab1_{int(time.time())}", f"ab2_{int(time.time())}"
    v1 = client.get("/ab/assign", params={"session_id": s1}).json()["variant"]
    assert v1 in ("A", "B")
    r = client.get("/recommend/ab", params={"title": "Toy Story", "session_id": s1, "n": 3})
    assert r.status_code == 200 and r.json()["variant"] == v1
    assert len(r.json()["items"]) == 3
    assert client.post("/ab/event", json={"session_id": s1, "kind": "like"}).status_code == 201
    assert client.post("/ab/event", json={"session_id": s2, "kind": "click"}).status_code == 201
    assert client.post("/ab/event", json={"session_id": s1, "kind": "bogus"}).status_code == 422
    # admin sees results
    email = f"abadmin_{int(time.time())}@example.com"
    toks = client.post("/auth/register", json={"email": email, "password": "secret123"}).json()
    head = {"Authorization": f"Bearer {toks['access_token']}"}
    db = SessionLocal()
    try:
        db.query(User).filter(User.email == email).first().is_admin = True
        db.commit()
    finally:
        db.close()
    r = client.get("/admin/ab-results", headers=head)
    assert r.status_code == 200
    data = r.json()
    assert {"A", "B"} <= set(k for k in data if k in ("A", "B"))
    assert 0.0 <= data["p_value_ctr"] <= 1.0 and 0.0 <= data["p_value_like_rate"] <= 1.0
    # non-admin + anonymous blocked
    head2 = {"Authorization": f"Bearer {client.post('/auth/register', json={'email': f'plain_{int(time.time())}@example.com', 'password': 'secret123'}).json()['access_token']}"}
    assert client.get("/admin/ab-results", headers=head2).status_code == 403
    assert client.get("/admin/ab-results").status_code in (401, 403)


def test_admin_metrics_shape():
    email = f"madmin_{int(time.time())}@example.com"
    toks = client.post("/auth/register", json={"email": email, "password": "secret123"}).json()
    head = {"Authorization": f"Bearer {toks['access_token']}"}
    db = SessionLocal()
    try:
        db.query(User).filter(User.email == email).first().is_admin = True
        db.commit()
    finally:
        db.close()
    r = client.get("/admin/metrics", headers=head)
    assert r.status_code == 200 and "metrics" in r.json()
