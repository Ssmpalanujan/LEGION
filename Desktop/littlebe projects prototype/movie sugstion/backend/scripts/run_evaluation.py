"""Run offline evaluation and save results to the database.

Usage: python backend/scripts/run_evaluation.py [--k 10] [--users 30]
Prints a Precision@K / Recall@K / NDCG@K / coverage table per algorithm.
"""

import argparse
from pathlib import Path


def main() -> int:
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.evaluation.metrics import ALGOS
    from app.evaluation.metrics import evaluate as run_eval
    from app.models.db import SessionLocal, init_db
    from app.models.entities import EvalResult
    from app.services.collab import find_ratings_csv

    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--users", type=int, default=30)
    args = ap.parse_args()

    init_db()
    db = SessionLocal()
    try:
        from app.services.store import seed_from_csv

        seed_from_csv(db)
        rp = find_ratings_csv()
        if rp is None:
            print("ratings.csv not found — run download_movielens.py first.")
            return 1
        results = run_eval(db, str(rp), k=args.k, max_users=args.users)
        db.query(EvalResult).delete()
        for algo in ALGOS:
            m = results[algo]
            db.add(
                EvalResult(
                    algo=algo,
                    precision_at_k=m["p"],
                    recall_at_k=m["r"],
                    ndcg_at_k=m["ndcg"],
                    coverage=m["coverage"],
                )
            )
        db.commit()
        print(f"{'algo':<12}{'P@K':>8}{'R@K':>8}{'NDCG@K':>9}{'coverage':>10}  users")
        for algo in ALGOS:
            m = results[algo]
            row = f"{algo:<12}{m['p']:>8.4f}{m['r']:>8.4f}{m['ndcg']:>9.4f}"
            print(f"{row}{m['coverage']:>10.4f}  {m['users']}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
