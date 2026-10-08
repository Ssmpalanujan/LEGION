"""Admin routes. Phase 6/7: cache clear. Phase 9 adds metrics + A/B results."""
from fastapi import APIRouter, Depends

from app.core import cache as cache_mod
from app.core.security import require_admin
from app.models.entities import EvalResult, User
from app.models.db import get_db
from app.services import ab as svc_ab
from sqlalchemy.orm import Session

router = APIRouter(prefix="/admin", tags=["admin"])


@router.delete("/cache")
def cache_clear(_: User = Depends(require_admin)):
    deleted = cache_mod.invalidate()
    return {"ok": True, "deleted": deleted}


@router.get("/metrics")
def metrics(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Latest offline evaluation results per algorithm (scripts/run_evaluation.py)."""
    rows = db.query(EvalResult).order_by(EvalResult.id.desc()).limit(50).all()
    latest: dict[str, dict] = {}
    for r in rows:
        latest.setdefault(r.algo, {
            "algo": r.algo,
            "precision_at_k": r.precision_at_k,
            "recall_at_k": r.recall_at_k,
            "ndcg_at_k": r.ndcg_at_k,
            "coverage": r.coverage,
            "created_at": str(r.created_at),
        })
    return {"metrics": list(latest.values())}


@router.get("/ab-results")
def ab_results(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    """CTR/like-rate per variant with two-proportion z-test p-values."""
    return svc_ab.variant_stats(db)
