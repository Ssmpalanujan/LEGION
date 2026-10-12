import { describe, it, expect } from 'vitest'
import { buildExportPlan, mimeForFormat, extForFormat, dataUrlBytes } from './export'

describe('export plan', () => {
  it('maps formats to mime + extension', () => {
    expect(mimeForFormat('png')).toBe('image/png')
    expect(mimeForFormat('jpg')).toBe('image/jpeg')
    expect(mimeForFormat('webp')).toBe('image/webp')
    expect(extForFormat('jpg')).toBe('jpg')
  })
  it('applies crop to output dimensions', () => {
    const p = buildExportPlan(800, 400, { x: 0.25, y: 0, w: 0.5, h: 1 }, 'jpg', 0.85, 'photo')
    expect(p).toMatchObject({ outWidth: 400, outHeight: 400, mime: 'image/jpeg', quality: 0.85, fileName: 'photo.jpg' })
  })
  it('keeps full size without crop and drops quality for png', () => {
    const p = buildExportPlan(800, 400, null, 'png', 0.9, '')
    expect(p).toMatchObject({ outWidth: 800, outHeight: 400, quality: undefined, fileName: 'image.png' })
  })
  it('clamps quality into range', () => {
    expect(buildExportPlan(10, 10, null, 'webp', 5, 'a').quality).toBe(1)
    expect(buildExportPlan(10, 10, null, 'webp', -2, 'a').quality).toBe(0.1)
  })
})

describe('dataUrlBytes', () => {
  it('decodes embedded bytes + mime', () => {
    // 1x1 transparent PNG
    const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const { bytes, mime } = dataUrlBytes(tiny)
    expect(mime).toBe('image/png')
    expect(bytes.length).toBeGreaterThan(0)
    // PNG magic
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
  it('rejects malformed input', () => {
    expect(() => dataUrlBytes('nope')).toThrow()
  })
})
