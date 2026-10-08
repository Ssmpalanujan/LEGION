// Typed API client for the CineMatch backend. Base URL from VITE_API_URL.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface Movie {
  id: number
  tmdb_id?: number | null
  title: string
  original_title?: string
  overview?: string
  genres?: string[]
  genres_display?: string
  year?: string
  original_language?: string
  poster_path?: string
  backdrop_path?: string
  cast?: string[]
  director?: string
  vote_average?: number
  content_score?: number
  collab_score?: number
  hybrid_score?: number
  semantic_score?: number
  reasons?: string[]
  breakdown?: Record<string, number>
  friendly?: string
}

async function req<T>(path: string, opts: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const tok = localStorage.getItem('cm_access')
    if (tok) headers.Authorization = `Bearer ${tok}`
  }
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => req<{ status: string }>('/health', {}, false),
  search: (q: string, n = 10) =>
    req<{ query: string; results: Movie[] }>(`/search?q=${encodeURIComponent(q)}&n=${n}`, {}, false),
  semantic: (q: string, n = 10) =>
    req<{ query: string; detected_language: string | null; results: Movie[] }>(
      `/search/semantic?q=${encodeURIComponent(q)}&n=${n}`, {}, false
    ),
  movie: (id: number) => req<Movie>(`/movies/${id}`, {}, false),
  recommend: (title: string, n = 5) =>
    req<{ matched_title: string; matched: Movie; recommendations: string[]; items: Movie[] }>(
      `/recommend?title=${encodeURIComponent(title)}&n=${n}`, {}, false
    ),
  hybrid: (movieId: number, alpha: number, n = 10) =>
    req<{ matched_title: string; matched: Movie; items: Movie[] }>(
      `/recommend/hybrid?movie_id=${movieId}&alpha=${alpha}&n=${n}`, {}, false
    ),
  mood: (mood: string, n = 10) =>
    req<{ mood: string; items: Movie[] }>(`/recommend/mood?mood=${mood}&n=${n}`, {}, false),
  trailer: (id: number) =>
    req<{ youtube_key: string; embed_url: string; watch_url: string }>(`/movies/${id}/trailer`, {}, false),
  forYou: (n = 12) => req<{ items: Movie[] }>(`/recommend/for-you?n=${n}`),
  taste: () => req<{ genre_percent: Record<string, number>; top_languages: [string, number][]; decades: Record<string, number>; liked_count: number }>(`/profile/taste`),
  swipe: (movie_id: number, liked: boolean) =>
    req('/swipes', { method: 'POST', body: JSON.stringify({ movie_id, liked }) }),
  nextCard: () => req<{ card: Movie | null; reason: string }>('/swipes/next'),
  watchlist: () => req<{ items: Movie[] }>('/watchlist'),
  watchAdd: (id: number) => req(`/watchlist/${id}`, { method: 'POST' }),
  watchDel: (id: number) => req(`/watchlist/${id}`, { method: 'DELETE' }),
  register: (email: string, password: string) =>
    req<{ access_token: string; refresh_token: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }, false),
  login: (email: string, password: string) =>
    req<{ access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }, false),
  me: () => req<{ id: number; email: string; is_admin: boolean }>('/auth/me'),
  createRoom: () => req<{ code: string; status: string; participants: number[]; deck: Movie[]; finished: Record<string, boolean>; result_movie_id: number | null }>('/rooms', { method: 'POST' }),
  joinRoom: (code: string) => req<{ code: string; status: string; participants: number[]; deck: Movie[]; finished: Record<string, boolean>; result_movie_id: number | null }>(`/rooms/${code}/join`, { method: 'POST' }),
  roomState: (code: string) => req<{ code: string; status: string; participants: number[]; deck: Movie[]; finished: Record<string, boolean>; result_movie_id: number | null }>(`/rooms/${code}`),
  adminMetrics: () => req<{ metrics: { algo: string; precision_at_k: number; recall_at_k: number; ndcg_at_k: number; coverage: number }[] }>('/admin/metrics'),
  adminAB: () => req<Record<string, unknown>>('/admin/ab-results'),
}
