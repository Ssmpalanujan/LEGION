import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, type Movie } from '../api'
import { HybridSlider } from '../components/HybridSlider'
import { MovieCard } from '../components/MovieCard'
import { TrailerModal } from '../components/TrailerModal'
import { cleanTitle, img, tmdbSearch } from '../tmdb'
import { useAuth } from '../auth'

type Tab = 'similar' | 'details' | 'cast' | 'trailers'

interface Bundle {
  overview: string
  backdrop: string | null
  rating: number
  cast: { name: string; character: string }[]
}

export function Detail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [search] = useSearchParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [movie, setMovie] = useState<Movie | null>(null)
  const [items, setItems] = useState<Movie[]>([])
  const [tab, setTab] = useState<Tab>('similar')
  const [alpha, setAlpha] = useState(0.5)
  const [bundle, setBundle] = useState<Bundle>({ overview: '', backdrop: null, rating: 0, cast: [] })
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [showTrailer, setShowTrailer] = useState(search.get('play') === '1')
  const [error, setError] = useState('')

  const mid = Number(id)

  const loadSimilar = useCallback(
    async (a: number) => {
      if (!movie) return
      try {
        const d = await api.hybrid(movie.id, a, 8)
        setItems(d.items)
      } catch {
        /* keep previous */
      }
    },
    [movie]
  )

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const m = await api.movie(mid)
        if (!alive) return
        setMovie(m)
        const [hyb, tm] = await Promise.all([
          api.hybrid(mid, 0.5, 8).catch(() => null),
          tmdbSearch(m.title).catch(() => null),
        ])
        if (!alive) return
        if (hyb) setItems(hyb.items)
        if (tm) {
          setBundle({
            overview: tm.overview || m.overview || '',
            backdrop: tm.backdrop_path ? img(tm.backdrop_path, 'w1280') : null,
            rating: tm.vote_average ?? m.vote_average ?? 0,
            cast: [],
          })
          if (import.meta.env.VITE_TMDB_KEY) {
            try {
              const cr = await fetch(
                `https://api.themoviedb.org/3/movie/${tm.id}/credits?api_key=${import.meta.env.VITE_TMDB_KEY}`
              ).then((r) => (r.ok ? r.json() : null))
              if (cr && alive) {
                setBundle((b) => ({
                  ...b,
                  cast: (cr.cast || []).slice(0, 8).map((c: { name: string; character: string }) => ({ name: c.name, character: c.character })),
                }))
              }
            } catch {
              /* cast optional */
            }
          }
        }
        const tr = await api.trailer(mid).catch(() => null)
        if (alive && tr) setTrailerKey(tr.youtube_key)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      alive = false
    }
  }, [mid])

  useEffect(() => {
    void loadSimilar(alpha)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alpha])

  if (error) return <main className="wrap"><p className="banner-error">{error}</p></main>
  if (!movie) return <main className="wrap"><p className="tip">{t('common.loading')}</p></main>

  const tabs: { id: Tab; label: string; count: number | '' }[] = [
    { id: 'similar', label: t('detail.similar'), count: items.length },
    { id: 'details', label: t('detail.details'), count: '' },
    { id: 'cast', label: t('detail.cast'), count: bundle.cast.length || '' },
    { id: 'trailers', label: t('detail.trailers'), count: trailerKey ? 1 : '' },
  ]

  return (
    <main id="main">
      <section className="backdrop-hero" style={bundle.backdrop ? { backgroundImage: `url(${bundle.backdrop})` } : undefined}>
        <div className="backdrop-shade" />
      </section>
      <div className="detail-body">
        <p className="hero-kicker">Movie details</p>
        <h1 className="hero-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>{cleanTitle(movie.title).toUpperCase()}</h1>
        <div className="hero-meta">
          <span>★ {bundle.rating.toFixed(1)}</span>
          <span>{movie.year}</span>
          {(movie.genres || []).map((g) => (
            <span key={g} className="genre-chip">{g}</span>
          ))}
        </div>
        <p className="hero-desc" style={{ WebkitLineClamp: 4 }}>{bundle.overview}</p>
        <div className="hero-actions">
          <button className="btn btn-blue" onClick={() => setShowTrailer(true)}>{t('hero.play')}</button>
          <button
            className="btn btn-outline"
            onClick={() => {
              if (!user) {
                nav('/profile')
                return
              }
              void api.watchAdd(movie.id).catch(() => {})
            }}
          >
            {t('detail.addlist')}
          </button>
          {user && (
            <>
              <button className="btn btn-outline" onClick={() => void api.swipe(movie.id, true)}>{t('detail.like')}</button>
              <button className="btn btn-outline" onClick={() => void api.swipe(movie.id, false)}>{t('detail.skip')}</button>
            </>
          )}
        </div>

        <nav className="tabs" aria-label="Movie sections">
          {tabs.map((tb) => (
            <button key={tb.id} className={tab === tb.id ? 'active' : ''} onClick={() => setTab(tb.id)}>
              {tb.label}{tb.count !== '' && <sup>{tb.count}</sup>}
            </button>
          ))}
        </nav>

        {tab === 'similar' && (
          <>
            <HybridSlider value={alpha} onChange={setAlpha} />
            <div className="grid">
              {items.map((m) => (
                <MovieCard key={m.id} movie={m} why={(m.reasons || [])[0]} />
              ))}
            </div>
          </>
        )}
        {tab === 'details' && (
          <div>
            <p><strong>Genres:</strong> {movie.genres_display || (movie.genres || []).join(', ')}</p>
            <p><strong>Year:</strong> {movie.year}</p>
            <p><strong>Language:</strong> {movie.original_language}</p>
            <p>{bundle.overview || movie.overview}</p>
          </div>
        )}
        {tab === 'cast' && (
          <ul className="cast-list">
            {bundle.cast.length === 0 && <li style={{ color: 'var(--muted)' }}>Cast unavailable (needs TMDB key).</li>}
            {bundle.cast.map((c) => (
              <li key={c.name}><strong>{c.name}</strong><small>{c.character}</small></li>
            ))}
          </ul>
        )}
        {tab === 'trailers' && (
          <div>
            {trailerKey ? (
              <button className="btn btn-blue" onClick={() => setShowTrailer(true)}>▶ Play trailer</button>
            ) : (
              <p style={{ color: 'var(--muted)' }}>No trailer stored for this title yet.</p>
            )}
          </div>
        )}
      </div>
      {showTrailer && <TrailerModal title={movie.title} youtubeKey={trailerKey} onClose={() => setShowTrailer(false)} />}
    </main>
  )
}
