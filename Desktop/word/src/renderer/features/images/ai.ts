/** User-key AI features over any OpenAI-compatible endpoint. Keys stay in OS safeStorage. */

export interface AiEndpoint {
  baseUrl: string // e.g. https://api.openai.com/v1
  apiKey: string
  model: string
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

/** Pure: build the chat-completions body for alt-text generation. */
export function buildAltTextBody(imageDataUrl: string, model: string): Record<string, unknown> {
  return {
    model,
    max_tokens: 120,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in one concise sentence for alt text (accessibility). No preamble.' },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }
    ]
  }
}

/** Pure: extract the assistant's text from a chat-completions response. */
export function parseAltTextResponse(json: unknown): string {
  const j = json as { choices?: { message?: { content?: unknown } }[] }
  const c = j?.choices?.[0]?.message?.content
  const text = Array.isArray(c) ? c.map((p) => (typeof p === 'string' ? p : (p as { text?: string }).text ?? '')).join('') : typeof c === 'string' ? c : ''
  return text.trim()
}

export async function generateAltText(imageDataUrl: string, ep: AiEndpoint): Promise<string> {
  const res = await fetch(`${normalizeBaseUrl(ep.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
    body: JSON.stringify(buildAltTextBody(imageDataUrl, ep.model))
  })
  if (!res.ok) throw new Error(`Alt-text request failed (HTTP ${res.status})`)
  const text = parseAltTextResponse(await res.json())
  if (!text) throw new Error('The model returned no description')
  return text
}

/** Pure: build the /images/generations body. */
export function buildImageGenBody(prompt: string, model: string, n: number, size: string): Record<string, unknown> {
  return { model, prompt, n: Math.min(4, Math.max(1, n)), size, response_format: 'b64_json' }
}

/** Pure: normalize /images/generations items to data URLs. */
export function parseImageGenResponse(json: unknown): string[] {
  const j = json as { data?: { b64_json?: string; url?: string }[] }
  if (!Array.isArray(j?.data)) return []
  return j.data.flatMap((d) => {
    if (d.b64_json) return [`data:image/png;base64,${d.b64_json}`]
    if (d.url) return [d.url]
    return []
  })
}

export async function generateImages(prompt: string, ep: AiEndpoint, n: number, size: string): Promise<string[]> {
  const res = await fetch(`${normalizeBaseUrl(ep.baseUrl)}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
    body: JSON.stringify(buildImageGenBody(prompt, ep.model, n, size))
  })
  if (!res.ok) throw new Error(`Image request failed (HTTP ${res.status})`)
  const out = parseImageGenResponse(await res.json())
  if (out.length === 0) throw new Error('The model returned no images')
  // normalize remote URLs to data URLs so the document stays portable
  const finals: string[] = []
  for (const u of out) {
    if (u.startsWith('data:')) {
      finals.push(u)
      continue
    }
    const r = await fetch(u)
    const blob = await r.blob()
    finals.push(await blobToDataUrl(blob))
  }
  return finals
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(new Error('Could not read generated image'))
    r.readAsDataURL(blob)
  })
}
