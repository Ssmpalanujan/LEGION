import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  backdropUrl,
  cleanTitle,
  getMovieBundle,
  getPopular,
  getTrending,
  hasTmdbKey,
  posterUrl,
  searchMovie,
} from './tmdb.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TMDB_ON = hasTmdbKey()

// Diverse seeds guaranteed to exist in MovieLens (partial match)
const SEEDS = [
  { label: 'Animation & Family', seed: 'Toy Story' },
  { label: 'Sci-Fi Worlds', seed: 'Matrix' },
  { label: 'Crime & Drama', seed: 'Pulp Fiction' },
  { label: 'Adventure Epics', seed: 'Jurassic Park' },
]

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '')
    return v ?? fallback
  } catch {
    return fallback
  }
}

function Stars({ value = 0, onRate, size = '1rem' }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`Rated ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={`star ${n <= value ? 'on' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onRate?.(n === value ? 0 : n)
          }}
          aria-label={`Rate ${n}`}
          title={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </span>
  )
}

function Poster({ title, tmdbPath, size = 'w342', className = '' }) {
  const [path, setPath] = useState(tmdbPath || null)
  useEffect(() => {
    if (tmdbPath || !TMDB_ON) return
    let alive = true
    searchMovie(title)
      .then((m) => {
        if (alive && m?.poster_path) setPath(m.poster_path)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [title, tmdbPath])
  const src = path ? posterUrl(path, size) : null
  if (src) return <img className={`img ${className}`} src={src} alt={`${cleanTitle(title)} poster`} loading="lazy" />
  return (
    <div className={`fallback ${className}`} aria-hidden="true">
      <span className="fallback-title">{cleanTitle(title)}</span>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState({ name: 'home' }) // home | browse | detail | saved
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [rows, setRows] = useState([]) // [{label, seed, matched, items}]
  const [trending, setTrending] = useState([])
  const [hero, setHero] = useState(null) // { backendTitle, matched, bundle }
  const [detail, setDetail] = useState(null) // { matched, items, bundle, loading }
  const [browseFilter, setBrowseFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(() => loadJSON('cine-saved', []))
  const [ratings, setRatings] = useState(() => loadJSON('cine-ratings', {}))

  useEffect(() => {
    localStorage.setItem('cine-saved', JSON.stringify(saved))
  }, [saved])
  useEffect(() => {
    localStorage.setItem('cine-ratings', JSON.stringify(ratings))
  }, [ratings])

  const isSaved = useCallback((title) => saved.some((s) => s.title === title), [saved])
  const toggleSaved = useCallback(
    (movie) => {
      setSaved((prev) =>
        prev.some((s) => s.title === movie.title)
          ? prev.filter((s) => s.title !== movie.title)
          : [...prev, movie]
      )
    },
    []
  )
  const rate = useCallback((title, n) => {
    setRatings((prev) => ({ ...prev, [title]: n }))
  }, [])

  // ---- catalog load ----
  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const fetched = await Promise.all(
          SEEDS.map(async ({ label, seed }) => {
            const res = await fetch(`${API_URL}/recommend?title=${encodeURIComponent(seed)}&n=8`)
            if (!res.ok) throw new Error(`Backend not reachable (${res.status})`)
            const data = await res.json()
            const items = data.items?.length
              ? data.items
              : (data.recommendations || []).map((t) => ({ title: t }))
            return { label, seed, matched: data.matched || { title: data.matched_title }, items }
          })
        )
        if (!alive) return
        setRows(fetched)

        // Hero: Dark Knight-style pick = Crime row matched, or first row
        const heroSeed = fetched[2]?.matched?.title || fetched[0]?.matched?.title
        const bundle = await getMovieBundle(heroSeed).catch(() => ({ movie: null, cast: [], videos: [] }))
        if (!alive) return
        setHero({ backendTitle: heroSeed, matched: fetched[2]?.matched || fetched[0]?.matched, bundle })

        if (TMDB_ON) {
          const [tr, pop] = await Promise.all([getTrending('movie', 'week', 10), getPopular(0)]).catch(() => [[], []])
          if (!alive) return
          setTrending(tr)
          void pop
        }
      } catch (e) {
        if (alive) setError(e.message || 'Failed to load catalog. Is the backend running?')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  // ---- autocomplete ----
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      return
    }
    const t = setTimeout(() => {
      fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => setSuggestions(d.results || []))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const openDetail = useCallback(async (title) => {
    setView({ name: 'detail', title })
    setDetail(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const res = await fetch(`${API_URL}/recommend?title=${encodeURIComponent(title)}&n=8`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Movie not found')
      const items = data.items?.length
        ? data.items
        : (data.recommendations || []).map((t) => ({ title: t }))
      const bundle = await getMovieBundle(data.matched_title).catch(() => ({ movie: null, cast: [], videos: [] }))
      setDetail({ matched: data.matched || { title: data.matched_title }, items, bundle })
    } catch (e) {
      setDetail({ error: e.message })
    }
  }, [])

  const go = useCallback(
    (name) => {
      setView({ name })
      setSuggestions([])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    []
  )

  const allMovies = useMemo(() => {
    const map = new Map()
    rows.forEach((r) => {
      if (r.matched?.title) map.set(r.matched.title, r.matched)
      r.items.forEach((m) => map.set(m.title, m))
    })
    return [...map.values()]
  }, [rows])

  const genres = useMemo(() => {
    const set = new Set()
    allMovies.forEach((m) => (m.genres || []).forEach((g) => set.add(g)))
    return [...set].sort()
  }, [allMovies])

  const [genreFilter, setGenreFilter] = useState('')
  const browseList = useMemo(() => {
    const q = browseFilter.trim().toLowerCase()
    return allMovies.filter((m) => {
      const okQ = !q || m.title.toLowerCase().includes(q)
      const okG = !genreFilter || (m.genres || []).includes(genreFilter)
      return okQ && okG
    })
  }, [allMovies, browseFilter, genreFilter])

  const heroBackdrop = hero?.bundle?.movie?.backdrop_path
    ? backdropUrl(hero.bundle.movie.backdrop_path)
    : null

  return (
    <div className="site">
      {/* NAVBAR */}
      <header className="nav">
        <div className="nav-inner">
          <button className="logo" onClick={() => go('home')}>
            <span className="logo-mark">N</span> NEON CINEMA
          </button>
          <nav className="nav-links">
            <button className={view.name === 'home' ? 'active' : ''} onClick={() => go('home')}>Home</button>
            <button className={view.name === 'browse' ? 'active' : ''} onClick={() => go('browse')}>Browse</button>
            <button className={view.name === 'saved' ? 'active' : ''} onClick={() => go('saved')}>
              My List{supSaved(saved)}
            </button>
          </nav>
          <div className="nav-search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && suggestions[0]) {
                  setQuery('')
                  openDetail(suggestions[0])
                }
              }}
              placeholder="Search movies…"
              aria-label="Search movies"
            />
            {suggestions.length > 0 && (
              <ul className="nav-suggest">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => {
                        setQuery('')
                        setSuggestions([])
                        openDetail(s)
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="banner-error">
          ⚠ {error} — start the backend: <code>cd backend &amp;&amp; python -m uvicorn main:app --port 8000</code>
        </div>
      )}

      {/* HOME */}
      {view.name === 'home' && (
        <main>
          {/* BILLBOARD */}
          <section className="billboard" style={heroBackdrop ? { backgroundImage: `url(${heroBackdrop})` } : undefined}>
            <div className="billboard-shade" />
            <div className="billboard-content">
              <p className="kicker">{loading ? 'LOADING…' : TMDB_ON ? '#1 TRENDING THIS WEEK' : 'FEATURED PICK'}</p>
              <h1>{hero ? cleanTitle(hero.backendTitle).toUpperCase() : 'NEON CINEMA'}</h1>
              <p className="meta">
                {[hero?.matched?.year, hero?.matched?.genres_display].filter(Boolean).join('  ·  ')}
                {hero?.bundle?.movie?.vote_average ? `   ★ ${hero.bundle.movie.vote_average.toFixed(1)}` : ''}
              </p>
              <p className="overview">
                {hero?.bundle?.movie?.overview ||
                  'A dark cinematic catalog powered by your local MovieLens engine — TF-IDF on genres + cosine similarity. Pick anything for 8 similar titles.'}
              </p>
              <div className="billboard-actions">
                <button
                  className="btn primary"
                  disabled={!hero}
                  onClick={() => hero && openDetail(hero.backendTitle)}
                >
                  ▶ More Info
                </button>
                <button
                  className="btn ghost"
                  disabled={!hero}
                  onClick={() => hero && toggleSaved(hero.matched)}
                >
                  {hero && isSaved(hero.matched.title) ? '✓ In My List' : '+ My List'}
                </button>
              </div>
            </div>
          </section>

          {loading && <p className="loading">Loading catalog…</p>}

          {/* TMDB trending row */}
          {TMDB_ON && trending.length > 0 && (
            <Row
              label="Trending Now"
              movies={trending.map((t) => ({
                title: t.title || t.name,
                tmdbPath: t.poster_path,
                year: (t.release_date || '').slice(0, 4),
                overview: t.overview,
                tmdb: t,
              }))}
              onOpen={(m) => openDetail(m.title)}
              onSave={toggleSaved}
              isSaved={isSaved}
              ratings={ratings}
              onRate={rate}
            />
          )}

          {/* Backend rows */}
          {rows.map((r) => (
            <Row
              key={r.label}
              label={r.label}
              subtitle={`Because you watched ${cleanTitle(r.matched?.title || r.seed)}`}
              movies={r.items}
              onOpen={(m) => openDetail(m.title)}
              onSave={toggleSaved}
              isSaved={isSaved}
              ratings={ratings}
              onRate={rate}
            />
          ))}

          {!TMDB_ON && (
            <p className="tip">
              Tip: set <code>VITE_TMDB_KEY</code> in <code>frontend/.env</code> for real posters, backdrops, cast &amp; trailers.
              Get one free at themoviedb.org/settings/api.
            </p>
          )}
        </main>
      )}

      {/* BROWSE */}
      {view.name === 'browse' && (
        <main className="wrap">
          <h2 className="page-title">Browse the catalog</h2>
          <div className="browse-bar">
            <input
              value={browseFilter}
              onChange={(e) => setBrowseFilter(e.target.value)}
              placeholder="Filter by title…"
              aria-label="Filter catalog"
            />
            <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} aria-label="Filter by genre">
              <option value="">All genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <span className="count">{browseList.length} titles</span>
          </div>
          <div className="grid">
            {browseList.map((m) => (
              <Card
                key={m.title}
                movie={m}
                onOpen={() => openDetail(m.title)}
                onSave={() => toggleSaved(m)}
                saved={isSaved(m.title)}
                rating={ratings[m.title] || 0}
                onRate={(n) => rate(m.title, n)}
              />
            ))}
          </div>
          {browseList.length === 0 && <p className="tip">No titles match. Try clearing the filters.</p>}
        </main>
      )}

      {/* DETAIL */}
      {view.name === 'detail' && (
        <main>
          {!detail && <p className="loading wrap">Loading details…</p>}
          {detail?.error && <p className="banner-error wrap">⚠ {detail.error}</p>}
          {detail && !detail.error && (
            <DetailView
              matched={detail.matched}
              items={detail.items}
              bundle={detail.bundle}
              saved={isSaved(detail.matched.title)}
              onSave={() => toggleSaved(detail.matched)}
              rating={ratings[detail.matched.title] || 0}
              onRate={(n) => rate(detail.matched.title, n)}
              onOpen={openDetail}
              onSaveItem={toggleSaved}
              isSaved={isSaved}
              ratings={ratings}
              onRateItem={rate}
            />
          )}
        </main>
      )}

      {/* SAVED */}
      {view.name === 'saved' && (
        <main className="wrap">
          <h2 className="page-title">My List</h2>
          {saved.length === 0 && (
            <p className="tip">Nothing saved yet. Hover any poster and hit <b>+</b>, or open a title and choose <b>+ My List</b>. Ratings are kept here too.</p>
          )}
          <div className="grid">
            {saved.map((m) => (
              <Card
                key={m.title}
                movie={m}
                onOpen={() => openDetail(m.title)}
                onSave={() => toggleSaved(m)}
                saved
                rating={ratings[m.title] || 0}
                onRate={(n) => rate(m.title, n)}
              />
            ))}
          </div>
        </main>
      )}

      <footer className="footer">
        <span>NEON CINEMA · FastAPI + TF-IDF × cosine similarity · MovieLens ml-latest-small</span>
        <span>Artwork via TMDB API · {TMDB_ON ? 'connected' : 'key not set — placeholders shown'}</span>
      </footer>
    </div>
  )
}

function supSaved(saved) {
  return saved.length ? <sup>{saved.length}</sup> : null
}

function Row({ label, subtitle, movies, onOpen, onSave, isSaved, ratings, onRate }) {
  return (
    <section className="row">
      <div className="row-head">
        <h2>{label}</h2>
        {subtitle && <span className="row-sub">{subtitle}</span>}
      </div>
      <div className="rail">
        {movies.map((m) => (
          <div className="rail-card" key={m.title + (m.tmdbPath || '')} onClick={() => onOpen(m)}>
            <div className="rail-poster">
              <Poster title={m.title} tmdbPath={m.tmdbPath} />
              <button
                className="rail-save"
                title={isSaved(m.title) ? 'Remove from My List' : 'Add to My List'}
                onClick={(e) => {
                  e.stopPropagation()
                  onSave(m)
                }}
              >
                {isSaved(m.title) ? '✓' : '+'}
              </button>
            </div>
            <button className="rail-title" onClick={() => onOpen(m)}>{m.title}</button>
            <span className="rail-meta">{[m.year, m.genres_display].filter(Boolean).join(' · ') || m.year || ''}</span>
            <Stars value={ratings[m.title] || 0} onRate={(n) => onRate(m.title, n)} />
          </div>
        ))}
      </div>
    </section>
  )
}

function Card({ movie, onOpen, onSave, saved, rating, onRate }) {
  return (
    <div className="grid-card" onClick={onOpen}>
      <div className="grid-poster">
        <Poster title={movie.title} tmdbPath={movie.tmdbPath} />
        <button
          className="rail-save"
          title={saved ? 'Remove from My List' : 'Add to My List'}
          onClick={(e) => {
            e.stopPropagation()
            onSave()
          }}
        >
          {saved ? '✓' : '+'}
        </button>
      </div>
      <span className="rail-title">{movie.title}</span>
      <span className="rail-meta">{[movie.year, movie.genres_display].filter(Boolean).join(' · ')}</span>
      <Stars value={rating} onRate={onRate} />
    </div>
  )
}

function DetailView({ matched, items, bundle, saved, onSave, rating, onRate, onOpen, onSaveItem, isSaved, ratings, onRateItem }) {
  const backdrop = bundle?.movie?.backdrop_path ? backdropUrl(bundle.movie.backdrop_path) : null
  return (
    <div>
      <section className="billboard small" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
        <div className="billboard-shade" />
        <div className="billboard-content">
          <p className="kicker">DETAILS</p>
          <h1>{cleanTitle(matched.title).toUpperCase()}</h1>
          <p className="meta">
            {[matched.year, matched.genres_display].filter(Boolean).join('  ·  ')}
            {bundle?.movie?.vote_average ? `   ★ ${bundle.movie.vote_average.toFixed(1)}` : ''}
          </p>
          <p className="overview">
            {bundle?.movie?.overview || 'No synopsis from TMDB for this title — the match below is purely genre-based from your local backend.'}
          </p>
          <div className="billboard-actions">
            <button className="btn ghost" onClick={onSave}>{saved ? '✓ In My List' : '+ My List'}</button>
            <Stars value={rating} onRate={onRate} size="1.3rem" />
          </div>
        </div>
      </section>

      <div className="wrap detail-cols">
        <div>
          <h3>More like this</h3>
          <div className="grid">
            {items.map((m) => (
              <Card
                key={m.title}
                movie={m}
                onOpen={() => onOpen(m.title)}
                onSave={() => onSaveItem(m)}
                saved={isSaved(m.title)}
                rating={ratings[m.title] || 0}
                onRate={(n) => onRateItem(m.title, n)}
              />
            ))}
          </div>
        </div>
        <aside className="side">
          <h3>Cast</h3>
          {!TMDB_ON && <p className="tip">Add <code>VITE_TMDB_KEY</code> for cast.</p>}
          {TMDB_ON && (bundle?.cast?.length || 0) === 0 && <p className="tip">No cast found.</p>}
          <ul className="cast">
            {(bundle?.cast || []).map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <small>{c.character}</small>
              </li>
            ))}
          </ul>
          <h3>Trailers</h3>
          {!TMDB_ON && <p className="tip">Add <code>VITE_TMDB_KEY</code> for trailers.</p>}
          <ul className="trailers">
            {(bundle?.videos || []).map((v) => (
              <li key={v.id}>
                <a href={`https://www.youtube.com/watch?v=${v.key}`} target="_blank" rel="noreferrer">
                  ▶ {v.name}
                </a>
                <small>{v.type}</small>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
