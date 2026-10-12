/** AES-GCM password protection for saved documents (WebCrypto, renderer-side). */

export const ENVELOPE_MARKER = 'wordpad-aes-gcm'

export interface Envelope {
  enc: typeof ENVELOPE_MARKER
  salt: string
  iv: string
  data: string
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptText(plain: string, password: string): Promise<string> {
  if (!password) throw new Error('Password is required')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plain))
  const env: Envelope = { enc: ENVELOPE_MARKER, salt: bufToB64(salt.buffer as ArrayBuffer), iv: bufToB64(iv.buffer as ArrayBuffer), data: bufToB64(ct) }
  return JSON.stringify(env)
}

export async function decryptText(envelopeJson: string, password: string): Promise<string> {
  const env = JSON.parse(envelopeJson) as Envelope
  if (env.enc !== ENVELOPE_MARKER) throw new Error('Not a protected WordPad document')
  const key = await deriveKey(password, b64ToBuf(env.salt))
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(env.iv) as BufferSource },
    key,
    b64ToBuf(env.data) as BufferSource
  )
  return new TextDecoder().decode(pt)
}

export function looksEncrypted(s: string): boolean {
  const t = s.trim()
  return t.startsWith('{') && t.includes(ENVELOPE_MARKER)
}
