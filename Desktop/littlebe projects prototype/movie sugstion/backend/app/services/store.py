"""Movie store: seed DB from MovieLens CSV, query helpers, CSV fallback."""
import csv
import re
from pathlib import Path
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.entities import Movie

YEAR_RE = re.compile(r"\((\d{4})\)\s*$")


def parse_year(title: str) -> str:
    m = YEAR_RE.search(title or "")
    return m.group(1) if m else ""


def find_movies_csv() -> Path | None:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / "data" / "ml-latest-small" / "movies.csv",
        here.parents[2] / "data" / "movies.csv",
        Path.cwd() / "backend" / "data" / "ml-latest-small" / "movies.csv",
        Path.cwd() / "data" / "ml-latest-small" / "movies.csv",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def seed_from_csv(db: Session) -> int:
    """Seed Movie table from movies.csv if empty. Returns rows inserted."""
    if db.query(Movie).count() > 0:
        return 0
    csv_path = find_movies_csv()
    if csv_path is None:
        return 0
    n = 0
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            title = row.get("title", "").strip()
            genres_raw = (row.get("genres", "") or "").replace("|", ",")
            if genres_raw == "(no genres listed)":
                genres_raw = ""
            try:
                ml_id = int(row.get("movieId", 0))
            except ValueError:
                ml_id = None
            m = Movie(
                movielens_id=ml_id,
                title=title,
                original_title=title,
                overview="",
                genres=genres_raw,
                year=parse_year(title),
                original_language="en",
            )
            db.add(m)
            n += 1
    db.commit()
    return n


def all_movies(db: Session) -> list[Movie]:
    """All movies ordered by id; seeds from CSV on first use."""
    seed_from_csv(db)
    return db.query(Movie).order_by(Movie.id).all()


def search_movies(db: Session, q: str, limit: int = 10) -> list[Movie]:
    """Case-insensitive partial match on title + original_title."""
    seed_from_csv(db)
    needle = (q or "").strip().lower()
    if not needle:
        return []
    like = f"%{needle}%"
    rows = (
        db.query(Movie)
        .filter(or_(Movie.title.ilike(like), Movie.original_title.ilike(like)))
        .order_by(Movie.title)
        .limit(limit * 3)
        .all()
    )
    # Prefer shortest title (closest match) then id — same rule as legacy recommender
    rows.sort(key=lambda m: (len(m.title), m.id))
    return rows[:limit]


class MovieNotFoundError(ValueError):
    pass


def find_best_match(db: Session, title: str) -> Movie:
    cands = search_movies(db, title, limit=10)
    if not cands:
        raise MovieNotFoundError(
            f"No movie found matching '{title}'. Try another title or use /search?q=... for suggestions."
        )
    return cands[0]
