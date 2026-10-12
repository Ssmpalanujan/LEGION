/** Pure document helpers: headings outline, reading time, counts. Unit-tested. */

export interface HeadingItem {
  level: number
  text: string
  pos: number
}

export function readingTimeMinutes(wordCount: number, wpm = 200): number {
  if (wordCount <= 0) return 0
  return Math.max(1, Math.ceil(wordCount / wpm))
}

export function countWords(text: string): number {
  const t = text.trim()
  return t === '' ? 0 : t.split(/\s+/).length
}

/** Extract headings from HTML (used by nav pane + TOC). Level plans 1..6. */
export function headingsFromHtml(html: string): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = []
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, '').trim()
    if (text) out.push({ level: Number(m[1]), text })
  }
  return out
}

export function goalProgress(words: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.round((words / goal) * 100))
}
