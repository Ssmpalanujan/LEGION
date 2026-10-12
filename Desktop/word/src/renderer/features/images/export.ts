/** Image export: cropped rendering, compression, format conversion. */

import type { CropBox, CropShape } from './types'
import { loadImageElement } from './downscale'
import { base64ToBytes, parseDataUrl } from './math'

export type ExportFormat = 'png' | 'jpg' | 'webp'

export function mimeForFormat(f: ExportFormat): string {
  return f === 'png' ? 'image/png' : f === 'jpg' ? 'image/jpeg' : 'image/webp'
}

export function extForFormat(f: ExportFormat): string {
  return f
}

export interface ExportPlan {
  mime: string
  quality: number | undefined
  outWidth: number
  outHeight: number
  fileName: string
}

/** Pure plan for "export this image": output dims (crop applied), mime, name. */
export function buildExportPlan(
  natW: number,
  natH: number,
  crop: CropBox | null,
  format: ExportFormat,
  quality: number,
  baseName: string
): ExportPlan {
  const w = crop ? Math.max(1, Math.round(natW * crop.w)) : Math.max(1, natW)
  const h = crop ? Math.max(1, Math.round(natH * crop.h)) : Math.max(1, natH)
  return {
    mime: mimeForFormat(format),
    quality: format === 'png' ? undefined : Math.min(1, Math.max(0.1, quality)),
    outWidth: w,
    outHeight: h,
    fileName: `${baseName || 'image'}.${extForFormat(format)}`
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), mime, quality)
  })
}

/** Render (optionally cropped / circle-masked) pixels to bytes. */
export async function renderCroppedBytes(
  src: string,
  crop: CropBox | null,
  shape: CropShape,
  mime: string,
  quality?: number
): Promise<{ bytes: Uint8Array; width: number; height: number; mime: string }> {
  const img = await loadImageElement(src)
  const natW = img.naturalWidth || img.width
  const natH = img.naturalHeight || img.height
  const sx = crop ? Math.round(crop.x * natW) : 0
  const sy = crop ? Math.round(crop.y * natH) : 0
  const sw = crop ? Math.max(1, Math.round(crop.w * natW)) : natW
  const sh = crop ? Math.max(1, Math.round(crop.h * natH)) : natH
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  if (shape === 'circle') {
    ctx.beginPath()
    ctx.ellipse(sw / 2, sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2)
    ctx.clip()
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  const blob = await canvasToBlob(canvas, mime, quality)
  const buf = new Uint8Array(await blob.arrayBuffer())
  return { bytes: buf, width: sw, height: sh, mime }
}

/** Re-encode current pixels as JPEG (document compress feature). Keeps dimensions. */
export async function compressSrc(src: string, quality: number): Promise<string> {
  const { bytes } = await renderCroppedBytes(src, null, 'rect', 'image/jpeg', Math.min(0.95, Math.max(0.3, quality)))
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:image/jpeg;base64,${btoa(bin)}`
}

/** Bytes of an embedded data URL (for docx ImageRun). */
export function dataUrlBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) throw new Error('Image has no decodable data')
  return { bytes: base64ToBytes(parsed.base64), mime: parsed.mime }
}
