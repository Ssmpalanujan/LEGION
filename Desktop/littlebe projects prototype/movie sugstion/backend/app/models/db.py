"""SQLAlchemy engine/session. SQLite by default (local/tests), Postgres via DATABASE_URL."""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import get_settings

settings = get_settings()
url = settings.resolved_database_url()
connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}

engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models import entities  # noqa: F401  (register tables)

    Base.metadata.create_all(bind=engine)
