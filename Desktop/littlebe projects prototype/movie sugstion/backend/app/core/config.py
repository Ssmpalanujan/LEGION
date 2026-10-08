"""Central configuration. All secrets/URLs come from environment (.env)."""

import os
from functools import lru_cache
from pathlib import Path

try:
    from pydantic_settings import BaseSettings
except ImportError:  # pragma: no cover - fallback if pydantic-settings missing

    class BaseSettings:  # type: ignore
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)


class Settings(BaseSettings):
    app_name: str = "CineMatch"
    tmdb_api_key: str = os.getenv("TMDB_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-change-me")
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    refresh_token_days: int = 14
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./cinematch.db")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    backend_dir: Path = Path(__file__).resolve().parents[2]
    data_dir: Path = Path(__file__).resolve().parents[2] / "data"

    class Config:
        env_file = ".env"
        extra = "ignore"

    def resolved_database_url(self) -> str:
        """Anchor relative SQLite paths to the backend dir.

        Decision: bare `sqlite:///./x.db` used to resolve against the process
        working directory, so running uvicorn from backend/ and scripts from
        the repo root silently created TWO different databases. Anchoring to
        the backend package dir keeps one database per environment.
        Absolute URLs (e.g. postgres://) are untouched.
        """
        url = self.database_url
        if url.startswith("sqlite:///./") or url.startswith("sqlite://./"):
            name = url.split("sqlite:///", 1)[-1].lstrip("./")
            return f"sqlite:///{(self.backend_dir / name).as_posix()}"
        return url


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
