import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api, type Movie } from '../api'
import { cleanTitle, img, tmdbSearch } from '../tmdb'
import { StarRow } from './Stars'

interface Slide {
  movie: Movie
  backdrop: string | null
  overview: string
  rating: number
}

export function Hero({ seeds }: { seeds: string[] }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [slides, setSlides] = useState<Slide[]>([])
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const out: Slide[] = []
      for (const seed of seeds.slice(0, 5)) {
        try {
          const rec = await api.recommend(seed, 1)
          const m = rec.matched
          const tm = await tmdbSearch(m.title)
          out.push({
            movie: m,
            backdrop: tm?.backdrop_path ? img(tm.backdrop_path, 'w1280') : null,
            overview: tm?.overview || '',
            rating: tm?.vote_average ?? m.vote_average ?? 0,
          })
        } catch {
          /* skip failed seeds */
        }
      }
      if (alive) setSlides(out)
    })()
    return () => {
      alive = false
    }
  }, [seeds])

  const go = useCallback((n: number) => {
    setIdx((i) => (i + n + slides.length) % Math.max(1, slides.length))
  }, [slides.length])

  useEffect(() => {
    if (paused || slides.length < 2) return
    timer.current = window.setTimeout(() => go(1), 6000)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [idx, paused, slides.length, go])

  const [inList, setInList] = useState(false)
  const cur = slides[idx]

  useEffect(() => {
    setInList(false)
    if (!cur) return
    void api
      .watchlist()
      .then((w) => setInList(w.items.some((m) => m.id === cur.movie.id)))
      .catch(() => {})
  }, [cur])

  if (!cur) return <div className="hero-wrap"><div className="hero-slide skel" /></div>

  return (
    <div className="hero-wrap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="hero-track">
        <div
          className="hero-slide"
          style={cur.backdrop ? { backgroundImage: `url(${cur.backdrop})` } : undefined}
          onClick={() => nav(`/movie/${cur.movie.id}`)}
          role="link"
          tabIndex={0}
          aria-label={`Open ${cur.movie.title}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') nav(`/movie/${cur.movie.id}`)
          }}
        >
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="hero-kicker">Premium streaming selection</p>
            <h1>{cleanTitle(cur.movie.title)}</h1>
            <div className="hero-meta">
              <StarRow value={(cur.rating / 10) * 5} />
              <span>{cur.rating.toFixed(1)}</span>
              <span>{cur.movie.year}</span>
              {(cur.movie.genres || []).slice(0, 3).map((g) => (
                <span key={g} className="genre-chip">{g}</span>
              ))}
            </div>
            <p className="hero-desc">{cur.overview || 'A hand-picked title from your catalog.'}</p>
            <div className="hero-actions" onClick={(e) => e.stopPropagation()}>
              <button className="btn btn-blue" onClick={() => nav(`/movie/${cur.movie.id}?play=1`)}>
                {t('hero.play')}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  void api.watchAdd(cur.movie.id).then(() => setInList(true)).catch(() => {})
                }}
              >
                {inList ? t('hero.inlist') : t('hero.mylist')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {slides.length > 1 && (
        <>
          <button className="hero-arrow left" onClick={() => go(-1)} aria-label="Previous banner">‹</button>
          <button className="hero-arrow right" onClick={() => go(1)} aria-label="Next banner">›</button>
          <div className="hero-dots" role="tablist" aria-label="Banner pages">
            {slides.map((s, i) => (
              <button key={s.movie.id} role="tab" aria-selected={i === idx} aria-label={`Banner ${i + 1}`} className={i === idx ? 'active' : ''} onClick={() => setIdx(i)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
