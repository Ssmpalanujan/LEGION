import { useEffect, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuth } from '../auth'

export function Profile() {
  const { user, login, register, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [err, setErr] = useState('')
  const [taste, setTaste] = useState<{
    genre_percent: Record<string, number>
    top_languages: [string, number][]
    decades: Record<string, number>
    liked_count: number
  } | null>(null)

  useEffect(() => {
    if (!user) return
    void import('../api').then(({ api }) =>
      api.taste().then(setTaste).catch(() => {})
    )
  }, [user])

  const submit = async () => {
    setErr('')
    try {
      if (mode === 'login') await login(email, pw)
      else await register(email, pw)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    }
  }

  if (!user)
    return (
      <main id="main" className="wrap" style={{ maxWidth: 480 }}>
        <h1 className="page-title">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <div className="panel" style={{ display: 'grid', gap: 10 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" aria-label="Email" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password (6+ chars)" type="password" aria-label="Password" />
          {err && <p style={{ color: '#ff8a8a' }}>{err}</p>}
          <button className="btn btn-blue" onClick={() => void submit()}>
            {mode === 'login' ? 'Sign in' : 'Register'}
          </button>
          <button className="btn btn-outline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
          </button>
        </div>
      </main>
    )

  return (
    <main id="main" className="wrap">
      <h1 className="page-title">Profile</h1>
      <p className="tip">{user.email} {user.is_admin && '· admin'}</p>
      <button className="btn btn-outline" onClick={logout}>Logout</button>
      <h2 style={{ marginTop: '2rem' }}>Taste profile</h2>
      {!taste ? (
        <p className="tip">Loading…</p>
      ) : taste.liked_count === 0 ? (
        <p className="tip">Swipe or like some movies to build your taste profile.</p>
      ) : (
        <div className="night-grid">
          <div className="panel">
            <h3>Genres (%)</h3>
            <GenreDonut data={taste.genre_percent} />
          </div>
          <div className="panel">
            <h3>Languages</h3>
            <ul className="cast-list">
              {taste.top_languages.map(([l, c]) => (
                <li key={l}><strong>{l}</strong><small>{c} liked</small></li>
              ))}
            </ul>
            <h3>Decades</h3>
            <ul className="cast-list">
              {Object.entries(taste.decades).map(([d, c]) => (
                <li key={d}><strong>{d}</strong><small>{c} liked</small></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  )
}

function GenreDonut({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
  const COLORS = ['#1A73E8', '#34C759', '#F5B301', '#FF6B6B', '#9D7BFF', '#22D3EE', '#FF9F43', '#E86AA8']
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={entries.map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" outerRadius={90} label>
            {entries.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
