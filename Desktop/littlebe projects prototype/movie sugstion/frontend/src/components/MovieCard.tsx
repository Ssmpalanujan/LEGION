import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Movie } from '../api'
import { cleanTitle, img, tmdbSearch } from '../tmdb'

export function PosterImg({ title, tmdbPath, alt }: { title: string; tmdbPath?: string; alt?: string }) {
  const [path, setPath] = useState<string | null>(tmdbPath || null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (tmdbPath) return
    let alive = true
    void tmdbSearch(title).then((m) => {
      if (alive && m?.poster_path) setPath(m.poster_path)
    })
    return () => {
      alive = false
    }
  }, [title, tmdbPath])
  const src = path ? img(path, 'w342') : null
  if (!src) return <div className="pcard-fallback">{cleanTitle(title)}</div>
  return (
    <>
      {!loaded && <div className="pcard-fallback skel" aria-hidden="true" />}
      <img src={src} alt={alt || `${cleanTitle(title)} poster`} loading="lazy" onLoad={() => setLoaded(true)} style={loaded ? undefined : { display: 'none' }} />
    </>
  )
}

export function MovieCard({ movie, why }: { movie: Movie; why?: string }) {
  const nav = useNavigate()
  const open = () => nav(`/movie/${movie.id}`)
  return (
    <div className="pcard" onClick={open} data-testid="movie-card">
      <div className="pcard-poster">
        <PosterImg title={movie.title} />
        {why && (
          <span className="why-chip" title={why}>
            ? {why.slice(0, 60)}
          </span>
        )}
      </div>
      <button className="pcard-title" onClick={open} aria-label={`Open ${movie.title}`}>
        {movie.title}
      </button>
      <span className="pcard-meta">
        {[movie.year, (movie.genres || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
      </span>
    </div>
  )
}

export function ContinueCard({ movie, progress }: { movie: Movie; progress: number }) {
  const nav = useNavigate()
  return (
    <div className="lcard" onClick={() => nav(`/movie/${movie.id}`)}>
      <div className="lcard-art">
        <PosterImg title={movie.title} />
        <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${movie.title} progress`}>
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <span className="pcard-meta">{movie.title}</span>
    </div>
  )
}
