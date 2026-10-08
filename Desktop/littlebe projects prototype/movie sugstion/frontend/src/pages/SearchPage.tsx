import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api, type Movie } from '../api'
import { MovieCard } from '../components/MovieCard'

export function SearchPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') || ''
  const [q, setQ] = useState(initial)
  const [lang, setLang] = useState('')
  const [results, setResults] = useState<Movie[]>([])
  const [detected, setDetected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async (query: string) => {
    const queryTrim = query.trim()
    if (!queryTrim) return
    setLoading(true)
    setParams({ q: queryTrim })
    try {
      const d = await api.semantic(queryTrim, 18)
      setDetected(d.detected_language)
      let list = d.results
      if (lang) list = list.filter((m) => m.original_language === lang)
      setResults(list)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initial) void run(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main id="main" className="wrap">
      <h1 className="page-title">{t('search.title')}</h1>
      <div className="toolbar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run(q)
          }}
          placeholder={t('search.placeholder')}
          aria-label="Natural language search"
          style={{ flex: 1, minWidth: 220 }}
        />
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language filter">
          <option value="">All languages</option>
          <option value="en">English</option>
          <option value="ta">தமிழ்</option>
          <option value="si">සිංහල</option>
          <option value="hi">Hindi</option>
        </select>
        <button className="btn btn-blue" onClick={() => void run(q)}>Search</button>
      </div>
      <div className="chips" aria-label="Example searches">
        {(t('search.examples', { returnObjects: true }) as string[]).map((ex) => (
          <button key={ex} onClick={() => { setQ(ex); void run(ex) }}>{ex}</button>
        ))}
      </div>
      {detected && <p className="tip">Detected language: {detected}</p>}
      {loading && <p className="tip">{t('common.loading')}</p>}
      <div className="grid">
        {results.map((m) => (
          <MovieCard key={m.id} movie={m} />
        ))}
      </div>
      {!loading && results.length === 0 && <p className="tip">{t('common.empty')}</p>}
    </main>
  )
}
