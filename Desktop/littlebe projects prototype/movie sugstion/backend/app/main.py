"""FastAPI application factory for CineMatch."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_core import router as core_router
from app.core.config import get_settings
from app.models.db import init_db


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="CineMatch API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup() -> None:
        init_db()
        # Seed from MovieLens CSV so a fresh SQLite DB works immediately
        from app.models.db import SessionLocal
        from app.services.store import seed_from_csv

        db = SessionLocal()
        try:
            seed_from_csv(db)
        finally:
            db.close()

    app.include_router(core_router, tags=["core"])
    return app


app = create_app()
