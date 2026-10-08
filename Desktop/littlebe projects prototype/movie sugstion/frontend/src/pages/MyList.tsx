import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Movie } from '../api'
import { useAuth } from '../auth'
import { MovieCard } from '../components/MovieCard'

export function MyList() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<Movie[]>([])

  const load = () => {
    void api.watchlist().then((w) => setItems(w.items)).catch(() => {})
  }
  useEffect(load, [])

  if (!user)
    return (
      <main className="wrap">
        <h1 className="page-title">My List</h1>
        <p className="tip">Sign in to see your list.</p>
        <button className="btn btn-blue" onClick={() => nav('/profile')}>Sign in</button>
      </main>
    )

  return (
    <main id="main" className="wrap">
      <h1 className="page-title">My List</h1>
      {items.length === 0 ? (
        <p className="tip">Empty — add movies from any detail page.</p>
      ) : (
        <div className="grid">
          {items.map((m) => (
            <div key={m.id} style={{ display: 'grid', gap: 6 }}>
              <MovieCard movie={m} />
              <button
                className="btn btn-outline"
                style={{ padding: '0.4rem' }}
                onClick={() => void api.watchDel(m.id).then(load)}
                aria-label={`Remove ${m.title}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
