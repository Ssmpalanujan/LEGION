import { describe, it, expect } from 'vitest'
import { utf8ToBase64, base64ToUtf8, extOf, htmlToDocxBlob, blobToBase64, downloadBase64 } from './files'

describe('base64 save/load roundtrip', () => {
  it('round-trips ASCII html', () => {
    const html = '<h1>Hello</h1><p>World & friends</p>'
    expect(base64ToUtf8(utf8ToBase64(html))).toBe(html)
  })

  it('round-trips unicode (emoji, CJK, accents)', () => {
    const html = '<p>Héllo wörld ✓ ★ ♥ 日本語 🎉 {{name}}</p>'
    expect(base64ToUtf8(utf8ToBase64(html))).toBe(html)
  })

  it('round-trips empty string', () => {
    expect(base64ToUtf8(utf8ToBase64(''))).toBe('')
  })

  it('round-trips a large document', () => {
    const html = `<p>${'lorem ipsum dolor sit amet '.repeat(5000)}</p>`
    expect(base64ToUtf8(utf8ToBase64(html))).toBe(html)
  })
})

describe('extOf', () => {
  it('extracts lowercase extension', () => {
    expect(extOf('C:/docs/Report.DOCX')).toBe('docx')
    expect(extOf('/tmp/notes.txt')).toBe('txt')
    expect(extOf('page.html')).toBe('html')
  })

  it('handles missing extension and dotfiles', () => {
    expect(extOf('README')).toBe('readme')
    expect(extOf('archive.tar.gz')).toBe('gz')
  })
})

describe('htmlToDocxBlob', () => {
  it('converts headings, lists and formatting to a docx blob', async () => {
    const blob = await htmlToDocxBlob('<h1>T</h1><p>Hi <strong>there</strong></p><ul><li>a</li></ul>')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles empty html without throwing', async () => {
    const blob = await htmlToDocxBlob('')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('blob survives base64 save/load roundtrip', async () => {
    const blob = await htmlToDocxBlob('<p>roundtrip</p>')
    const b64 = await blobToBase64(blob)
    expect(typeof b64).toBe('string')
    expect(b64.length).toBeGreaterThan(0)
    // base64 decodes back to bytes of same length
    const bin = atob(b64)
    expect(bin.length).toBe(blob.size)
  })
})

describe('downloadBase64', () => {
  it('triggers an anchor download without throwing', () => {
    const clicks: string[] = []
    const orig = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicks.push(this.download)
    }
    try {
      downloadBase64(utf8ToBase64('<p>x</p>'), 'text/html', 'doc.html')
      expect(clicks).toEqual(['doc.html'])
    } finally {
      HTMLAnchorElement.prototype.click = orig
    }
  })
})
