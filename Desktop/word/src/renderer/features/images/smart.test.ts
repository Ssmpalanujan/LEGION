import { describe, it, expect } from 'vitest'
import { buildAltTextBody, parseAltTextResponse, buildImageGenBody, parseImageGenResponse, normalizeBaseUrl } from './ai'
import { parseUnsplash, parsePexels, svgToDataUrl, EMOJI_SETS } from './stock'

describe('ai request builders', () => {
  it('normalizes endpoint URLs', () => {
    expect(normalizeBaseUrl('https://api.openai.com/v1///')).toBe('https://api.openai.com/v1')
  })
  it('builds alt-text chat bodies', () => {
    const b = buildAltTextBody('data:image/png;base64,AAA', 'gpt-4o-mini') as { model: string; messages: { content: unknown[] }[] }
    expect(b.model).toBe('gpt-4o-mini')
    expect(JSON.stringify(b.messages)).toContain('data:image/png;base64,AAA')
  })
  it('parses assistant text (string + parts)', () => {
    expect(parseAltTextResponse({ choices: [{ message: { content: ' A cat. ' } }] })).toBe('A cat.')
    expect(parseAltTextResponse({ choices: [{ message: { content: [{ text: 'Hi' }, { text: ' there' }] } }] })).toBe('Hi there')
    expect(parseAltTextResponse({})).toBe('')
  })
  it('builds image-gen bodies with clamped counts', () => {
    const b = buildImageGenBody('a cat', 'dall-e-3', 9, '1024x1024') as { n: number; response_format: string }
    expect(b.n).toBe(4)
    expect(b.response_format).toBe('b64_json')
  })
  it('parses image-gen responses (b64 + url)', () => {
    expect(parseImageGenResponse({ data: [{ b64_json: 'AAA' }, { url: 'https://x/y.png' }] })).toEqual([
      'data:image/png;base64,AAA',
      'https://x/y.png'
    ])
    expect(parseImageGenResponse({ nope: 1 })).toEqual([])
  })
})

describe('stock parsers', () => {
  it('normalizes Unsplash results', () => {
    const out = parseUnsplash({
      results: [{ id: 'a1', urls: { thumb: 't', full: 'f' }, alt_description: 'cat', user: { name: 'Ann' } }]
    })
    expect(out).toEqual([{ id: 'a1', thumb: 't', full: 'f', alt: 'cat', author: 'Ann' }])
    expect(parseUnsplash({})).toEqual([])
  })
  it('normalizes Pexels results', () => {
    const out = parsePexels({
      photos: [{ id: 7, src: { tiny: 't', large: 'l' }, alt: 'dog', photographer: 'Bob' }]
    })
    expect(out).toEqual([{ id: '7', thumb: 't', full: 'l', alt: 'dog', author: 'Bob' }])
    expect(parsePexels({})).toEqual([])
  })
})

describe('emoji + icons', () => {
  it('ships non-empty emoji sets', () => {
    expect(EMOJI_SETS.length).toBeGreaterThan(0)
    expect(EMOJI_SETS.every((s) => s.items.length > 0)).toBe(true)
  })
  it('encodes svg icons as data urls', () => {
    const u = svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    expect(u.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })
})
