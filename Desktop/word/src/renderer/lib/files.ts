import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

export function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  // chunked: spreading a huge array into fromCharCode overflows the stack
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function base64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function extOf(path: string): string {
  return (path.split('.').pop() ?? '').toLowerCase()
}

/** Import .docx bytes -> HTML using mammoth (loaded lazily so export graph stays small). */
export async function docxToHtml(dataBase64: string): Promise<string> {
  const mod = await import('mammoth')
  const mammoth = (mod as unknown as { default: unknown }).default ?? mod
  const bin = atob(dataBase64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const result = await (mammoth as { convertToHtml: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }).convertToHtml({
    arrayBuffer: bytes.buffer as ArrayBuffer
  })
  const html = result.value || '<p></p>'
  // restore atlas image layout (crop/wrap/position/size) stored in alt text on export
  try {
    const { postProcessImportedHtml } = await import('../features/images/docxImages')
    return postProcessImportedHtml(html)
  } catch {
    return html
  }
}

/** Very small HTML -> docx converter: headings, paragraphs, bold/italic/underline, lists, tables skipped gracefully. */
export async function htmlToDocxBlob(html: string): Promise<Blob> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const children: Paragraph[] = []
  // images are baked asynchronously (crop rendering) after the sync walk
  const pendingFigures: { el: HTMLElement; index: number }[] = []
  const pendingImgs: { el: HTMLImageElement; index: number }[] = []

  const runFromNode = (node: Node, mods: { b?: boolean; i?: boolean; u?: boolean }): TextRun[] => {
    if (node.nodeType === 3) {
      const text = node.textContent ?? ''
      if (!text) return []
      return [
        new TextRun({ text, bold: mods.b, italics: mods.i, underline: mods.u ? {} : undefined })
      ]
    }
    if (node.nodeType !== 1) return []
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const next = {
      b: mods.b || tag === 'strong' || tag === 'b',
      i: mods.i || tag === 'em' || tag === 'i',
      u: mods.u || tag === 'u'
    }
    if (tag === 'br') return [new TextRun({ text: '\n' })]
    const out: TextRun[] = []
    el.childNodes.forEach((c) => out.push(...runFromNode(c, next)))
    return out
  }

  const alignOf = (el: HTMLElement) => {
    const a = (el.style.textAlign || el.getAttribute('align') || '').toLowerCase()
    if (a === 'center') return AlignmentType.CENTER
    if (a === 'right') return AlignmentType.RIGHT
    if (a === 'justify') return AlignmentType.JUSTIFIED
    return AlignmentType.LEFT
  }

  doc.body.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      const t = node.textContent?.trim()
      if (t) children.push(new Paragraph({ children: [new TextRun(t)] }))
      return
    }
    if (node.nodeType !== 1) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (tag === 'h1') children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: alignOf(el), children: runFromNode(el, {}) }))
    else if (tag === 'h2') children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: alignOf(el), children: runFromNode(el, {}) }))
    else if (tag === 'h3') children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, alignment: alignOf(el), children: runFromNode(el, {}) }))
    else if (tag === 'figure' && el.hasAttribute('data-atlas-image')) {
      // collected below (async crop baking) — placeholder keeps order
      children.push(new Paragraph({ children: [new TextRun('')] }))
      pendingFigures.push({ el, index: children.length - 1 })
    } else if (tag === 'img') {
      pendingImgs.push({ el: el as HTMLImageElement, index: children.length })
      children.push(new Paragraph({ children: [new TextRun('')] }))
    } else if (tag === 'ul' || tag === 'ol') {
      el.querySelectorAll(':scope > li').forEach((li) => {
        children.push(new Paragraph({ bullet: tag === 'ul' ? { level: 0 } : undefined, children: runFromNode(li, {}) }))
      })
    } else if (tag === 'hr') {
      children.push(new Paragraph({ children: [new TextRun('──────────')] }))
    } else {
      const runs = runFromNode(el, {})
      children.push(new Paragraph({ alignment: alignOf(el), children: runs.length ? runs : [new TextRun('')] }))
    }
  })

  if (children.length === 0 && pendingFigures.length === 0 && pendingImgs.length === 0) {
    children.push(new Paragraph(''))
  }
  // resolve images back-to-front so placeholder indexes stay valid
  try {
    const { figureToDocxParagraphs } = await import('../features/images/docxImages')
    const { ImageRun: DocxImageRun } = await import('docx')
    for (let i = pendingFigures.length - 1; i >= 0; i--) {
      const { el, index } = pendingFigures[i]
      try {
        const paras = await figureToDocxParagraphs(el)
        if (paras && paras.length) children.splice(index, 1, ...paras)
        else children.splice(index, 1)
      } catch {
        children.splice(index, 1)
      }
    }
    const { dataUrlBytes } = await import('../features/images/export')
    const { renderCroppedBytes } = await import('../features/images/export')
    for (let i = pendingImgs.length - 1; i >= 0; i--) {
      const { el, index } = pendingImgs[i]
      try {
        const src = el.getAttribute('src') ?? ''
        if (!src.startsWith('data:')) {
          children.splice(index, 1)
          continue
        }
        const { bytes, mime } = dataUrlBytes(src)
        const w = Number(el.getAttribute('width')) || 400
        if (mime === 'image/webp' || mime === 'image/svg+xml') {
          // Word cannot embed webp/svg — normalize to png
          const out = await renderCroppedBytes(src, null, 'rect', 'image/png')
          const run = new DocxImageRun({ data: out.bytes, type: 'png', transformation: { width: w, height: Math.round((w * out.height) / out.width) } })
          children.splice(index, 1, new Paragraph({ children: [run] }))
          continue
        }
        const type = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : mime === 'image/bmp' ? 'bmp' : null
        if (!type) {
          children.splice(index, 1)
          continue
        }
        const run = new DocxImageRun({ data: bytes, type, transformation: { width: w, height: Math.round(w * 0.75) } })
        children.splice(index, 1, new Paragraph({ children: [run] }))
      } catch {
        children.splice(index, 1)
      }
    }
  } catch {
    // image support unavailable — drop placeholders
    for (let i = pendingFigures.length - 1; i >= 0; i--) children.splice(pendingFigures[i].index, 1)
    for (let i = pendingImgs.length - 1; i >= 0; i--) children.splice(pendingImgs[i].index, 1)
  }
  if (children.length === 0) children.push(new Paragraph(''))
  const file = new Document({ sections: [{ children }] })
  return Packer.toBlob(file)
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result ?? '')
      resolve(s.includes(',') ? s.split(',')[1] : s)
    }
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

export function downloadBase64(dataBase64: string, mime: string, filename: string): void {
  const a = document.createElement('a')
  a.href = `data:${mime};base64,${dataBase64}`
  a.download = filename
  a.click()
}
