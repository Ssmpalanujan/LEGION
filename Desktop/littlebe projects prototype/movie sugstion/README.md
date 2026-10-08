# Movie Recommendation System — Neon Cinema Edition

A user types a movie title and gets 5 similar movie recommendations.

Content-based filtering with TF-IDF on genres + cosine similarity, using the
MovieLens `ml-latest-small` dataset. Backend is FastAPI, frontend is a
full-width dark cinematic site (Netflix/HBO style) in React (Vite).

## Project overview

- Backend loads `movies.csv`, replaces `|` in genres with spaces, builds a
  TF-IDF matrix on genres, computes cosine similarity, and returns the top-N
  most similar titles (excluding the query movie itself).
- Title matching is case-insensitive and partial: `"toy story"` matches
  `"Toy Story (1995)"`.
- `/recommend` returns `matched_title` + `recommendations` (title strings, backwards
  compatible) plus rich `matched` / `items` objects with `title`, `genres`,
  `genres_display` and `year` for the UI.
- Frontend: full-width dark cinematic theme, sticky navbar (Home / Browse /
  My List + live search), billboard hero with TMDB backdrop, rails
  (Trending Now + genre rows from backend seeds), detail pages (similar grid,
  cast, trailers), My List with 1–5 star ratings (localStorage).
- Posters/backdrops/cast/trailers come from the TMDB API (`VITE_TMDB_KEY`).
  No copyrighted artwork is bundled — without a key the UI uses gradient
  placeholders.
- API base URL is configurable via `VITE_API_URL`.

## Folder structure

```text
.
├── backend/
│   ├── main.py                  # FastAPI app (/recommend, /search, /health)
│   ├── recommender.py           # TF-IDF + cosine similarity logic
│   ├── download_data.py         # Downloads ml-latest-small into backend/data/
│   ├── requirements.txt
│   ├── Dockerfile               # python:3.11-slim + uvicorn
│   └── tests/
│       └── test_recommender.py  # pytest: recommender + API endpoints
├── frontend/
│   ├── package.json             # Vite + React
│   ├── vite.config.js
│   ├── index.html               # Anton / Barlow Condensed / DM Sans
│   ├── .env.example             # VITE_API_URL + VITE_TMDB_KEY
│   ├── nginx.conf
│   ├── Dockerfile               # node build + nginx serve
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # navbar + hero + rows + detail + saved/ratings
│       ├── tmdb.js              # TMDB posters / backdrops / trending / cast / trailers
│       └── index.css            # dark cinematic theme, responsive to 1200px
├── docker-compose.yml           # backend + frontend services
├── README.md
└── .gitignore
```

## Setup — local

Prerequisites: Python 3.10+, Node 18+.

### 1. Backend

```powershell
# From the project root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt

# Download MovieLens data into backend/data/
python backend\download_data.py

# Run tests
pytest backend\tests\ -v

# Start the API (run from backend/ so `import recommender` resolves;
# or use uvicorn backend.main:app from the root)
cd backend
uvicorn main:app --reload --port 8000
```

Backend is then available at `http://localhost:8000`.

Verify:

```powershell
curl "http://localhost:8000/health"
curl "http://localhost:8000/recommend?title=Toy%20Story"
curl "http://localhost:8000/search?q=Toy"
```

### 2. Frontend

```powershell
cd frontend
copy .env.example .env   # set VITE_API_URL + VITE_TMDB_KEY (TMDB key optional)
npm install
npm run dev
```

Frontend dev server runs at `http://localhost:5173` and talks to the backend
via `VITE_API_URL` (defaults to `http://localhost:8000`).

- Get a free TMDB API key at https://www.themoviedb.org/settings/api and put it
  in `.env` as `VITE_TMDB_KEY=...` to enable real posters, backdrops, trending,
  cast and trailers. Without it the app uses gradient placeholders
  (no bundled artwork).
- Pages: **Home** (billboard + rails), **Browse** (filterable catalog grid),
  click any poster for its **detail page**, **My List** (saved + star ratings).

## Setup — Docker

```powershell
docker compose up --build
```

- Backend: `http://localhost:8000`
- Frontend (nginx): `http://localhost:3000`

Stop with `docker compose down`.

Note: the backend image does not bundle the dataset. The compose file mounts
`./backend/data` into the container, so run `python backend/download_data.py`
once on the host before `docker compose up`. Alternatively `docker compose run
backend python download_data.py`.

## API examples with curl

Health check:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

Get 5 recommendations (partial, case-insensitive):

```bash
curl "http://localhost:8000/recommend?title=Toy%20Story"
```

```json
{
  "query": "Toy Story",
  "matched_title": "Toy Story (1995)",
  "recommendations": [
    "Antz (1998)",
    "Toy Story 2 (1999)",
    "Adventures of Rocky and Bullwinkle, The (2000)",
    "Emperor's New Groove, The (2000)",
    "Monsters, Inc. (2001)"
  ]
}
```

Custom count:

```bash
curl "http://localhost:8000/recommend?title=matrix&n=3"
```

Autocomplete (up to 10 titles):

```bash
curl "http://localhost:8000/search?q=Toy"
```

Not found (404 with helpful message):

```bash
curl "http://localhost:8000/recommend?title=NoSuchMovie123"
# {"detail":"No movie found matching 'NoSuchMovie123'. Try another title ..."}
```

Interactive docs: `http://localhost:8000/docs`.

## Next steps

- **Collaborative filtering using `ratings.csv`**: build a user–item matrix,
  compute item–item cosine similarity (or use SVD / ALS), and recommend movies
  liked by users with similar taste. Evaluate with train/test split on ratings
  (RMSE, Precision@K, Recall@K).
- **Hybrid model**: combine content-based (genres TF-IDF) and collaborative
  scores, e.g. weighted average, with fallback to content-based for cold-start
  movies/users with few ratings.
- Other ideas: add posters via TMDB API, genre/year filters, persistent
  caching of the similarity matrix (pickle/npz), pagination, and frontend
  tests.
