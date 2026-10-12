/** Load + downscale images on insert (keeps memory low, docs portable). */

import { fitWithin } from './math'
import { MAX_INSERT_EDGE, MAX_ORIGINAL_EDGE } from './types'

export interface DecodedImage {
  dataUrl: string
  width: number
  height: number
  mime: string
}

/** Decode any loadable image source to an <img> element. */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = src
  })
}

/** Draw an image scaled to fit maxEdge (never upscale) and return a data URL. */
export async function downscaleDataUrl(
  dataUrl: string,
  maxEdge: number,
  outMime?: string
): Promise<DecodedImage> {
  const img = await loadImageElement(dataUrl)
  const natW = img.naturalWidth || img.width
  const natH = img.naturalHeight || img.height
  if (!natW || !natH) throw new Error('Image has no dimensions')
  const fit = fitWithin(natW, natH, maxEdge)
  const mime = outMime ?? mimeForDownscale(dataUrl)
  // already small enough and already in a web-friendly type → keep bytes as-is
  if (fit.width === natW && fit.height === natH && (mime === mimeOf(dataUrl) || !outMime)) {
    return { dataUrl, width: natW, height: natH, mime: mimeOf(dataUrl) }
  }
  const canvas = document.createElement('canvas')
  canvas.width = fit.width
  canvas.height = fit.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, fit.width, fit.height)
  return { dataUrl: canvas.toDataURL(mime, 0.92), width: fit.width, height: fit.height, mime }
}

export function mimeOf(dataUrl: string): string {
  const m = /^data:([^;,]+)/.exec(dataUrl)
  return (m?.[1] ?? 'image/png').toLowerCase()
}

/** Downscaled formats keep alpha when present; photos become JPEG. */
function mimeForDownscale(dataUrl: string): string {
  const m = mimeOf(dataUrl)
  if (m === 'image/png' || m === 'image/webp' || m === 'image/gif') return 'image/png'
  if (m === 'image/svg+xml') return 'image/png'
  return 'image/jpeg'
}

/** Read a File/Blob as a data URL. */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

/**
 * Full insert pipeline for a picked/dropped/pasted file:
 * display copy (≤1920) + master copy (≤2560) for non-destructive reset/editing.
 */
export async function fileToAtlasSources(file: File | Blob): Promise<{ src: DecodedImage; original: DecodedImage }> {
  const raw = await fileToDataUrl(file)
  const [src, original] = await Promise.all([
    downscaleDataUrl(raw, MAX_INSERT_EDGE),
    downscaleDataUrl(raw, MAX_ORIGINAL_EDGE)
  ])
  return { src, original }
}

/** Insert pipeline for an already-encoded data URL (clipboard, screenshot, URL fetch). */
export async function dataUrlToAtlasSources(dataUrl: string): Promise<{ src: DecodedImage; original: DecodedImage }> {
  const [src, original] = await Promise.all([
    downscaleDataUrl(dataUrl, MAX_INSERT_EDGE),
    downscaleDataUrl(dataUrl, MAX_ORIGINAL_EDGE)
  ])
  return { src, original }
}
