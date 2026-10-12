/** Stock search (Unsplash/Pexels, user key) + built-in emoji/icon picker data. */

export interface StockPhoto {
  id: string
  thumb: string
  full: string
  alt: string
  author: string
}

export type StockProvider = 'unsplash' | 'pexels'

/** Pure: normalize an Unsplash search response. */
export function parseUnsplash(json: unknown): StockPhoto[] {
  const j = json as { results?: { id: string; urls?: { thumb?: string; full?: string; regular?: string }; alt_description?: string; description?: string; user?: { name?: string } }[] }
  if (!Array.isArray(j?.results)) return []
  return j.results.map((r) => ({
    id: String(r.id),
    thumb: r.urls?.thumb ?? '',
    full: r.urls?.full ?? r.urls?.regular ?? '',
    alt: r.alt_description ?? r.description ?? 'Stock photo',
    author: r.user?.name ?? 'Unsplash'
  }))
}

/** Pure: normalize a Pexels search response. */
export function parsePexels(json: unknown): StockPhoto[] {
  const j = json as { photos?: { id: number; src?: { tiny?: string; large?: string; original?: string }; alt?: string; photographer?: string }[] }
  if (!Array.isArray(j?.photos)) return []
  return j.photos.map((p) => ({
    id: String(p.id),
    thumb: p.src?.tiny ?? '',
    full: p.src?.large ?? p.src?.original ?? '',
    alt: p.alt || 'Stock photo',
    author: p.photographer ?? 'Pexels'
  }))
}

export async function searchStock(provider: StockProvider, apiKey: string, query: string, perPage = 12): Promise<StockPhoto[]> {
  const q = encodeURIComponent(query.trim())
  if (!q) return []
  if (provider === 'unsplash') {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${q}&per_page=${perPage}`, {
      headers: { Authorization: `Client-ID ${apiKey}` }
    })
    if (res.status === 401 || res.status === 403) throw new Error('Unsplash rejected the API key (401/403)')
    if (!res.ok) throw new Error(`Unsplash search failed (HTTP ${res.status})`)
    return parseUnsplash(await res.json())
  }
  const res = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=${perPage}`, {
    headers: { Authorization: apiKey }
  })
  if (res.status === 401 || res.status === 403) throw new Error('Pexels rejected the API key (401/403)')
  if (!res.ok) throw new Error(`Pexels search failed (HTTP ${res.status})`)
  return parsePexels(await res.json())
}

/** Download a remote photo to a data URL so the document stays portable/offline-safe. */
export async function stockToDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) throw new Error('Not an image response')
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(new Error('Could not read photo'))
    r.readAsDataURL(blob)
  })
}

export const EMOJI_SETS: { name: string; items: string[] }[] = [
  { name: 'Faces', items: ['😀', '😅', '😍', '🤔', '😴', '😭', '😡', '🥳', '😎', '🤯', '👍', '👏', '🙏', '💪', '👀', '🎉'] },
  { name: 'Objects', items: ['💡', '📎', '📌', '✂️', '📷', '🎨', '🔑', '🔒', '💰', '🎁', '⚽', '🚗', '✈️', '☕', '🍎', '🌙'] },
  { name: 'Symbols', items: ['✅', '❌', '⭐', '❤️', '🔥', '⚠️', '➡️', '⬆️', '🔄', '💯', '©️', '®️', '™️', '§', '¶', '•'] }
]

export interface BuiltinIcon {
  name: string
  svg: string
}

/** Small geometric icon set, inserted as SVG pictures (crisp at any size). */
export const BUILTIN_ICONS: BuiltinIcon[] = [
  { name: 'Arrow right', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#2B579A" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' },
  { name: 'Check', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#217346" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>' },
  { name: 'Cross', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>' },
  { name: 'Star', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="#f1c40f" stroke="#b7950b" stroke-width="1"><path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4 6.1 20.7l1.3-6.6L2.5 9.5l6.6-.8z"/></svg>' },
  { name: 'Heart', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="#e74c3c"><path d="M12 21C7 16.5 3 13 3 8.8 3 6 5.2 4 7.8 4c1.7 0 3.2.9 4.2 2.3C13 4.9 14.5 4 16.2 4 18.8 4 21 6 21 8.8c0 4.2-4 7.7-9 12.2z"/></svg>' },
  { name: 'Bulb', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.3 2.2h4.6c.2-.9.6-1.6 1.3-2.2A6 6 0 0 0 12 3z"/></svg>' },
  { name: 'Warning', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="#f39c12"><path d="M12 2L1.8 20.2h20.4L12 2zm0 6.5l6.3 11H5.7L12 8.5zM11 11v4h2v-4h-2zm0 5v2h2v-2h-2z"/></svg>' },
  { name: 'Info', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="#2B579A"><circle cx="12" cy="12" r="10"/><rect x="11" y="10" width="2" height="7" fill="#fff"/><circle cx="12" cy="7.5" r="1.4" fill="#fff"/></svg>' },
  { name: 'Camera', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#34495e" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 7l1.5-2.5h5L16 7"/></svg>' },
  { name: 'Mail', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#2B579A" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>' },
  { name: 'Phone', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#217346" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>' },
  { name: 'Globe', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#2B579A" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/></svg>' }
]

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}
