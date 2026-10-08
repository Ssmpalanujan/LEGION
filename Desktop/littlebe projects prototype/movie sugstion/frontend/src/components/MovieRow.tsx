import { useRef } from 'react'
import type { Movie } from '../api'
import { ContinueCard, MovieCard } from './MovieCard'

interface Props {
  title: string
  movies: Movie[]
  kind?: 'poster' | 'landscape'
  progressOf?: (m: Movie) => number
  whyOf?: (m: Movie) => string | undefined
  loading?: boolean
}

export function MovieRow({ title, movies, kind = 'poster', progressOf, whyOf, loading }: Props) {
  const rail = useRef<HTMLDivElement>(null)
  const scrollBy = (dir: number) =>
    rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <section className="row" aria-label={title} data-testid="movie-row">
      <div className="row-head">
        <h2>{title}</h2>
        <span className="arrows">
          <button onClick={() => scrollBy(-1)} aria-label={`Scroll ${title} left`}>
            ‹
          </button>
          <button onClick={() => scrollBy(1)} aria-label={`Scroll ${title} right`}>
            ›
          </button>
        </span>
      </div>
      <div
        className="rail"
        ref={rail}
        tabIndex={0}
        role="region"
        aria-label={`${title} carousel`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') scrollBy(1)
          if (e.key === 'ArrowLeft') scrollBy(-1)
        }}
      >
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="pcard" aria-hidden="true">
                <div className="pcard-poster skel" style={{ aspectRatio: '2/3' }} />
              </div>
            ))
          : movies.map((m) =>
              kind === 'landscape' ? (
                <ContinueCard key={m.id} movie={m} progress={progressOf ? progressOf(m) : 0.4} />
              ) : (
                <MovieCard key={m.id} movie={m} why={whyOf?.(m)} />
              )
            )}
      </div>
    </section>
  )
}
