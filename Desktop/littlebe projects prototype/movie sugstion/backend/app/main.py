"""FastAPI application factory for CineMatch."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_admin import router as admin_router
from app.api.routes_auth import router as auth_router
from app.api.routes_core import router as core_router
from app.api.routes_mood import router as mood_router
from app.api.routes_movies import router as movies_router
from app.api.routes_personal import router as personal_router
from app.api.routes_recommend import router as recommend_router
from app.api.routes_rooms import router as rooms_router
from app.api.routes_search import router as search_router
from app.api.ws_rooms import router as ws_router
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
    app.include_router(movies_router, tags=["movies"])
    app.include_router(auth_router)
    app.include_router(personal_router)
    app.include_router(rooms_router)
    app.include_router(ws_router)
    app.include_router(admin_router)
    app.include_router(recommend_router, tags=["recommend"])
    app.include_router(mood_router, tags=["recommend"])
    app.include_router(search_router, tags=["search"])
    return app


app = create_app()
