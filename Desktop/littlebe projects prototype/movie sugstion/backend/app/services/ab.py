"""Deterministic A/B assignment (hash) + event logging."""
import hashlib

from app.models.entities import ABEvent


def assign_variant(session_id: str) -> str:
    """A or B from sha256(session_id) — stable per session/user."""
    h = hashlib.sha256((session_id or "anon").encode()).hexdigest()
    return "A" if int(h, 16) % 2 == 0 else "B"


def log_event(db, variant: str, kind: str) -> None:
    db.add(ABEvent(variant=variant, kind=kind))
    db.commit()


def variant_stats(db) -> dict:
    """Counts/rates per variant + two-proportion p-values (clicks & likes vs impressions)."""
    from app.evaluation.metrics import two_proportion_pvalue

    out = {}
    for v in ("A", "B"):
        imp = db.query(ABEvent).filter(ABEvent.variant == v, ABEvent.kind == "impression").count()
        clk = db.query(ABEvent).filter(ABEvent.variant == v, ABEvent.kind == "click").count()
        lik = db.query(ABEvent).filter(ABEvent.variant == v, ABEvent.kind == "like").count()
        out[v] = {
            "impressions": imp,
            "clicks": clk,
            "likes": lik,
            "ctr": round(clk / imp, 4) if imp else 0.0,
            "like_rate": round(lik / imp, 4) if imp else 0.0,
        }
    a, b = out["A"], out["B"]
    out["p_value_ctr"] = two_proportion_pvalue(a["clicks"], a["impressions"], b["clicks"], b["impressions"])
    out["p_value_like_rate"] = two_proportion_pvalue(a["likes"], a["impressions"], b["likes"], b["impressions"])
    return out
