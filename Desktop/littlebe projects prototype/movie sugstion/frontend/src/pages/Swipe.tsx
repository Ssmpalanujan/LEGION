import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Movie } from '../api'
import { useAuth } from '../auth'
import { cleanTitle, tmdbSearch, img } from '../tmdb'

export function Swipe() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [card, setCard] = useState<Movie | null>(null)
  const [poster, setPoster] = useState<string | null>(null)
  const [history, setHistory] = useState<{ movie: Movie; liked: boolean }[]>([])
  const [reason, setReason] = useState('')

  const next = useCallback(async () => {
    try {
      const d = await api.nextCard()
      setCard(d.card)
      setReason(d.reason || '')
      setPoster(null)
      if (d.card) {
        const tm = await tmdbSearch(d.card.title).catch(() => null)
        if (tm?.poster_path) setPoster(img(tm.poster_path, 'w500'))
      }
    } catch {
      setCard(null)
    }
  }, [])

  useEffect(() => {
    if (user) void next()
  }, [user, next])

  if (!user)
    return (
      <main className="wrap">
        <h1 className="page-title">Swipe</h1>
        <p className="tip">Sign in to start swiping.</p>
        <button className="btn btn-blue" onClick={() => nav('/profile')}>Sign in</button>
      </main>
    )

  const act = async (liked: boolean) => {
    if (!card) return
    await api.swipe(card.id, liked).catch(() => {})
    setHistory((h) => [...h, { movie: card, liked }])
    await next()
  }

  const undo = async () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    setCard(last.movie)
  }

  return (
    <main id="main" className="wrap">
      <h1 className="page-title">Swipe</h1>
      <div className="swipe-stage">
        <AnimatePresence mode="wait">
          {card ? (
            <motion.div
              key={card.id}
              className="swipe-card"
              drag="x"
              dragConstraints={{ left: -120, right: 120 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 80) void act(true)
                else if (info.offset.x < -80) void act(false)
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {poster ? (
                <img src={poster} alt={`${cleanTitle(card.title)} poster`} draggable={false} />
              ) : (
                <div className="swipe-fallback">{cleanTitle(card.title)}</div>
              )}
              <div className="swipe-info">
                <strong>{card.title}</strong>
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  {[card.year, (card.genres || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                </div>
                {reason && <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 4 }}>{reason}</div>}
              </div>
            </motion.div>
          ) : (
            <p className="tip">No more cards — you swiped them all.</p>
          )}
        </AnimatePresence>
        <div className="swipe-btns">
          <button onClick={() => void act(false)} aria-label="Skip">✕</button>
          <button onClick={undo} aria-label="Undo" disabled={history.length === 0}>↩</button>
          <button className="like" onClick={() => void act(true)} aria-label="Like">♥</button>
        </div>
      </div>
    </main>
  )
}
