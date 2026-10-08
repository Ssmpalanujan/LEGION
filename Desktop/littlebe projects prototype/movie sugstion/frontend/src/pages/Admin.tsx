import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api'
import { useAuth } from '../auth'

interface Metric {
  algo: string
  precision_at_k: number
  recall_at_k: number
  ndcg_at_k: number
  coverage: number
}

export function Admin() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [ab, setAb] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (user && !user.is_admin) nav('/')
    if (user?.is_admin) {
      void api.adminMetrics().then((d) => setMetrics(d.metrics)).catch(() => {})
      void api.adminAB().then((d) => setAb(d)).catch(() => {})
    }
  }, [user, nav])

  if (!user) return <main className="wrap"><p className="tip">Sign in as an admin.</p></main>
  if (!user.is_admin) return <main className="wrap"><p className="tip">Admin only.</p></main>

  const abRows = ['A', 'B']
    .filter((v) => ab && typeof ab[v] === 'object')
    .map((v) => ({ variant: v, ...(ab![v] as Record<string, number>) }))

  return (
    <main id="main" className="wrap">
      <h1 className="page-title">Admin — evaluation & A/B</h1>
      <h2>Offline metrics</h2>
      {metrics.length === 0 ? (
        <p className="tip">No results yet — run backend/scripts/run_evaluation.py.</p>
      ) : (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="algo" stroke="#8A94A6" tick={{ fontSize: 12 }} />
              <YAxis stroke="#8A94A6" />
              <Tooltip contentStyle={{ background: '#161D2B', border: '1px solid rgba(255,255,255,0.1)' }} />
              <Legend />
              <Bar dataKey="precision_at_k" name="P@K" fill="#1A73E8" />
              <Bar dataKey="recall_at_k" name="R@K" fill="#34C759" />
              <Bar dataKey="ndcg_at_k" name="NDCG@K" fill="#F5B301" />
              <Bar dataKey="coverage" fill="#9D7BFF" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <h2>A/B test</h2>
      {abRows.length === 0 ? (
        <p className="tip">No A/B events yet.</p>
      ) : (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={abRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="variant" stroke="#8A94A6" />
              <YAxis stroke="#8A94A6" />
              <Tooltip contentStyle={{ background: '#161D2B', border: '1px solid rgba(255,255,255,0.1)' }} />
              <Legend />
              <Bar dataKey="ctr" name="CTR">
                {abRows.map((r) => (
                  <Cell key={r.variant} fill={r.variant === 'A' ? '#1A73E8' : '#34C759'} />
                ))}
              </Bar>
              <Bar dataKey="like_rate" name="Like rate" fill="#F5B301" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {ab && <p className="tip">p(CTR)={String(ab.p_value_ctr)} · p(like)={String(ab.p_value_like_rate)}</p>}
    </main>
  )
}
