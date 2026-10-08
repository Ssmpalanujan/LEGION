// TMDB artwork helper. All posters/backdrops come from TMDB (VITE_TMDB_KEY);
// the UI falls back to a dark gradient placeholder when missing.
// No third-party artwork is bundled.
const KEY = import.meta.env.VITE_TMDB_KEY || ''
const IMG = 'https://image.tmdb.org/t/p'
const cache = new Map<string, Promise<unknown>>()

export const hasTmdbKey = () => Boolean(KEY)
export const img = (path: string | undefined, size = 'w342') =>
  path ? `${IMG}/${size}${path}` : null

export function cleanTitle(title: string): string {
  return (title || '').replace(/\s*\(\d{4}\)\s*$/, '').trim()
}

interface TmdbMovie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
}

export function tmdbSearch(title: string): Promise<TmdbMovie | null> {
  if (!KEY) return Promise.resolve(null)
  const k = `s:${title.toLowerCase()}`
  if (!cache.has(k)) {
    const q = encodeURIComponent(cleanTitle(title))
    cache.set(
      k,
      fetch(`https://api.themoviedb.org/3/search/movie?api_key=${KEY}&query=${q}&include_adult=false&page=1`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => (d.results || [])[0] || null)
        .catch(() => null)
    )
  }
  return cache.get(k) as Promise<TmdbMovie | null>
}
