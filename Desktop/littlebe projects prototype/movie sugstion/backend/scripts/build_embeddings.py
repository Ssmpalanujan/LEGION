"""Precompute movie embeddings into backend/data/embeddings/.

Uses LaBSE if installed (needs network once), else TF-IDF fallback matrix.
Saves embeddings.npy + ids.json + meta.json. Runtime works without these
files (builds in-memory index), but precomputing speeds cold starts.
"""

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "embeddings"
OUT.mkdir(parents=True, exist_ok=True)


def main() -> int:
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.models.db import SessionLocal, init_db
    from app.services.semantic import MODEL_NAME, _lase_or_none, doc_for_semantic
    from app.services.store import all_movies

    init_db()
    db = SessionLocal()
    try:
        movies = all_movies(db)
    finally:
        db.close()
    docs = [doc_for_semantic(m) for m in movies]
    model = _lase_or_none()
    if model is not None:
        print(f"Encoding {len(docs)} docs with {MODEL_NAME} ...")
        import numpy as np

        emb = model.encode(docs, normalize_embeddings=True, show_progress_bar=True)
        np.save(str(OUT / "embeddings.npy"), emb)
        backend = "lase"
    else:
        print("sentence-transformers unavailable — building TF-IDF fallback matrix ...")
        import numpy as np
        from sklearn.feature_extraction.text import TfidfVectorizer

        mat = TfidfVectorizer(stop_words="english").fit_transform(docs).toarray().astype("float32")
        norms = (mat**2).sum(axis=1, keepdims=True) ** 0.5
        norms[norms == 0] = 1.0
        np.save(str(OUT / "embeddings.npy"), mat / norms)
        backend = "tfidf"
    (OUT / "ids.json").write_text(json.dumps([m.id for m in movies]))
    (OUT / "meta.json").write_text(
        json.dumps({"backend": backend, "model": MODEL_NAME, "count": len(movies)})
    )
    print(f"Saved {len(movies)} embeddings ({backend}) to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
