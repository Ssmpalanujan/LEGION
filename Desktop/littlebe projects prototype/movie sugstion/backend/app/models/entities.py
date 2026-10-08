"""Postgres/SQLite models for CineMatch (Phase 1 + forward-compatible columns)."""
from datetime import datetime
from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.db import Base


def _now() -> datetime:
    return datetime.utcnow()


class Movie(Base):
    __tablename__ = "movies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)
    movielens_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)
    title: Mapped[str] = mapped_column(String(300), index=True)
    original_title: Mapped[str] = mapped_column(String(300), default="", index=True)
    overview: Mapped[str] = mapped_column(Text, default="")
    genres: Mapped[str] = mapped_column(String(500), default="")  # comma-separated
    year: Mapped[str] = mapped_column(String(4), default="")
    original_language: Mapped[str] = mapped_column(String(8), default="en")
    poster_path: Mapped[str] = mapped_column(String(300), default="")
    backdrop_path: Mapped[str] = mapped_column(String(300), default="")
    cast: Mapped[str] = mapped_column(Text, default="")  # comma-separated names
    director: Mapped[str] = mapped_column(String(200), default="")
    trailer_key: Mapped[str] = mapped_column(String(50), default="")  # YouTube key
    vote_average: Mapped[float] = mapped_column(Float, default=0.0)
    popularity: Mapped[float] = mapped_column(Float, default=0.0)


class Genre(Base):
    __tablename__ = "genres"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Rating(Base):
    __tablename__ = "ratings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    movie_id: Mapped[int] = mapped_column(ForeignKey("movies.id"), index=True)
    score: Mapped[float] = mapped_column(Float)  # 0.5..5.0
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    __table_args__ = (UniqueConstraint("user_id", "movie_id", name="uq_rating_user_movie"),)


class Swipe(Base):
    __tablename__ = "swipes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    movie_id: Mapped[int] = mapped_column(ForeignKey("movies.id"), index=True)
    liked: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class WatchlistItem(Base):
    __tablename__ = "watchlist"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    movie_id: Mapped[int] = mapped_column(ForeignKey("movies.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    __table_args__ = (UniqueConstraint("user_id", "movie_id", name="uq_watch_user_movie"),)


class Room(Base):
    """Movie Night room (Phase 8). participants stored as JSON string of user ids."""
    __tablename__ = "rooms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(6), unique=True, index=True)
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    participants: Mapped[str] = mapped_column(Text, default="[]")
    deck: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of movie ids
    status: Mapped[str] = mapped_column(String(20), default="open")
    result_movie_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class RoomSwipe(Base):
    """Per-room swipes for Movie Night (separate from personal Swipe table)."""
    __tablename__ = "room_swipes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    movie_id: Mapped[int] = mapped_column(ForeignKey("movies.id"), index=True)
    liked: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class EvalResult(Base):
    __tablename__ = "eval_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    algo: Mapped[str] = mapped_column(String(50))
    precision_at_k: Mapped[float] = mapped_column(Float, default=0.0)
    recall_at_k: Mapped[float] = mapped_column(Float, default=0.0)
    ndcg_at_k: Mapped[float] = mapped_column(Float, default=0.0)
    coverage: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class ABEvent(Base):
    """Impression/click-like events per A/B variant (Phase 9)."""
    __tablename__ = "ab_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    variant: Mapped[str] = mapped_column(String(10), index=True)  # A or B
    kind: Mapped[str] = mapped_column(String(20))  # impression | like | click
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
