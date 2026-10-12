/** Offline-capable smart tools: background removal + OCR (heavy deps lazy-loaded). */

export type SmartProgress = (fraction: number, label: string) => void

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = /^data:([^;]+)/.exec(head)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(new Error('Could not read result'))
    r.readAsDataURL(blob)
  })
}

/**
 * Remove the image background on-device (@imgly/background-removal).
 * First run downloads the model (~40MB, cached in IndexedDB); afterwards it runs offline.
 */
export async function removeImageBackground(dataUrl: string, onProgress?: SmartProgress): Promise<string> {
  const mod = await import('@imgly/background-removal')
  const removeBackground = (mod as unknown as { removeBackground: (src: Blob, cfg?: unknown) => Promise<Blob> }).removeBackground
  if (typeof removeBackground !== 'function') throw new Error('Background-removal engine unavailable')
  const out = await removeBackground(dataUrlToBlob(dataUrl), {
    progress: (key: string, current: number, total: number) => {
      onProgress?.(total > 0 ? current / total : 0, key)
    }
  })
  return blobToDataUrl(out)
}

export type OcrLang = 'eng' | 'tam'

/**
 * OCR image to text (tesseract.js). English + Tamil.
 * Language data downloads on first use and is cached afterwards.
 */
export async function ocrImage(dataUrl: string, langs: OcrLang[], onProgress?: SmartProgress): Promise<string> {
  if (langs.length === 0) throw new Error('Pick at least one language')
  const mod = await import('tesseract.js')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const T = (mod as any).default ?? mod
  const langsArg = [...new Set(langs)].join('+')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worker: any = null
  try {
    worker = await T.createWorker(langsArg, undefined, {
      logger: (m: { status?: string; progress?: number }) => {
        if (typeof m?.progress === 'number') onProgress?.(m.progress, m.status ?? 'recognizing')
      }
    })
    const { data } = await worker.recognize(dataUrl)
    return String(data?.text ?? '').trim()
  } finally {
    try {
      await worker?.terminate()
    } catch {
      /* noop */
    }
  }
}
