import { describe, it, expect } from 'vitest'
import { parseCsv, findPlaceholders, fillPlaceholders } from './merge'
import { countWords, readingTimeMinutes, headingsFromHtml, goalProgress } from './doc-utils'

describe('CSV parsing', () => {
  it('parses headers and rows', () => {
    const { headers, rows } = parseCsv('name,company\nAlice,Acme\nBob,Globex')
    expect(headers).toEqual(['name', 'company'])
    expect(rows).toEqual([
      { name: 'Alice', company: 'Acme' },
      { name: 'Bob', company: 'Globex' }
    ])
  })

  it('handles quoted commas and escaped quotes', () => {
    const { rows } = parseCsv('name,note\n"Doe, John","said ""hi"""')
    expect(rows[0]).toEqual({ name: 'Doe, John', note: 'said "hi"' })
  })

  it('returns empty for blank input', () => {
    expect(parseCsv('  \n ')).toEqual({ headers: [], rows: [] })
  })
})

describe('mail merge placeholders', () => {
  it('finds unique placeholder names', () => {
    expect(findPlaceholders('<p>Hi {{name}}, welcome to {{ company }}! {{name}}</p>')).toEqual(['name', 'company'])
  })

  it('fills values case-insensitively and escapes HTML', () => {
    const { result, replaced } = fillPlaceholders('<p>Hi {{Name}} from {{company}} ({{missing}})</p>', {
      name: '<Alice & Co>',
      COMPANY: 'Acme'
    })
    expect(replaced).toBe(2)
    expect(result).toContain('&lt;Alice &amp; Co&gt;')
    expect(result).toContain('{{missing}}')
  })
})

describe('doc utils', () => {
  it('counts words and reading time', () => {
    expect(countWords('  hello   world\nnew line ')).toBe(4)
    expect(countWords('   ')).toBe(0)
    expect(readingTimeMinutes(0)).toBe(0)
    expect(readingTimeMinutes(200)).toBe(1)
    expect(readingTimeMinutes(450)).toBe(3)
  })

  it('extracts headings for nav/TOC', () => {
    const hs = headingsFromHtml('<h1>A</h1><p>x</p><h3>C</h3><h2><strong>B</strong></h2>')
    expect(hs).toEqual([
      { level: 1, text: 'A' },
      { level: 3, text: 'C' },
      { level: 2, text: 'B' }
    ])
  })

  it('computes goal progress capped at 100', () => {
    expect(goalProgress(250, 500)).toBe(50)
    expect(goalProgress(600, 500)).toBe(100)
    expect(goalProgress(10, 0)).toBe(0)
  })
})
