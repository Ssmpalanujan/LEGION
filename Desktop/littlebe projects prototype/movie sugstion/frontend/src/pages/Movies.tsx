import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type Movie } from '../api'
import { MovieCard } from '../components/MovieCard'

const SEEDS = ['Toy Story', 'Matrix', 'Pulp Fiction', 'Jurassic Park', 'Titanic', 'Forrest Gump']

// Movies = full catalog browser (filter + genre + mood).
export function Movies() {
  const [params] = useSearchParams()
  const mood = params.get('mood') || ''
  const [all, setAll] = useState<Movie[]>([])
  const [q, setQ] = useState('')
  const [genre, setGenre] = useState('')
  const [moodItems, setMoodItems] = useState<Movie[] | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const map = new Map<number, Movie>()
      for (const s of SEEDS) {
        try {
          const r = await api.recommend(s, 8)
          map.set(r.matched.id, r.matched as Movie)
          r.items.forEach((m) => map.set(m.id, m))
        } catch {
          /* ignore */
        }
      }
      if (alive) setAll([...map.values()])
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!mood) {
      setMoodItems(null)
      return
    }
    void api.mood(mood, 12).then((d) => setMoodItems(d.items)).catch(() => setMoodItems([]))
  }, [mood])

  const genres = useMemo(() => {
    const s = new Set<string>()
    all.forEach((m) => (m.genres || []).forEach((g) => s.add(g)))
    return [...s].sort()
  }, [all])

  const list = (moodItems ?? all).filter((m) => {
    const okQ = !q.trim() || m.title.toLowerCase().includes(q.trim().toLowerCase())
    const okG = !genre || (m.genres || []).includes(genre)
    return okQ && okG
  })

  return (
    <main id="main" className="wrap">
      <h1 className="page-title">{mood ? `Mood: ${mood}` : 'Movies'}</h1>
      <div className="toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title…" aria-label="Filter by title" />
        <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Filter by genre">
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <span style={{ color: 'var(--muted)' }}>{list.length} titles</span>
      </div>
      <div className="grid">
        {list.map((m) => (
          <MovieCard key={m.id} movie={m} why={(m.reasons || [])[0]} />
        ))}
      </div>
      {list.length === 0 && <p className="tip">No titles match.</p>}
    </main>
  )
}

// Tamil / Sinhala Cinema: language-filtered catalog views.
export function LanguageShelf({ lang, title }: { lang: string; title: string }) {
  const [movies, setMovies] = useState<Movie[]>([])
  useEffect(() => {
    void api
      .semantic(`${lang} cinema`, 30)
      .then((d) => setMovies(d.results.filter((m) => m.original_language === lang)))
      .catch(() => setMovies([]))
  }, [lang])
  return (
    <main id="main" className="wrap">
      <h1 className="page-title">{title}</h1>
      {movies.length === 0 ? (
        <p className="tip">
          No {title} titles in the local catalog yet — ingest TMDB with Tamil/Sinhala movies
          (backend/scripts/ingest_tmdb.py) to fill this shelf.
        </p>
      ) : (
        <div className="grid">
          {movies.map((m) => (
            <MovieCard key={m.id} movie={m} />
          ))}
        </div>
      )}
    </main>
  )
}
