import { describe, it, expect } from 'vitest'
import {
  fitWithin,
  resizeFromHandle,
  unitsToPx,
  pxToUnits,
  clampCropBox,
  cropPresetBox,
  cropToDocxPercent,
  snapPosition,
  parseDataUrl,
  base64ByteLength,
  displaySize,
  PX_PER_CM
} from './math'

describe('fitWithin', () => {
  it('downscales the long edge without upscaling', () => {
    expect(fitWithin(4000, 2000, 1920)).toEqual({ width: 1920, height: 960 })
    expect(fitWithin(1000, 2000, 1920)).toEqual({ width: 960, height: 1920 })
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 })
  })
  it('handles degenerate input', () => {
    expect(fitWithin(0, 100, 1920)).toEqual({ width: 0, height: 0 })
  })
})

describe('resizeFromHandle', () => {
  it('corner handle keeps aspect ratio, dominant axis wins (se drag out)', () => {
    const r = resizeFromHandle(400, 200, 100, 100, 'se', { lockAspect: true, shiftKey: false })
    expect(r).toEqual({ width: 600, height: 300 })
  })
  it('corner handle shrinks proportionally when dragging inward', () => {
    const r = resizeFromHandle(400, 200, -100, -20, 'nw', { lockAspect: true, shiftKey: false })
    // nw: dx flips sign; dominant axis is width (0.75 vs 0.9 → max 0.9? height scale=(200+ -20*-1)/200=1.1, width=(400+ -100*-1)/400=1.25 → 1.25)
    expect(r.width / r.height).toBeCloseTo(2, 5)
    expect(r.width).toBeGreaterThan(400)
  })
  it('shift unlocks corners to free resize', () => {
    const r = resizeFromHandle(400, 200, 100, 10, 'se', { lockAspect: true, shiftKey: true })
    expect(r).toEqual({ width: 500, height: 210 })
  })
  it('unlocked corners resize freely', () => {
    const r = resizeFromHandle(400, 200, -50, 30, 'sw', { lockAspect: false, shiftKey: false })
    expect(r).toEqual({ width: 450, height: 230 })
  })
  it('edge handles resize one axis only', () => {
    expect(resizeFromHandle(400, 200, 0, 60, 's', { lockAspect: true, shiftKey: false })).toEqual({ width: 400, height: 260 })
    expect(resizeFromHandle(400, 200, -40, 0, 'w', { lockAspect: true, shiftKey: false })).toEqual({ width: 440, height: 200 })
    expect(resizeFromHandle(400, 200, 0, 300, 'n', { lockAspect: true, shiftKey: false })).toEqual({ width: 400, height: 24 })
  })
  it('clamps to min and max', () => {
    expect(resizeFromHandle(400, 200, -10000, -10000, 'nw', { lockAspect: true, shiftKey: false }).width).toBeGreaterThanOrEqual(24)
    const r = resizeFromHandle(2900, 2900, 500, 500, 'se', { lockAspect: true, shiftKey: false })
    expect(r.width).toBeLessThanOrEqual(3000)
  })
})

describe('units', () => {
  it('converts px/cm/% both ways', () => {
    expect(unitsToPx(2.54, 'cm', 600)).toBeCloseTo(96, 6)
    expect(pxToUnits(96, 'cm', 600)).toBeCloseTo(2.54, 6)
    expect(unitsToPx(50, 'pct', 800)).toBe(400)
    expect(pxToUnits(200, 'pct', 800)).toBe(25)
    expect(unitsToPx(123, 'px', 800)).toBe(123)
    expect(PX_PER_CM).toBeCloseTo(37.795, 2)
  })
})

describe('crop math', () => {
  it('clamps boxes into the unit square', () => {
    expect(clampCropBox({ x: -0.5, y: 1.2, w: 2, h: 2 }, null)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    const b = clampCropBox({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, null)
    expect(b.x + b.w).toBeLessThanOrEqual(1)
    expect(b.y + b.h).toBeLessThanOrEqual(1)
  })
  it('enforces aspect by shrinking the freer axis', () => {
    const b = clampCropBox({ x: 0, y: 0, w: 1, h: 1 }, 1)
    expect(b.w / b.h).toBeCloseTo(1, 6)
    const wide = clampCropBox({ x: 0, y: 0, w: 1, h: 1 }, 16 / 9)
    expect(wide.w / wide.h).toBeCloseTo(16 / 9, 6)
  })
  it('builds centered preset boxes', () => {
    const square = cropPresetBox('1:1', 2)
    expect(square.w / square.h).toBeCloseTo(1, 6)
    expect(square.x).toBeCloseTo(0.25, 6)
    const wide = cropPresetBox('16:9', 0.5)
    expect(wide.w / wide.h).toBeCloseTo(16 / 9, 5)
    expect(cropPresetBox('free', 1.5)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
  it('converts crop to docx edge percentages', () => {
    expect(cropToDocxPercent({ x: 0.1, y: 0.2, w: 0.7, h: 0.6 })).toEqual({ left: 10, top: 20, right: 20, bottom: 20 })
  })
})

describe('snapPosition', () => {
  it('snaps near guides and reports them', () => {
    const s = snapPosition(0.495, 0.28, 0.02)
    expect(s.x).toBe(0.5)
    expect(s.guideX).toBe(0.5)
    expect(s.y).toBe(0.28)
    expect(s.guideY).toBeNull()
  })
  it('clamps to 0..1', () => {
    expect(snapPosition(-0.5, 1.4, 0.02)).toMatchObject({ x: 0, y: 1 })
  })
})

describe('data-url helpers', () => {
  it('parses mime + payload', () => {
    expect(parseDataUrl('data:image/png;base64,AAA=')).toEqual({ mime: 'image/png', base64: 'AAA=' })
    expect(parseDataUrl('not-a-url')).toBeNull()
  })
  it('estimates byte length with padding', () => {
    expect(base64ByteLength('AAA=')).toBe(2)
    expect(base64ByteLength('AAAA')).toBe(3)
  })
})

describe('displaySize', () => {
  it('swaps dimensions for 90/270° rotation', () => {
    expect(displaySize(400, 800, 400, 0)).toEqual({ width: 400, height: 200 })
    expect(displaySize(400, 800, 400, 90)).toEqual({ width: 200, height: 400 })
    expect(displaySize(null, 800, 400, 0)).toEqual({ width: 800, height: 400 })
  })
})
