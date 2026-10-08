import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL, api, type Movie } from '../api'
import { useAuth } from '../auth'

interface RoomState {
  code: string
  status: string
  participants: number[]
  deck: Movie[]
  finished: Record<string, boolean>
  result_movie_id: number | null
}

export function Night() {
  const { user, token } = useAuth()
  const nav = useNavigate()
  const [room, setRoom] = useState<RoomState | null>(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ movie: Movie | null; likes: number; of: number; explanation: string } | null>(null)
  const [pos, setPos] = useState(0)
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => () => ws.current?.close(), [])

  if (!user)
    return (
      <main className="wrap">
        <h1 className="page-title">Movie Night</h1>
        <p className="tip">Sign in to create or join a room.</p>
        <button className="btn btn-blue" onClick={() => nav('/profile')}>Sign in</button>
      </main>
    )

  const connect = (roomCode: string) => {
    ws.current?.close()
    const wsUrl = `${API_URL.replace(/^http/, 'ws')}/ws/rooms/${roomCode}?token=${token}`
    const sock = new WebSocket(wsUrl)
    ws.current = sock
    sock.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'result') setResult(msg)
      if (msg.type === 'swipe' || msg.type === 'joined' || msg.type === 'presence') {
        void api.roomState(roomCode).then(setRoom).catch(() => {})
      }
    }
  }

  const create = async () => {
    const r = await api.createRoom()
    setRoom(r)
    setResult(null)
    setPos(0)
    connect(r.code)
  }
  const join = async () => {
    const r = await api.joinRoom(code.trim().toUpperCase())
    setRoom(r)
    setResult(null)
    setPos(0)
    connect(r.code)
  }

  const swipe = (liked: boolean) => {
    const card = room?.deck[pos]
    if (!card || !ws.current) return
    ws.current.send(JSON.stringify({ type: 'swipe', movie_id: card.id, liked }))
    setPos((p) => p + 1)
  }

  const card = room?.deck[pos]

  return (
    <main id="main" className="wrap">
      <h1 className="page-title">Movie Night</h1>
      {!room ? (
        <div className="night-grid">
          <div className="panel">
            <h3>Create a room</h3>
            <p className="tip">2–4 participants swipe the same 20 movies.</p>
            <button className="btn btn-blue" onClick={() => void create()}>Create room</button>
          </div>
          <div className="panel">
            <h3>Join with code</h3>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6-character code" maxLength={6} aria-label="Room code" />
            <button className="btn btn-blue" onClick={() => void join()} disabled={code.trim().length !== 6}>Join</button>
          </div>
        </div>
      ) : result ? (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p className="hero-kicker">Group pick</p>
          <h2>{result.movie?.title || 'No pick'}</h2>
          <p>
            Liked by {result.likes}/{result.of} · {result.explanation}
          </p>
          <button className="btn btn-outline" onClick={() => { setRoom(null); setResult(null) }}>Leave room</button>
        </div>
      ) : (
        <div className="night-grid">
          <div className="panel">
            <h3>Room {room.code}</h3>
            <div className="avatars" aria-label="Participants">
              {room.participants.map((u) => (
                <span key={u} className={`avatar-dot${room.finished[String(u)] ? ' done' : ''}`} title={room.finished[String(u)] ? `User ${u} finished` : `User ${u} swiping`}>
                  {String(u).slice(-2)}
                </span>
              ))}
            </div>
            {card ? (
              <div>
                <h2>{card.title}</h2>
                <p className="tip">{pos + 1} / {room.deck.length} · {card.genres_display}</p>
                <div className="swipe-btns">
                  <button onClick={() => swipe(false)} aria-label="Skip">✕</button>
                  <button className="like" onClick={() => swipe(true)} aria-label="Like">♥</button>
                </div>
              </div>
            ) : (
              <p className="tip">You finished — waiting for the others…</p>
            )}
          </div>
          <div className="panel">
            <h3>How it works</h3>
            <p className="tip">Everyone swipes the shared deck. When all finish, the group pick maximizes likes, breaking ties by taste similarity.</p>
            <button className="btn btn-outline" onClick={() => { ws.current?.close(); setRoom(null) }}>Leave</button>
          </div>
        </div>
      )}
    </main>
  )
}
