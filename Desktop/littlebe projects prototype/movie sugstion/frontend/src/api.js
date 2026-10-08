// Typed-light API client for the CineMatch backend (base URL from VITE_API_URL).
// Token (JWT access) is kept in localStorage under 'cm_access'.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const wsUrl = (path, token) =>
  `${API_URL.replace(/^http/, 'ws')}${path}?token=${encodeURIComponent(token || '')}`

function headers(auth = true) {
  const h = { 'Content-Type': 'application/json' }
  if (auth) {
    const t = localStorage.getItem('cm_access')
    if (t) h.Authorization = `Bearer ${t}`
  }
  return h
}

async function req(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: headers(auth),
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
  return data
}

const get = (path, auth = true) => req(path, { auth })
const post = (path, body) => req(path, { method: 'POST', body })
const del = (path) => req(path, { method: 'DELETE' })

export const api = {
  // core
  search: (q, n = 10) => get(`/search?q=${encodeURIComponent(q)}&n=${n}`, false),
  semantic: (q, n = 12) => get(`/search/semantic?q=${encodeURIComponent(q)}&n=${n}`, false),
  recommend: (title, n = 8) => get(`/recommend?title=${encodeURIComponent(title)}&n=${n}`, false),
  hybrid: (title, alpha = 0.5, n = 8) =>
    get(`/recommend/hybrid?title=${encodeURIComponent(title)}&alpha=${alpha}&n=${n}`, false),
  hybridById: (movieId, alpha = 0.5, n = 8) =>
    get(`/recommend/hybrid?movie_id=${movieId}&alpha=${alpha}&n=${n}`, false),
  mood: (mood, n = 12) => get(`/recommend/mood?mood=${mood}&n=${n}`, false),
  movie: (id) => get(`/movies/${id}`, false),
  trailer: (id) => get(`/movies/${id}/trailer`, false),
  // auth
  register: (email, password) => post('/auth/register', { email, password }),
  login: (email, password) => post('/auth/login', { email, password }),
  me: () => get('/auth/me'),
  // personal
  swipe: (movie_id, liked) => post('/swipes', { movie_id, liked }),
  nextCard: () => get('/swipes/next'),
  forYou: (n = 12) => get(`/recommend/for-you?n=${n}`),
  taste: () => get('/profile/taste'),
  watchlist: () => get('/watchlist'),
  watchAdd: (id) => post(`/watchlist/${id}`, {}),
  watchDel: (id) => del(`/watchlist/${id}`),
  // rooms
  createRoom: () => post('/rooms', {}),
  joinRoom: (code) => post(`/rooms/${code}/join`, {}),
  roomState: (code) => get(`/rooms/${code}`),
  // admin
  adminMetrics: () => get('/admin/metrics'),
  adminAB: () => get('/admin/ab-results'),
}
