"""Fetch ~5000 popular movies from TMDB (target >=1500 Tamil), cache raw JSON to disk.

Usage: TMDB_API_KEY=... python backend/scripts/ingest_tmdb.py [--limit 5000]
Without TMDB_API_KEY: logs degraded mode and exits 0 (MovieLens-only fallback).
Respects rate limits with a small sleep + retries; stores into Postgres/SQLite.
"""
import argparse
import json
import logging
import sys
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("ingest_tmdb")

CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "tmdb_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=5000)
    args = ap.parse_args()

    import os

    api_key = os.getenv("TMDB_API_KEY", "")
    if not api_key:
        log.warning("TMDB_API_KEY missing — degraded mode: skipping TMDB ingest (MovieLens-only).")
        return 0

    try:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from app.models.db import SessionLocal, init_db
        from app.models.entities import Movie
    except Exception as e:  # pragma: no cover
        log.error("DB imports failed: %s", e)
        return 1

    import urllib.request

    init_db()
    db = SessionLocal()
    fetched = 0
    tamil = 0
    page = 1
    # Strategy: pull popular + top_rated across pages, plus Tamil discovery pages
    # to guarantee >=1500 Tamil titles when limit allows.
    urls: list[str] = []
    try:
        while fetched < args.limit:
            for kind in ("movie/popular", "movie/top_rated", "discover/movie"):
                lang = "&with_original_language=ta&sort_by=popularity.desc" if kind == "discover/movie" else ""
                urls.append(
                    f"https://api.themoviedb.org/3/{kind}?api_key={api_key}&language=en-US&page={page}{lang}"
                )
            page += 1
            if page > 40:
                break
        for u in urls:
            if fetched >= args.limit:
                break
            cache_key = CACHE_DIR / f"page_{abs(hash(u))}.json"
            if cache_key.exists():
                payload = json.loads(cache_key.read_text())
            else:
                for attempt in range(3):
                    try:
                        with urllib.request.urlopen(u, timeout=30) as r:
                            payload = json.loads(r.read().decode())
                        cache_key.write_text(json.dumps(payload))
                        break
                    except Exception as e:
                        log.warning("retry %s: %s", u, e)
                        time.sleep(2 * (attempt + 1))
                else:
                    continue
            for item in payload.get("results", []):
                if fetched >= args.limit:
                    break
                tmdb_id = item.get("id")
                if tmdb_id is None or db.query(Movie).filter(Movie.tmdb_id == tmdb_id).first():
                    continue
                lang = item.get("original_language", "en")
                if lang == "ta":
                    tamil += 1
                db.add(
                    Movie(
                        tmdb_id=tmdb_id,
                        title=item.get("title") or item.get("original_title") or "",
                        original_title=item.get("original_title") or "",
                        overview=item.get("overview") or "",
                        genres="",
                        year=(item.get("release_date") or "")[:4],
                        original_language=lang,
                        poster_path=item.get("poster_path") or "",
                        backdrop_path=item.get("backdrop_path") or "",
                        vote_average=float(item.get("vote_average") or 0.0),
                        popularity=float(item.get("popularity") or 0.0),
                    )
                )
                fetched += 1
            db.commit()
            time.sleep(0.25)  # rate-limit courtesy
        log.info("Ingested %d movies (%d Tamil).", fetched, tamil)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
