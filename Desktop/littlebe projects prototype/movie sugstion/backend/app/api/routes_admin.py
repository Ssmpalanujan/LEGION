"""Admin routes. Phase 6/7: cache clear. Phase 9 adds metrics + A/B results."""
from fastapi import APIRouter, Depends

from app.core import cache as cache_mod
from app.core.security import require_admin
from app.models.entities import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.delete("/cache")
def cache_clear(_: User = Depends(require_admin)):
    deleted = cache_mod.invalidate()
    return {"ok": True, "deleted": deleted}
