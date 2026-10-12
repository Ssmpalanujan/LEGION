import { describe, it, expect } from 'vitest'
import { cssFilterString, adjustPixels, sharpenPixels, type PixelBuffer } from './pipeline'
import { DEFAULT_FILTERS, parseEdits } from './editorTypes'

function buf(pixels: number[][]): PixelBuffer {
  const data = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach((p, i) => {
    data[i * 4] = p[0]
    data[i * 4 + 1] = p[1]
    data[i * 4 + 2] = p[2]
    data[i * 4 + 3] = p[3] ?? 255
  })
  const side = Math.sqrt(pixels.length)
  return { width: side, height: side, data }
}

describe('cssFilterString', () => {
  it('is none for defaults and composes set values', () => {
    expect(cssFilterString(DEFAULT_FILTERS)).toBe('none')
    const s = cssFilterString({ ...DEFAULT_FILTERS, brightness: 20, contrast: -10, saturation: 50, blur: 2, hue: 90 })
    expect(s).toContain('brightness(1.200)')
    expect(s).toContain('contrast(0.900)')
    expect(s).toContain('saturate(1.500)')
    expect(s).toContain('blur(2.0px)')
    expect(s).toContain('hue-rotate(90deg)')
  })
})

describe('adjustPixels', () => {
  it('leaves buffers untouched for neutral settings', () => {
    const b = buf([[10, 20, 30, 255]])
    adjustPixels(b, { exposure: 0, temperature: 0, tint: 0 })
    expect([...b.data]).toEqual([10, 20, 30, 255])
  })
  it('applies +1EV gain (doubles channels)', () => {
    const b = buf([[10, 20, 30, 255]])
    adjustPixels(b, { exposure: 1, temperature: 0, tint: 0 })
    expect([...b.data]).toEqual([20, 40, 60, 255])
  })
  it('shifts temperature warm (red up, blue down)', () => {
    const b = buf([[100, 100, 100, 255]])
    adjustPixels(b, { exposure: 0, temperature: 100, tint: 0 })
    expect(b.data[0]).toBeGreaterThan(100)
    expect(b.data[2]).toBeLessThan(100)
  })
  it('shifts tint toward green', () => {
    const b = buf([[100, 100, 100, 255]])
    adjustPixels(b, { exposure: 0, temperature: 0, tint: 100 })
    expect(b.data[1]).toBeGreaterThan(100)
  })
  it('clamps exposure to ±2EV', () => {
    const b = buf([[100, 100, 100, 255]])
    adjustPixels(b, { exposure: 99, temperature: 0, tint: 0 })
    expect(b.data[0]).toBe(255) // 100*4 clamped by Uint8ClampedArray
  })
})

describe('sharpenPixels', () => {
  it('returns the same buffer for amount 0', () => {
    const b = buf([[1, 2, 3, 255]])
    expect(sharpenPixels(b, 0)).toBe(b)
  })
  it('increases local contrast on an edge', () => {
    // 3x3: dark field with one bright center pixel
    const px: number[][] = Array.from({ length: 9 }, () => [50, 50, 50, 255])
    px[4] = [200, 200, 200, 255]
    const b: PixelBuffer = { width: 3, height: 3, data: new Uint8ClampedArray(px.flat()) }
    const out = sharpenPixels(b, 1)
    expect(out.data[4 * 4]).toBeGreaterThanOrEqual(200)
    // neighbor darkened by the laplacian pull
    expect(out.data[3 * 4]).toBeLessThanOrEqual(50)
  })
})

describe('parseEdits', () => {
  it('round-trips and sanitizes stored edits', () => {
    expect(parseEdits('')).toEqual({ version: 1, filters: DEFAULT_FILTERS, annotations: [] })
    expect(parseEdits('nope')).toEqual({ version: 1, filters: DEFAULT_FILTERS, annotations: [] })
    const e = parseEdits(JSON.stringify({ version: 1, filters: { brightness: 10 }, annotations: [{ kind: 'text' }] }))
    expect(e.filters.brightness).toBe(10)
    expect(e.annotations).toHaveLength(1)
  })
})
