import { describe, it, expect } from 'vitest'
import { COLLAGE_LAYOUTS, collageLayout, PICTURE_STYLES } from './collage'
import { metaToAlt, splitAlt, attrsFromElement } from './imageNode'
import { DEFAULT_ATLAS_ATTRS } from './types'

describe('collage layouts', () => {
  it('resolves known layouts and falls back to the first', () => {
    expect(collageLayout('2x2')).toMatchObject({ columns: 2, slots: 4 })
    expect(collageLayout('3x1')).toMatchObject({ columns: 3, slots: 3 })
    expect(collageLayout('nope')).toEqual(COLLAGE_LAYOUTS[0])
  })
  it('covers 2x2, 3x1 and stacked variants', () => {
    const ids = COLLAGE_LAYOUTS.map((l) => l.id)
    expect(ids).toContain('2x2')
    expect(ids).toContain('3x1')
    expect(COLLAGE_LAYOUTS.every((l) => l.columns >= 1 && l.slots >= l.columns)).toBe(true)
  })
  it('ships a styles gallery with a neutral default', () => {
    expect(PICTURE_STYLES.length).toBeGreaterThanOrEqual(6)
    expect(PICTURE_STYLES[0].patch).toMatchObject({ border: null, shadow: false, reflection: false })
  })
})

describe('alt-text layout round-trip', () => {
  it('encodes non-default layout and decodes it back', () => {
    const attrs = {
      ...DEFAULT_ATLAS_ATTRS,
      src: 'data:image/png;base64,AAA',
      width: 420,
      rotation: 90 as const,
      wrap: 'square' as const,
      align: 'right' as const,
      crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.7 },
      alt: 'A cat'
    }
    const alt = metaToAlt(attrs)
    expect(alt.startsWith('{')).toBe(true)
    const { meta, text } = splitAlt(alt)
    expect(text).toBe('A cat')
    expect(meta).toMatchObject({ w: 420, rot: 90, wrap: 'square', al: 'right' })
    expect(meta?.crop).toMatchObject({ x: 0.1, y: 0.1, w: 0.8, h: 0.7 })
  })
  it('leaves plain alt text and defaults untouched', () => {
    expect(metaToAlt({ ...DEFAULT_ATLAS_ATTRS, alt: 'hello' })).toBe('hello')
    expect(splitAlt('just words')).toEqual({ meta: null, text: 'just words' })
    expect(splitAlt('')).toEqual({ meta: null, text: '' })
  })
  it('parses legacy img elements with meta alt', () => {
    const doc = new DOMParser().parseFromString(
      `<img src="data:image/png;base64,AAA" width="300" alt='{"atlas":1,"w":300,"rot":90} caption' />`,
      'text/html'
    )
    const img = doc.querySelector('img') as unknown as HTMLElement
    const a = attrsFromElement(img)
    expect(a.width).toBe(300)
    expect(a.rotation).toBe(90)
    expect(a.alt).toBe('caption')
  })
})
