import { Suspense, lazy, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api, type Movie } from '../api'
import { Hero } from '../components/Hero'
import { MovieRow } from '../components/MovieRow'

const MoodTiles = lazy(() =>
  import('../components/GenreTile').then((m) => ({ default: m.MoodTiles }))
)

const SEEDS = ['Dark Knight', 'Pulp Fiction', 'Toy Story', 'Matrix', 'Titanic', 'Jurassic Park']

export function Home() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [rows, setRows] = useState<{ label: string; movies: Movie[] }[]>([])
  const [forYou, setForYou] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const fetched = await Promise.all(
          SEEDS.slice(0, 4).map(async (s) => {
            const r = await api.recommend(s, 8)
            return { label: s, movies: r.items }
          })
        )
        if (alive) {
          setRows([
            { label: t('rows.trending'), movies: fetched[0].movies },
            { label: t('rows.top'), movies: fetched[1].movies },
            { label: `${t('rows.continue')}`, movies: fetched[2].movies },
            { label: t('rows.tamilNew'), movies: fetched[3].movies },
          ])
        }
      } catch {
        /* backend down -> rows stay empty */
      } finally {
        if (alive) setLoading(false)
      }
      try {
        const fy = await api.forYou(10)
        if (alive) setForYou(fy.items)
      } catch {
        /* anonymous -> skip */
      }
    })()
    return () => {
      alive = false
    }
  }, [t])

  return (
    <main id="main">
      <Hero seeds={SEEDS} />
      {forYou.length > 0 && (
        <MovieRow
          title={t('rows.foryou')}
          movies={forYou}
          whyOf={(m) => (m.reasons || [])[0]}
        />
      )}
      {rows.map((r) => (
        <MovieRow key={r.label} title={r.label} movies={r.movies} loading={loading && r.movies.length === 0} />
      ))}
      <section className="row" aria-label={t('rows.moods')}>
        <div className="row-head"><h2>{t('rows.moods')}</h2></div>
        <Suspense fallback={<div className="skel" style={{ height: 80 }} />}>
          <MoodTiles onPick={(m) => nav(`/movies?mood=${m.toLowerCase()}`)} />
        </Suspense>
      </section>
    </main>
  )
}
