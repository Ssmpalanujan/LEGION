/** Mail merge-lite: {{placeholders}} filled from a CSV file. Pure functions (unit-tested). */

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = []
  let cur = ''
  let row: string[] = []
  let inQuotes = false
  const push = () => {
    row.push(cur)
    cur = ''
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      push()
    } else if (ch === '\n') {
      push()
      rows.push(row)
      row = []
    } else if (ch === '\r') {
      // ignore, handled by \n
    } else {
      cur += ch
    }
  }
  push()
  rows.push(row)
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }
  const headers = nonEmpty[0].map((h) => h.trim())
  const data = nonEmpty.slice(1).map((r) => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => {
      o[h] = (r[i] ?? '').trim()
    })
    return o
  })
  return { headers, rows: data }
}

export function findPlaceholders(htmlOrText: string): string[] {
  const set = new Set<string>()
  const re = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(htmlOrText)) !== null) set.add(m[1])
  return [...set]
}

/** Replace {{key}} (case-insensitive, whitespace-tolerant) with values. Returns {result, replaced}. */
export function fillPlaceholders(html: string, values: Record<string, string>): { result: string; replaced: number } {
  let replaced = 0
  const lower: Record<string, string> = {}
  Object.entries(values).forEach(([k, v]) => {
    lower[k.trim().toLowerCase()] = v
  })
  const result = html.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (full, key: string) => {
    const v = lower[String(key).toLowerCase()]
    if (v === undefined) return full
    replaced++
    return escapeHtml(v)
  })
  return { result, replaced }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
