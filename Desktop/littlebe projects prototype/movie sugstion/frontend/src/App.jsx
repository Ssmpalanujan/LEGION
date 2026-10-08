import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  backdropUrl,
  cleanTitle,
  getMovieBundle,
  getTrending,
  hasTmdbKey,
  posterUrl,
  searchMovie,
} from './tmdb.js'
import { API_URL, api, wsUrl } from './api.js'

const TMDB_ON = hasTmdbKey()
const MOODS = ['happy', 'sad', 'bored', 'romantic', 'thrilling', 'family']
const NL_EXAMPLES = [
  'a sad but inspiring Tamil movie',
  'feel-good comedy for a rainy day',
  'thrilling crime saga',
]

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

function TrailerModal({ title, youtubeKey, onClose }) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${title} trailer`}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{title} — Trailer</strong>
          <button onClick={onClose} aria-label="Close trailer">✕</button>
        </div>
        {youtubeKey ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0`}
            title={`${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <p className="tip">No trailer available for this title yet.</p>
        )}
      </div>
    </div>
  )
}

function HybridSlider({ value, onChange }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  useEffect(() => {
    if (local === value) return
    const t = setTimeout(() => onChange(local), 400)
    return () => clearTimeout(t)
  }, [local, value, onChange])
  return (
    <div className="slider-row" data-testid="hybrid-slider">
      <span>Content</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        aria-label="Hybrid mix: content versus collaborative"
      />
      <span>Collaborative</span>
      <strong>{Math.round(local * 100)}% content</strong>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState({ name: 'home' }) // home|browse|search|detail|mood|swipe|night|saved|profile|admin
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [rows, setRows] = useState([]) // [{label, seed, matched, items}]
  const [trending, setTrending] = useState([])
  const [forYou, setForYou] = useState([])
  const [hero, setHero] = useState(null) // { backendTitle, matched, bundle }
  const [detail, setDetail] = useState(null) // { matched, items, bundle }
  const [alpha, setAlpha] = useState(1)
  const [trailer, setTrailer] = useState(null) // { title, key }
  const [browseFilter, setBrowseFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(() => loadJSON('cine-saved', []))
  const [serverList, setServerList] = useState([])
  const [ratings, setRatings] = useState(() => loadJSON('cine-ratings', {}))
  const [user, setUser] = useState(null)
  const [taste, setTaste] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('cine-theme') || 'dark')
  const alphaTimer = useRef(null)
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    localStorage.setItem('cine-saved', JSON.stringify(saved))
  }, [saved])
  useEffect(() => {
    localStorage.setItem('cine-ratings', JSON.stringify(ratings))
  }, [ratings])
  useEffect(() => {
    localStorage.setItem('cine-theme', theme)
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'
  }, [theme])

  // ---- auth bootstrap ----
  const refreshMe = useCallback(async () => {
    if (!localStorage.getItem('cm_access')) {
      setUser(null)
      return
    }
    try {
      setUser(await api.me())
    } catch {
      localStorage.removeItem('cm_access')
      setUser(null)
    }
  }, [])
  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  const isSaved = useCallback(
    (title) => saved.some((s) => s.title === title) || serverList.some((s) => s.title === title),
    [saved, serverList]
  )
  const reloadServerList = useCallback(async () => {
    if (!localStorage.getItem('cm_access')) {
      setServerList([])
      return
    }
    try {
      setServerList((await api.watchlist()).items)
    } catch {
      /* offline or logged out */
    }
  }, [])
  useEffect(() => {
    void reloadServerList()
  }, [reloadServerList, user])

  const toggleSaved = useCallback(
    async (movie) => {
      if (user && movie.id) {
        const has = serverList.some((s) => s.title === movie.title)
        try {
          if (has) await api.watchDel(movie.id)
          else await api.watchAdd(movie.id)
          await reloadServerList()
        } catch {
          /* fall back to local */
          setSaved((prev) =>
            prev.some((s) => s.title === movie.title)
              ? prev.filter((s) => s.title !== movie.title)
              : [...prev, movie]
          )
        }
        return
      }
      setSaved((prev) =>
        prev.some((s) => s.title === movie.title)
          ? prev.filter((s) => s.title !== movie.title)
          : [...prev, movie]
      )
    },
    [user, serverList, reloadServerList]
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

        const heroSeed = fetched[2]?.matched?.title || fetched[0]?.matched?.title
        const bundle = await getMovieBundle(heroSeed).catch(() => ({ movie: null, cast: [], videos: [] }))
        if (!alive) return
        setHero({ backendTitle: heroSeed, matched: fetched[2]?.matched || fetched[0]?.matched, bundle })

        if (TMDB_ON) {
          const tr = await getTrending('movie', 'week', 10).catch(() => [])
          if (!alive) return
          setTrending(tr)
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

  // ---- for-you feed (logged in) ----
  useEffect(() => {
    if (!user) {
      setForYou([])
      return
    }
    api.forYou(10).then((d) => setForYou(d.items)).catch(() => {})
  }, [user])

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

  const loadDetail = useCallback(async (title, a, silent = false) => {
    if (!silent) setDetail(null)
    try {
      const data = await api.hybrid(title, a, 8)
      const items = data.items?.length
        ? data.items
        : (data.recommendations || []).map((t) => ({ title: t }))
      const bundle = await getMovieBundle(data.matched_title).catch(() => ({ movie: null, cast: [], videos: [] }))
      setDetail({ matched: data.matched || { title: data.matched_title }, items, bundle })
    } catch (e) {
      setDetail({ error: e.message })
    }
  }, [])

  const openDetail = useCallback(
    (title) => {
      setView({ name: 'detail', title })
      setAlpha(1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      void loadDetail(title, 1)
    },
    [loadDetail]
  )

  const changeAlpha = useCallback(
    (a) => {
      setAlpha(a)
      if (alphaTimer.current) clearTimeout(alphaTimer.current)
      const title = viewRef.current.title
      if (!title) return
      alphaTimer.current = setTimeout(() => void loadDetail(title, a, true), 400)
    },
    [loadDetail]
  )

  const openTrailer = useCallback(async (movie) => {
    if (!movie.id) {
      setTrailer({ title: movie.title, key: null })
      return
    }
    try {
      const t = await api.trailer(movie.id)
      setTrailer({ title: movie.title, key: t.youtube_key })
    } catch {
      setTrailer({ title: movie.title, key: null })
    }
  }, [])

  const go = useCallback((name) => {
    setView({ name })
    setSuggestions([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openMood = useCallback(async (mood) => {
    setView({ name: 'mood', mood })
    setDetail(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const data = await api.mood(mood, 12)
      setDetail({ moodItems: data.items })
    } catch (e) {
      setDetail({ error: e.message })
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('cm_access')
    localStorage.removeItem('cm_refresh')
    setUser(null)
    setServerList([])
    setTaste(null)
    setView({ name: 'home' })
  }, [])

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
            <button className={view.name === 'search' ? 'active' : ''} onClick={() => go('search')}>Search</button>
            <button className={view.name === 'swipe' ? 'active' : ''} onClick={() => go('swipe')}>Swipe</button>
            <button className={view.name === 'night' ? 'active' : ''} onClick={() => go('night')}>Movie Night</button>
            <button className={view.name === 'saved' ? 'active' : ''} onClick={() => go('saved')}>
              My List{supSaved(user ? serverList : saved)}
            </button>
            <button className={view.name === 'profile' ? 'active' : ''} onClick={() => go('profile')}>
              {user ? user.email.split('@')[0] : 'Sign in'}
            </button>
            {user?.is_admin && (
              <button className={view.name === 'admin' ? 'active' : ''} onClick={() => go('admin')}>Admin</button>
            )}
          </nav>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? '☀️' : '🌙'}
          </button>
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
          ⚠ {error} — start the backend: <code>cd backend &amp;&amp; python -m uvicorn app.main:app --port 8000</code>
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
                {hero?.matched?.id && (
                  <button className="btn ghost" onClick={() => openTrailer(hero.matched)}>
                    ▶ Play Trailer
                  </button>
                )}
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

          {/* MOODS */}
          <section className="row" aria-label="Moods">
            <div className="row-head"><h2>Watch by mood</h2></div>
            <div className="chips">
              {MOODS.map((m) => (
                <button key={m} onClick={() => openMood(m)}>
                  {m[0].toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </section>

          {/* FOR YOU */}
          {forYou.length > 0 && (
            <Row
              label="Recommended For You"
              subtitle="Personalized from your swipes"
              movies={forYou}
              onOpen={(m) => openDetail(m.title)}
              onSave={toggleSaved}
              isSaved={isSaved}
              ratings={ratings}
              onRate={rate}
            />
          )}

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

      {/* SEARCH (titles + natural language) */}
      {view.name === 'search' && (
        <SearchView onOpen={openDetail} />
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
              alpha={alpha}
              onAlpha={changeAlpha}
              saved={isSaved(detail.matched.title)}
              onSave={() => toggleSaved(detail.matched)}
              onTrailer={() => openTrailer(detail.matched)}
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

      {/* MOOD RESULTS */}
      {view.name === 'mood' && (
        <main className="wrap">
          <h2 className="page-title">Mood: {view.mood}</h2>
          <div className="chips">
            {MOODS.map((m) => (
              <button key={m} className={m === view.mood ? 'on' : ''} onClick={() => openMood(m)}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {!detail && <p className="loading">Loading…</p>}
          {detail?.error && <p className="banner-error">⚠ {detail.error}</p>}
          {detail?.moodItems && (
            <div className="grid">
              {detail.moodItems.map((m) => (
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
          )}
        </main>
      )}

      {/* SWIPE */}
      {view.name === 'swipe' && (
        <SwipeView user={user} onLogin={() => go('profile')} />
      )}

      {/* MOVIE NIGHT */}
      {view.name === 'night' && (
        <NightView user={user} onLogin={() => go('profile')} />
      )}

      {/* SAVED */}
      {view.name === 'saved' && (
        <main className="wrap">
          <h2 className="page-title">My List{user ? ' (synced)' : ''}</h2>
          {(user ? serverList : saved).length === 0 && (
            <p className="tip">
              Nothing saved yet. {user ? 'Open a title and choose + My List.' : 'Sign in to sync across devices — or save locally below.'}
              {!user && ' Hover any poster and hit +, or open a title and choose + My List.'}
            </p>
          )}
          <div className="grid">
            {(user ? serverList : saved).map((m) => (
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

      {/* PROFILE / AUTH */}
      {view.name === 'profile' && (
        <ProfileView user={user} taste={taste} setTaste={setTaste} refreshMe={refreshMe} logout={logout} />
      )}

      {/* ADMIN */}
      {view.name === 'admin' && user?.is_admin && (
        <AdminView />
      )}

      {trailer && (
        <TrailerModal title={trailer.title} youtubeKey={trailer.key} onClose={() => setTrailer(null)} />
      )}

      <footer className="footer">
        <span>CineMatch · content + collaborative recommender · MovieLens ml-latest-small</span>
        <span>Artwork via TMDB API · {TMDB_ON ? 'connected' : 'key not set — placeholders shown'}</span>
      </footer>
    </div>
  )
}

function supSaved(saved) {
  return saved.length ? <sup>{saved.length}</sup> : null
}

function Why({ reasons }) {
  if (!reasons?.length) return null
  return <span className="why" title={reasons.join(' · ')}>? {reasons[0]}</span>
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
            <Why reasons={m.reasons} />
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
      <Why reasons={movie.reasons} />
      <Stars value={rating} onRate={onRate} />
    </div>
  )
}

function DetailView({ matched, items, bundle, alpha, onAlpha, saved, onSave, onTrailer, rating, onRate, onOpen, onSaveItem, isSaved, ratings, onRateItem }) {
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
            <button className="btn primary" onClick={onTrailer}>▶ Play Trailer</button>
            <button className="btn ghost" onClick={onSave}>{saved ? '✓ In My List' : '+ My List'}</button>
            <Stars value={rating} onRate={onRate} size="1.3rem" />
          </div>
        </div>
      </section>

      <div className="wrap">
        <HybridSlider value={alpha} onChange={onAlpha} />
      </div>

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

function SearchView({ onOpen }) {
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('titles') // titles | natural
  const [results, setResults] = useState([])
  const [detected, setDetected] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async (query) => {
    const queryTrim = (query ?? q).trim()
    if (!queryTrim) return
    setLoading(true)
    try {
      if (mode === 'natural') {
        const d = await api.semantic(queryTrim, 18)
        setDetected(d.detected_language)
        setResults(d.results)
      } else {
        const d = await api.search(queryTrim, 18)
        setDetected(null)
        setResults(d.results)
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="wrap">
      <h2 className="page-title">Search</h2>
      <div className="browse-bar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run()
          }}
          placeholder={mode === 'natural' ? 'Try “a sad but inspiring Tamil movie”…' : 'Search by title…'}
          aria-label="Search movies"
          style={{ flex: 1, minWidth: 220 }}
        />
        <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Search mode">
          <option value="titles">Titles</option>
          <option value="natural">Natural language</option>
        </select>
        <button className="btn primary" style={{ padding: '0.6rem 1.2rem' }} onClick={() => void run()}>
          Search
        </button>
      </div>
      {mode === 'natural' && (
        <div className="chips">
          {NL_EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => { setQ(ex); void run(ex) }}>{ex}</button>
          ))}
        </div>
      )}
      {detected && <p className="tip" style={{ margin: '0 0 1rem' }}>Detected language: {detected}</p>}
      {loading && <p className="loading">Searching…</p>}
      <div className="grid">
        {results.map((m) => (
          <div className="grid-card" key={m.id || m.title} onClick={() => onOpen(m.title)}>
            <div className="grid-poster"><Poster title={m.title} /></div>
            <span className="rail-title">{m.title}</span>
            <span className="rail-meta">{[m.year, m.genres_display].filter(Boolean).join(' · ')}</span>
          </div>
        ))}
      </div>
      {!loading && results.length === 0 && <p className="tip">No results yet — try a search above.</p>}
    </main>
  )
}

function SwipeView({ user, onLogin }) {
  const [card, setCard] = useState(null)
  const [reason, setReason] = useState('')

  const next = useCallback(async () => {
    try {
      const d = await api.nextCard()
      setCard(d.card)
      setReason(d.reason || '')
    } catch {
      setCard(null)
    }
  }, [])

  useEffect(() => {
    if (user) void next()
  }, [user, next])

  if (!user) {
    return (
      <main className="wrap">
        <h2 className="page-title">Swipe</h2>
        <p className="tip">Sign in to start swiping — your likes train your personal taste feed.</p>
        <button className="btn primary" onClick={onLogin}>Sign in</button>
      </main>
    )
  }

  const act = async (liked) => {
    if (!card) return
    await api.swipe(card.id, liked).catch(() => {})
    await next()
  }

  return (
    <main className="wrap">
      <h2 className="page-title">Swipe</h2>
      <div className="swipe-stage">
        {card ? (
          <div className="swipe-card" key={card.id}>
            <Poster title={card.title} size="w500" className="swipe-img" />
            <div className="swipe-info">
              <strong>{card.title}</strong>
              <div className="rail-meta">{[card.year, card.genres_display].filter(Boolean).join(' · ')}</div>
              {reason && <div className="rail-meta">{reason}</div>}
            </div>
          </div>
        ) : (
          <p className="tip">No more cards — you swiped them all.</p>
        )}
        <div className="swipe-btns">
          <button onClick={() => void act(false)} aria-label="Skip" disabled={!card}>✕</button>
          <button className="like" onClick={() => void act(true)} aria-label="Like" disabled={!card}>♥</button>
        </div>
      </div>
    </main>
  )
}

function NightView({ user, onLogin }) {
  const [room, setRoom] = useState(null)
  const [code, setCode] = useState('')
  const [pos, setPos] = useState(0)
  const [result, setResult] = useState(null)
  const [finished, setFinished] = useState({})
  const wsRef = useRef(null)

  useEffect(() => () => wsRef.current?.close(), [])

  if (!user) {
    return (
      <main className="wrap">
        <h2 className="page-title">Movie Night</h2>
        <p className="tip">Sign in to create or join a room.</p>
        <button className="btn primary" onClick={onLogin}>Sign in</button>
      </main>
    )
  }

  const connect = (roomCode) => {
    wsRef.current?.close()
    const token = localStorage.getItem('cm_access')
    const sock = new WebSocket(wsUrl(`/ws/rooms/${roomCode}`, token))
    wsRef.current = sock
    sock.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'result') setResult(msg)
      if (msg.type === 'swipe' && msg.finished) setFinished(msg.finished)
      if (msg.type === 'swipe' || msg.type === 'joined' || msg.type === 'presence') {
        api.roomState(roomCode).then((r) => {
          setFinished(r.finished || {})
          if (r.status === 'finished' && r.result_movie_id && !result) {
            const m = (r.deck || []).find((x) => x.id === r.result_movie_id)
            if (m) setResult({ movie: m, likes: '?', of: (r.participants || []).length, explanation: 'Group pick — everyone finished swiping.' })
          }
        }).catch(() => {})
      }
    }
  }

  const create = async () => {
    const r = await api.createRoom()
    setRoom(r)
    setFinished(r.finished || {})
    setResult(null)
    setPos(0)
    connect(r.code)
  }
  const join = async () => {
    const r = await api.joinRoom(code.trim().toUpperCase())
    setRoom(r)
    setFinished(r.finished || {})
    setResult(null)
    setPos(0)
    connect(r.code)
  }
  const swipe = (liked) => {
    const card = room?.deck[pos]
    if (!card || !wsRef.current) return
    wsRef.current.send(JSON.stringify({ type: 'swipe', movie_id: card.id, liked }))
    setPos((p) => p + 1)
  }
  const leave = () => {
    wsRef.current?.close()
    setRoom(null)
    setResult(null)
  }

  const card = room?.deck[pos]

  return (
    <main className="wrap">
      <h2 className="page-title">Movie Night</h2>
      {!room ? (
        <div className="panel-grid">
          <div className="panel">
            <h3>Create a room</h3>
            <p className="rail-meta">2–4 participants swipe the same 20 movies.</p>
            <button className="btn primary" onClick={() => void create()}>Create room</button>
          </div>
          <div className="panel">
            <h3>Join with code</h3>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6-character code" maxLength={6} aria-label="Room code" />
            <button className="btn primary" onClick={() => void join()} disabled={code.trim().length !== 6}>Join</button>
          </div>
        </div>
      ) : result ? (
        <div className="panel center">
          <p className="kicker">GROUP PICK</p>
          <h2>{result.movie?.title || 'No pick'}</h2>
          <p>Liked by {result.likes}/{result.of} · {result.explanation}</p>
          <button className="btn ghost" onClick={leave}>Leave room</button>
        </div>
      ) : (
        <div className="panel-grid">
          <div className="panel">
            <h3>Room {room.code}</h3>
            <div className="avatars">
              {(room.participants || []).map((u) => (
                <span key={u} className={`avatar-dot${finished[String(u)] ? ' done' : ''}`} title={finished[String(u)] ? `User ${u} finished` : `User ${u} swiping`}>
                  {String(u).slice(-2)}
                </span>
              ))}
            </div>
            {card ? (
              <div>
                <h2>{card.title}</h2>
                <p className="rail-meta">{pos + 1} / {room.deck.length} · {card.genres_display}</p>
                <div className="swipe-btns">
                  <button onClick={() => swipe(false)} aria-label="Skip">✕</button>
                  <button className="like" onClick={() => swipe(true)} aria-label="Like">♥</button>
                </div>
              </div>
            ) : (
              <p className="rail-meta">You finished — waiting for the others…</p>
            )}
          </div>
          <div className="panel">
            <h3>How it works</h3>
            <p className="rail-meta">Everyone swipes the shared deck. When all finish, the group pick maximizes likes, breaking ties by taste similarity.</p>
            <button className="btn ghost" onClick={leave}>Leave</button>
          </div>
        </div>
      )}
    </main>
  )
}

function ProfileView({ user, taste, setTaste, refreshMe, logout }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [mode, setMode] = useState('login')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!user) return
    api.taste().then(setTaste).catch(() => {})
  }, [user, setTaste])

  const submit = async () => {
    setErr('')
    try {
      const t = mode === 'login' ? await api.login(email, pw) : await api.register(email, pw)
      localStorage.setItem('cm_access', t.access_token)
      localStorage.setItem('cm_refresh', t.refresh_token)
      await refreshMe()
    } catch (e) {
      setErr(e.message)
    }
  }

  if (!user) {
    return (
      <main className="wrap narrow">
        <h2 className="page-title">{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
        <div className="panel form">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" aria-label="Email" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password (6+ chars)" type="password" aria-label="Password" />
          {err && <p className="form-error">{err}</p>}
          <button className="btn primary" onClick={() => void submit()}>
            {mode === 'login' ? 'Sign in' : 'Register'}
          </button>
          <button className="btn ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="wrap">
      <h2 className="page-title">Profile</h2>
      <p className="rail-meta">{user.email} {user.is_admin && '· admin'}</p>
      <button className="btn ghost" onClick={logout}>Logout</button>
      <h3>Taste profile</h3>
      {!taste ? (
        <p className="loading">Loading…</p>
      ) : taste.liked_count === 0 ? (
        <p className="tip" style={{ margin: '0 0 1rem' }}>Swipe or like some movies to build your taste profile.</p>
      ) : (
        <div className="panel-grid">
          <div className="panel">
            <h3>Genres (%)</h3>
            {Object.entries(taste.genre_percent || {}).map(([g, v]) => (
              <div className="bar-row" key={g}>
                <span>{g}</span>
                <div className="bar"><i style={{ width: `${Math.min(100, v)}%` }} /></div>
                <b>{v}%</b>
              </div>
            ))}
          </div>
          <div className="panel">
            <h3>Languages</h3>
            <ul className="cast">
              {(taste.top_languages || []).map(([l, c]) => (
                <li key={l}><strong>{l}</strong><small>{c} liked</small></li>
              ))}
            </ul>
            <h3>Decades</h3>
            <ul className="cast">
              {Object.entries(taste.decades || {}).map(([d, c]) => (
                <li key={d}><strong>{d}</strong><small>{c} liked</small></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  )
}

function AdminView() {
  const [metrics, setMetrics] = useState([])
  const [ab, setAb] = useState(null)
  useEffect(() => {
    api.adminMetrics().then((d) => setMetrics(d.metrics)).catch(() => {})
    api.adminAB().then(setAb).catch(() => {})
  }, [])
  const maxV = Math.max(0.01, ...metrics.flatMap((m) => [m.precision_at_k, m.recall_at_k, m.ndcg_at_k, m.coverage]))
  return (
    <main className="wrap">
      <h2 className="page-title">Admin — evaluation & A/B</h2>
      <h3>Offline metrics</h3>
      {metrics.length === 0 ? (
        <p className="tip" style={{ margin: '0 0 1rem' }}>No results yet — run backend/scripts/run_evaluation.py.</p>
      ) : (
        <table className="tbl">
          <thead><tr><th>Algo</th><th>P@K</th><th>R@K</th><th>NDCG</th><th>Coverage</th></tr></thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.algo}>
                <td>{m.algo}</td><td>{m.precision_at_k}</td><td>{m.recall_at_k}</td>
                <td>{m.ndcg_at_k}</td><td>{m.coverage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="panel" style={{ marginTop: '1rem' }}>
        {['precision_at_k', 'recall_at_k', 'ndcg_at_k', 'coverage'].map((k) => (
          <div key={k}>
            <div className="rail-meta">{k}</div>
            {metrics.map((m) => (
              <div className="bar-row" key={m.algo}>
                <span>{m.algo}</span>
                <div className="bar"><i style={{ width: `${(m[k] / maxV) * 100}%` }} /></div>
                <b>{m[k]}</b>
              </div>
            ))}
          </div>
        ))}
      </div>
      <h3>A/B test</h3>
      {!ab ? (
        <p className="loading">Loading…</p>
      ) : (
        <div className="panel">
          {['A', 'B'].map((v) => (
            ab[v] && (
              <div key={v}>
                <div className="rail-meta">
                  Variant {v}: {ab[v].impressions} impressions · CTR {ab[v].ctr} · like-rate {ab[v].like_rate}
                </div>
                <div className="bar"><i style={{ width: `${(ab[v].ctr || 0) * 100}%` }} /></div>
              </div>
            )
          ))}
          <p className="rail-meta">p(CTR)={String(ab.p_value_ctr)} · p(like)={String(ab.p_value_like_rate)}</p>
        </div>
      )}
    </main>
  )
}
