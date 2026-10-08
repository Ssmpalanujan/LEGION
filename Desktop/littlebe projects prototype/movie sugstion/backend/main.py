"""FastAPI backend for the Movie Recommendation System."""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

try:
    from recommender import MovieNotFoundError, recommend, search_titles
except ImportError:  # support `uvicorn backend.main:app` from project root
    from backend.recommender import MovieNotFoundError, recommend, search_titles

app = FastAPI(title="Movie Recommendation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # frontend dev server + docker; tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/recommend")
def recommend_endpoint(
    title: str = Query(..., description="Movie title (partial, case-insensitive)"),
    n: int = Query(5, ge=1, le=20, description="Number of recommendations"),
):
    try:
        result = recommend(title, n=n)
    except MovieNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "query": title,
        "matched_title": result["matched_title"],
        "matched": result.get("matched"),
        "recommendations": result["recommendations"],
        "items": result.get("items", []),
    }


@app.get("/search")
def search_endpoint(q: str = Query("", description="Partial title for autocomplete")):
    try:
        results = search_titles(q, limit=10)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"query": q, "results": results}
