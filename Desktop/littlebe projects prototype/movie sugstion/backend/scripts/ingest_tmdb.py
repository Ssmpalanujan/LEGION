"""Fetch movies from TMDB (free API) with a Tamil-first strategy.

Usage:
    python backend/scripts/ingest_tmdb.py [--tamil 1500] [--limit 500] [--min-votes 5]

- Discovers Tamil titles via /discover/movie?with_original_language=ta until
  --tamil Tamil movies are stored (default 1500), plus --limit popular/top-rated
  general titles for variety.
- Genre names come from a single /genre/movie/list call (no per-movie calls).
- links.csv (MovieLens) backfills tmdb_id onto existing rows so trailers and
  TMDB matching work for the MovieLens catalog too; TMDB movies already mapped
  are skipped instead of duplicated.
- Raw page responses are cached under backend/data/tmdb_cache/ (stable names).
- Rate limits respected (sleep + retries). Without TMDB_API_KEY: exits 0 in
  degraded MovieLens-only mode. Key is read from env or backend/.env / .env
  (never printed or committed).
"""

import argparse
import hashlib
import json
import logging
import sys
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("ingest_tmdb")

HERE = Path(__file__).resolve()
BACKEND_DIR = HERE.parents[1]
ROOT_DIR = BACKEND_DIR.parent
CACHE_DIR = BACKEND_DIR / "data" / "tmdb_cache"
BASE = "https://api.themoviedb.org/3"


def load_dotenv() -> None:
    """Minimal .env loader (no dependency): backend/.env then root .env."""
    import os

    for p in (BACKEND_DIR / ".env", ROOT_DIR / ".env"):
        try:
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except FileNotFoundError:
            continue


def cache_path(url: str) -> Path:
    digest = hashlib.md5(url.encode()).hexdigest()[:16]
    return CACHE_DIR / f"page_{digest}.json"


def fetch_json(url: str) -> dict | None:
    import urllib.request

    cp = cache_path(url)
    if cp.exists():
        try:
            return json.loads(cp.read_text(encoding="utf-8"))
        except Exception:
            pass
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                payload = json.loads(r.read().decode())
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            cp.write_text(json.dumps(payload), encoding="utf-8")
            time.sleep(0.25)  # rate-limit courtesy
            return payload
        except Exception as e:
            log.warning("retry (%s): %s", url.split("api_key=")[0][:90], e)
            time.sleep(2 * (attempt + 1))
    return None


def genre_map(api_key: str) -> dict[int, str]:
    payload = fetch_json(f"{BASE}/genre/movie/list?api_key={api_key}&language=en-US") or {}
    return {g["id"]: g["name"] for g in payload.get("genres", []) if "id" in g and "name" in g}


def genre_names(gmap: dict[int, str], ids: list) -> str:
    return ", ".join(gmap[i] for i in (ids or []) if i in gmap)


def load_links() -> dict[int, int]:
    """MovieLens movieId -> TMDB id from links.csv (empty dict if missing)."""
    import csv

    out: dict[int, int] = {}
    for cand in (
        BACKEND_DIR / "data" / "ml-latest-small" / "links.csv",
        Path.cwd() / "backend" / "data" / "ml-latest-small" / "links.csv",
    ):
        if not cand.exists():
            continue
        with open(cand, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                try:
                    out[int(row["movieId"])] = int(float(row["tmdbId"]))
                except (ValueError, KeyError):
                    continue
        break
    return out


def movie_kwargs(item: dict, gmap: dict[int, str]) -> dict:
    return {
        "tmdb_id": item.get("id"),
        "title": item.get("title") or item.get("original_title") or "",
        "original_title": item.get("original_title") or "",
        "overview": item.get("overview") or "",
        "genres": genre_names(gmap, item.get("genre_ids")),
        "year": (item.get("release_date") or "")[:4],
        "original_language": item.get("original_language") or "en",
        "poster_path": item.get("poster_path") or "",
        "backdrop_path": item.get("backdrop_path") or "",
        "vote_average": float(item.get("vote_average") or 0.0),
        "popularity": float(item.get("popularity") or 0.0),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tamil", type=int, default=1500, help="Target Tamil titles to store")
    ap.add_argument("--limit", type=int, default=500, help="General popular/top-rated titles")
    ap.add_argument("--min-votes", type=int, default=5, help="Skip titles with fewer votes")
    args = ap.parse_args()

    load_dotenv()
    import os

    api_key = os.getenv("TMDB_API_KEY", "")
    if not api_key:
        log.warning("TMDB_API_KEY missing — degraded mode: skipping TMDB ingest (MovieLens-only).")
        return 0

    sys.path.insert(0, str(BACKEND_DIR))
    from app.models.db import SessionLocal, init_db
    from app.models.entities import Movie

    gmap = genre_map(api_key)
    log.info("Loaded %d TMDB genres.", len(gmap))
    links = load_links()
    log.info("Loaded %d links.csv mappings.", len(links))

    init_db()
    db = SessionLocal()
    try:
        # 1) Backfill tmdb_id onto MovieLens rows via links.csv (trailers + matching).
        backfilled = 0
        for m in db.query(Movie).filter(Movie.tmdb_id.is_(None)).all():
            tid = links.get(m.movielens_id or -1)
            if tid:
                m.tmdb_id = tid
                backfilled += 1
        if backfilled:
            db.commit()
        log.info("Backfilled tmdb_id on %d MovieLens rows.", backfilled)
        existing_tmdb = {
            r[0] for r in db.query(Movie.tmdb_id).filter(Movie.tmdb_id.isnot(None)).all()
        }

        def store(item: dict) -> str | None:
            tid = item.get("id")
            if tid is None or tid in existing_tmdb:
                return None
            try:
                if float(item.get("vote_count") or 0) < args.min_votes:
                    return None
            except (TypeError, ValueError):
                pass
            kw = movie_kwargs(item, gmap)
            if not kw["title"]:
                return None
            db.add(Movie(**kw))
            existing_tmdb.add(tid)
            return kw["original_language"]

        # 2) Tamil-first discovery (popularity order).
        tamil = general = 0
        page = 1
        while tamil < args.tamil and page <= 500:
            url = (
                f"{BASE}/discover/movie?api_key={api_key}&language=en-US"
                f"&with_original_language=ta&sort_by=popularity.desc"
                f"&include_adult=false&page={page}"
            )
            payload = fetch_json(url)
            if not payload or not payload.get("results"):
                break
            for item in payload["results"]:
                if tamil >= args.tamil:
                    break
                lang = store(item)
                if lang == "ta":
                    tamil += 1
            db.commit()
            log.info("Tamil stored: %d/%d (page %d).", tamil, args.tamil, page)
            page += 1

        # 3) General popular + top-rated for variety.
        page = 1
        while general < args.limit and page <= 60:
            for kind in ("movie/popular", "movie/top_rated"):
                if general >= args.limit:
                    break
                url = f"{BASE}/{kind}?api_key={api_key}&language=en-US&page={page}"
                payload = fetch_json(url) or {}
                for item in payload.get("results", []):
                    if general >= args.limit:
                        break
                    if store(item):
                        general += 1
                db.commit()
            log.info("General stored: %d/%d (page %d).", general, args.limit, page)
            page += 1

        total_ta = db.query(Movie).filter(Movie.original_language == "ta").count()
        log.info("Done. Tamil in DB: %d (this run: +%d ta, +%d general).", total_ta, tamil, general)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
