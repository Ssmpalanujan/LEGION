/** Pure image math: resize handles, unit conversion, crop boxes, snapping, data-URL helpers. */

import type { CropBox, CropPreset, ResizeHandleId, SizeUnit } from './types'

export const PX_PER_CM = 96 / 2.54
export const MIN_IMAGE_PX = 24
export const MAX_IMAGE_PX = 3000

/** Scale natural dimensions so the long edge fits `maxEdge` (never upscale). */
export function fitWithin(natW: number, natH: number, maxEdge: number): { width: number; height: number } {
  if (natW <= 0 || natH <= 0) return { width: 0, height: 0 }
  const s = Math.min(1, maxEdge / Math.max(natW, natH))
  return { width: Math.round(natW * s), height: Math.round(natH * s) }
}

export interface ResizeOpts {
  /** Keep aspect ratio (corner handles default true; Shift key unlocks). */
  lockAspect: boolean
  /** True while Shift is held → corners resize freely. */
  shiftKey: boolean
  min?: number
  max?: number
}

/**
 * Compute a new size from a handle drag.
 * Corners preserve aspect ratio unless unlocked (Shift); edges resize one axis.
 * dx/dy are pointer deltas in CSS px (screen space, +x right, +y down).
 */
export function resizeFromHandle(
  startW: number,
  startH: number,
  dx: number,
  dy: number,
  handle: ResizeHandleId,
  opts: ResizeOpts
): { width: number; height: number } {
  const min = opts.min ?? MIN_IMAGE_PX
  const max = opts.max ?? MAX_IMAGE_PX
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0
  const isCorner = sx !== 0 && sy !== 0
  const keepAspect = isCorner && opts.lockAspect && !opts.shiftKey

  let w = startW
  let h = startH
  if (keepAspect && startW > 0 && startH > 0) {
    const scaleW = (startW + dx * sx) / startW
    const scaleH = (startH + dy * sy) / startH
    // dominant axis wins so shrinking works when dragging inward
    const s = Math.max(scaleW, scaleH)
    w = startW * s
    h = startH * s
  } else {
    if (sx !== 0) w = startW + dx * sx
    if (sy !== 0) h = startH + dy * sy
  }
  // enforce min (scale up proportionally when aspect is kept)
  if (keepAspect) {
    const sMin = Math.max(min / w, min / h, 1e-6)
    if (w < min || h < min) {
      w *= sMin
      h *= sMin
    }
    const sMax = Math.min(max / w, max / h)
    if (w > max || h > max) {
      w *= sMax
      h *= sMax
    }
  } else {
    w = Math.min(max, Math.max(min, w))
    h = Math.min(max, Math.max(min, h))
  }
  return { width: Math.round(w), height: Math.round(h) }
}

/** Convert a size value in the given unit to CSS px. pct is relative to refWidthPx. */
export function unitsToPx(value: number, unit: SizeUnit, refWidthPx: number): number {
  if (unit === 'cm') return value * PX_PER_CM
  if (unit === 'pct') return (value / 100) * refWidthPx
  return value
}

/** Convert CSS px to the given unit. pct is relative to refWidthPx. */
export function pxToUnits(px: number, unit: SizeUnit, refWidthPx: number): number {
  if (unit === 'cm') return px / PX_PER_CM
  if (unit === 'pct') return refWidthPx > 0 ? (px / refWidthPx) * 100 : 0
  return px
}

/** Clamp a crop box into the unit square, enforce min size, optionally enforce aspect (w/h). */
export function clampCropBox(box: CropBox, aspect: number | null): CropBox {
  let { x, y, w, h } = box
  const MIN = 0.02
  w = Math.max(MIN, Math.min(1, w))
  h = Math.max(MIN, Math.min(1, h))
  if (aspect && aspect > 0) {
    // shrink the freer axis to match the aspect
    if (w / h > aspect) w = h * aspect
    else h = w / aspect
  }
  x = Math.min(Math.max(0, x), 1 - w)
  y = Math.min(Math.max(0, y), 1 - h)
  // re-clamp size in case position clamp pushed edges out
  w = Math.min(w, 1 - x)
  h = Math.min(h, 1 - y)
  return { x, y, w: Math.max(MIN, w), h: Math.max(MIN, h) }
}

/** Centered maximal crop box for a preset, given the image aspect (w/h). */
export function cropPresetBox(preset: CropPreset, imgAspect: number): CropBox {
  if (preset === 'free' || preset === 'circle') return { x: 0, y: 0, w: 1, h: 1 }
  const target = preset === '1:1' ? 1 : preset === '4:3' ? 4 / 3 : 16 / 9
  let w = 1
  let h = 1
  if (imgAspect > target) w = target / imgAspect
  else h = imgAspect / target
  const box = { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
  return clampCropBox(box, target)
}

/** Convert a crop box to docx-style edge trim percentages (0-100). */
export function cropToDocxPercent(box: CropBox): { left: number; top: number; right: number; bottom: number } {
  const pct = (v: number) => Math.round(Math.min(100, Math.max(0, v * 100)) * 100) / 100
  return { left: pct(box.x), top: pct(box.y), right: pct(1 - box.x - box.w), bottom: pct(1 - box.y - box.h) }
}

const GUIDES = [0, 0.25, 0.5, 0.75, 1]

/** Snap a free position (0..1) to page guides within threshold. */
export function snapPosition(
  x: number,
  y: number,
  threshold = 0.02
): { x: number; y: number; guideX: number | null; guideY: number | null } {
  let guideX: number | null = null
  let guideY: number | null = null
  let nx = Math.min(1, Math.max(0, x))
  let ny = Math.min(1, Math.max(0, y))
  for (const g of GUIDES) {
    if (guideX === null && Math.abs(nx - g) <= threshold) {
      nx = g
      guideX = g
    }
    if (guideY === null && Math.abs(ny - g) <= threshold) {
      ny = g
      guideY = g
    }
  }
  return { x: nx, y: ny, guideX, guideY }
}

/** Split a data URL into mime + base64 payload. Returns null when malformed. */
export function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,(.*)$/s.exec(dataUrl.trim())
  if (!m) return null
  return { mime: m[1].toLowerCase(), base64: m[2] }
}

/** Approximate decoded byte length of a base64 payload (no decoding needed). */
export function base64ByteLength(base64: string): number {
  const clean = base64.replace(/\s/g, '')
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((clean.length * 3) / 4) - pad)
}

/** Decode base64 to bytes (chunked to avoid stack overflow on large images). */
export function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64)
  const out = new Uint8Array(bin.length)
  const CHUNK = 0x8000
  for (let i = 0; i < bin.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, bin.length)
    for (let j = i; j < end; j++) out[j] = bin.charCodeAt(j)
  }
  return out
}

/** Rendered display size accounting for 90/270° rotation swap. */
export function displaySize(width: number | null, naturalWidth: number, naturalHeight: number, rotation: number): { width: number; height: number } {
  const w = width ?? naturalWidth
  const h = width != null && naturalWidth > 0 ? (width * naturalHeight) / naturalWidth : naturalHeight
  const swapped = rotation === 90 || rotation === 270
  return { width: swapped ? h : w, height: swapped ? w : h }
}
