// TMDB client. All artwork comes from TMDB (no bundled copyrighted images).
// Set VITE_TMDB_KEY in .env to enable posters / backdrops / cast / trailers.
// Without a key the UI falls back to gradient placeholders + backend data.

const API_KEY = import.meta.env.VITE_TMDB_KEY || ''
const BASE = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'

const cache = new Map()

export function hasTmdbKey() {
  return Boolean(API_KEY)
}

export function posterUrl(path, size = 'w342') {
  return path ? `${IMG}/${size}${path}` : null
}

export function backdropUrl(path, size = 'w1280') {
  return path ? `${IMG}/${size}${path}` : null
}

function stripYear(title) {
  // "Toy Story (1995)" -> "Toy Story" for better TMDB hits
  return (title || '').replace(/\s*\(\d{4}\)\s*$/, '').trim()
}

export function cleanTitle(title) {
  return stripYear(title)
}

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

export async function searchMovie(title) {
  if (!API_KEY) return null
  const key = `search:${title.toLowerCase()}`
  if (cache.has(key)) return cache.get(key)
  const q = encodeURIComponent(stripYear(title))
  const data = await getJSON(`${BASE}/search/movie?api_key=${API_KEY}&query=${q}&include_adult=false&language=en-US&page=1`)
  const first = (data.results || [])[0] || null
  cache.set(key, first)
  return first
}

export async function getTrending(mediaType = 'movie', window = 'week', count = 10) {
  if (!API_KEY) return []
  const key = `trending:${mediaType}:${window}`
  if (cache.has(key)) return cache.get(key)
  try {
    const data = await getJSON(`${BASE}/trending/${mediaType}/${window}?api_key=${API_KEY}&language=en-US`)
    const list = (data.results || []).slice(0, count)
    cache.set(key, list)
    return list
  } catch {
    return []
  }
}

export async function getPopular(count = 12) {
  if (!API_KEY) return []
  const key = 'popular'
  if (cache.has(key)) return cache.get(key)
  try {
    const data = await getJSON(`${BASE}/movie/popular?api_key=${API_KEY}&language=en-US&page=1`)
    const list = (data.results || []).slice(0, count)
    cache.set(key, list)
    return list
  } catch {
    return []
  }
}

export async function getCredits(tmdbId) {
  if (!API_KEY || !tmdbId) return []
  const key = `credits:${tmdbId}`
  if (cache.has(key)) return cache.get(key)
  try {
    const data = await getJSON(`${BASE}/movie/${tmdbId}/credits?api_key=${API_KEY}&language=en-US`)
    const cast = (data.cast || []).slice(0, 10)
    cache.set(key, cast)
    return cast
  } catch {
    return []
  }
}

export async function getVideos(tmdbId) {
  if (!API_KEY || !tmdbId) return []
  const key = `videos:${tmdbId}`
  if (cache.has(key)) return cache.get(key)
  try {
    const data = await getJSON(`${BASE}/movie/${tmdbId}/videos?api_key=${API_KEY}&language=en-US`)
    const vids = (data.results || []).filter((v) => v.site === 'YouTube').slice(0, 4)
    cache.set(key, vids)
    return vids
  } catch {
    return []
  }
}

// Convenience: full bundle for a title
export async function getMovieBundle(title) {
  if (!API_KEY) return { movie: null, cast: [], videos: [] }
  try {
    const movie = await searchMovie(title)
    if (!movie) return { movie: null, cast: [], videos: [] }
    const [cast, videos] = await Promise.all([
      getCredits(movie.id),
      getVideos(movie.id),
    ])
    return { movie, cast, videos }
  } catch {
    return { movie: null, cast: [], videos: [] }
  }
}
