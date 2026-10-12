/** Canvas filter pipeline. Pixel math runs on plain buffers (unit-testable without DOM canvas). */

import type { Annotation, FilterState } from './editorTypes'

export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** CSS filter string for the GPU-accelerated portion (brightness/contrast/saturate/blur/hue). */
export function cssFilterString(f: FilterState): string {
  const parts: string[] = []
  if (f.brightness !== 0) parts.push(`brightness(${(1 + f.brightness / 100).toFixed(3)})`)
  if (f.contrast !== 0) parts.push(`contrast(${(1 + f.contrast / 100).toFixed(3)})`)
  if (f.saturation !== 0) parts.push(`saturate(${(1 + f.saturation / 100).toFixed(3)})`)
  if (f.blur > 0) parts.push(`blur(${f.blur.toFixed(1)}px)`)
  if (f.hue !== 0) parts.push(`hue-rotate(${f.hue}deg)`)
  return parts.length ? parts.join(' ') : 'none'
}

/**
 * CPU adjustments: exposure (2^EV gain), temperature (red/blue balance),
 * tint (green/magenta balance). Applied in place.
 */
export function adjustPixels(buf: PixelBuffer, opts: { exposure: number; temperature: number; tint: number }): void {
  const gain = Math.pow(2, Math.max(-2, Math.min(2, opts.exposure)))
  const tShift = (Math.max(-100, Math.min(100, opts.temperature)) / 100) * 28
  const tintShift = (Math.max(-100, Math.min(100, opts.tint)) / 100) * 22
  if (gain === 1 && tShift === 0 && tintShift === 0) return
  const d = buf.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i] * gain + tShift
    d[i + 1] = d[i + 1] * gain + tintShift
    d[i + 2] = d[i + 2] * gain - tShift
  }
}

/** Unsharp-style sharpening via 3x3 kernel, blended by amount (0..1). Returns a new buffer. */
export function sharpenPixels(src: PixelBuffer, amount: number): PixelBuffer {
  const k = Math.max(0, Math.min(1, amount))
  if (k === 0) return src
  const { width: w, height: h, data: s } = src
  const out = new Uint8ClampedArray(s)
  const at = (x: number, y: number, c: number): number => {
    const xx = Math.min(w - 1, Math.max(0, x))
    const yy = Math.min(h - 1, Math.max(0, y))
    return s[(yy * w + xx) * 4 + c]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        const lap = 4 * at(x, y, c) - at(x - 1, y, c) - at(x + 1, y, c) - at(x, y - 1, c) - at(x, y + 1, c)
        const v = at(x, y, c) + lap * k * 0.6
        out[(y * w + x) * 4 + c] = v
      }
      out[(y * w + x) * 4 + 3] = s[(y * w + x) * 4 + 3]
    }
  }
  return { width: w, height: h, data: out }
}

/* ---------- DOM canvas boundary (not unit-tested; needs a real canvas) ---------- */

export function imageDataToBuffer(id: ImageData): PixelBuffer {
  return { width: id.width, height: id.height, data: new Uint8ClampedArray(id.data) }
}

export function bufferToImageData(buf: PixelBuffer): ImageData {
  // fresh ArrayBuffer-backed copy: ImageData requires Uint8ClampedArray<ArrayBuffer>
  const data = new Uint8ClampedArray(buf.width * buf.height * 4)
  data.set(buf.data.subarray(0, data.length))
  return new ImageData(data, buf.width, buf.height)
}

/** Draw vector annotations (fractions of image size) onto a 2d context. */
export function drawAnnotations(ctx: CanvasRenderingContext2D, W: number, H: number, list: Annotation[]): void {
  for (const a of list) {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (a.kind === 'stroke') {
      ctx.globalAlpha = a.tool === 'highlighter' ? 0.45 : 1
      ctx.strokeStyle = a.color
      ctx.lineWidth = Math.max(1, (a.width * Math.max(W, H)) / 800)
      ctx.beginPath()
      a.points.forEach((p, i) => {
        const x = p.x * W
        const y = p.y * H
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    } else if (a.kind === 'shape') {
      ctx.strokeStyle = a.color
      ctx.lineWidth = Math.max(1, (a.width * Math.max(W, H)) / 800)
      const x = a.x * W
      const y = a.y * H
      const w = a.w * W
      const h = a.h * H
      if (a.tool === 'rect') {
        ctx.strokeRect(x, y, w, h)
      } else if (a.tool === 'circle') {
        ctx.beginPath()
        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        // arrow: line + head
        const x2 = x + w
        const y2 = y + h
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        const ang = Math.atan2(y2 - y, x2 - x)
        const head = Math.min(24, Math.max(10, Math.hypot(w, h) * 0.12))
        ctx.fillStyle = a.color
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - head * Math.cos(ang - 0.42), y2 - head * Math.sin(ang - 0.42))
        ctx.lineTo(x2 - head * Math.cos(ang + 0.42), y2 - head * Math.sin(ang + 0.42))
        ctx.closePath()
        ctx.fill()
      }
    } else if (a.kind === 'text') {
      ctx.fillStyle = a.color
      ctx.font = `${Math.max(8, a.size)}px "Segoe UI", sans-serif`
      ctx.textBaseline = 'top'
      const lines = a.text.split('\n')
      lines.forEach((ln, i) => ctx.fillText(ln, a.x * W, a.y * H + i * a.size * 1.25))
    } else if (a.kind === 'redact') {
      const x = Math.round(a.x * W)
      const y = Math.round(a.y * H)
      const w = Math.max(1, Math.round(a.w * W))
      const h = Math.max(1, Math.round(a.h * H))
      if (a.mode === 'blur') {
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.clip()
        ctx.filter = 'blur(14px)'
        ctx.drawImage(ctx.canvas, x, y, w, h, x, y, w, h)
        ctx.restore()
      } else {
        const tiny = document.createElement('canvas')
        tiny.width = Math.max(1, Math.round(w / 12))
        tiny.height = Math.max(1, Math.round(h / 12))
        const tctx = tiny.getContext('2d')
        if (tctx) {
          tctx.imageSmoothingEnabled = true
          tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, tiny.width, tiny.height)
          ctx.save()
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h)
          ctx.restore()
        }
      }
    }
    ctx.restore()
  }
}
