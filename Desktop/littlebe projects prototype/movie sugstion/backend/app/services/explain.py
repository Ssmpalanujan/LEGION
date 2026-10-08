"""Explainable recommendations: reasons + similarity breakdown + friendly line.

If ANTHROPIC_API_KEY is set, the one-sentence explanation comes from Claude;
otherwise a deterministic template is used (never raises — silent fallback).
"""
import json
import os
from pathlib import Path

from app.models.entities import Movie

MOODS: dict = json.loads((Path(__file__).resolve().parents[1] / "core" / "mood_config.json").read_text())


def _split(csv: str) -> list[str]:
    return [p.strip() for p in (csv or "").split(",") if p.strip()]


def build_reasons(matched: Movie, rec: Movie, content_score: float = 0.0, collab_score: float = 0.0) -> dict:
    reasons: list[str] = []
    mg, rg = set(_split(matched.genres)), set(_split(rec.genres))
    shared_g = sorted(mg & rg)
    if shared_g:
        reasons.append(f"Shares genres: {', '.join(shared_g[:4])}")
    mc, rc = set(_split(matched.cast)), set(_split(rec.cast))
    shared_c = sorted(mc & rc)
    if shared_c:
        reasons.append(f"Shares cast: {', '.join(shared_c[:3])}")
    if matched.director and rec.director and matched.director == rec.director:
        reasons.append(f"Same director: {matched.director}")
    if collab_score > 0.05:
        reasons.append(f"Users who liked {matched.title} also liked this (collab {collab_score:.2f})")
    if not reasons:
        reasons.append("Picked for overall catalog similarity")
    breakdown = {
        "content": round(float(content_score), 4),
        "collab": round(float(collab_score), 4),
    }
    return {"reasons": reasons, "breakdown": breakdown, "friendly": friendly_line(matched, rec, reasons)}


def friendly_line(matched: Movie, rec: Movie, reasons: list[str]) -> str:
    """One-sentence explanation: Claude if key set, else template."""
    via_claude = _claude_line(matched.title, rec.title, reasons)
    if via_claude:
        return via_claude
    return f"Because you watched {matched.title}: {reasons[0][0].lower() + reasons[0][1:]} in {rec.title}."


def _claude_line(matched_title: str, rec_title: str, reasons: list[str]) -> str | None:
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    try:
        import urllib.request

        prompt = (
            "Write one friendly sentence (max 20 words) explaining why someone who liked "
            f"{matched_title!r} would enjoy {rec_title!r}, given: {'; '.join(reasons)}. "
            "No quotes, no preamble."
        )
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps({
                "model": "claude-3-haiku-20240307",
                "max_tokens": 80,
                "messages": [{"role": "user", "content": prompt}],
            }).encode(),
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            body = json.loads(r.read().decode())
        text = "".join(b.get("text", "") for b in body.get("content", []) if isinstance(b, dict)).strip()
        return text or None
    except Exception:
        return None


def mood_movies(movies: list[Movie], mood: str, n: int = 10) -> list[tuple[Movie, list[str]]]:
    """Rank movies by overlap with the mood's genre set. Raises KeyError on bad mood."""
    cfg = MOODS[mood]  # KeyError -> 422 in route
    want = set(cfg["genres"])
    scored = []
    for m in movies:
        mg = set(_split(m.genres))
        overlap = len(mg & want)
        if overlap:
            scored.append((overlap, m))
    scored.sort(key=lambda t: (-t[0], t[1].id))
    out = []
    for overlap, m in scored[: max(0, n)]:
        mg = sorted(set(_split(m.genres)) & want)
        out.append((m, [f"Matches mood '{mood}' via genres: {', '.join(mg[:4])}"]))
    return out
