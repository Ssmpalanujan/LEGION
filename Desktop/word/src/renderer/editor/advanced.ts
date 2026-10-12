import { Mark, Node, Extension } from '@tiptap/core'

/* ---------------- Comments ---------------- */

export const CommentMark = Mark.create({
  name: 'comment',
  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute('data-comment-id'), renderHTML: (attrs) => ({ 'data-comment-id': attrs.id, class: 'comment-range' }) }
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  }
})

/* ---------------- Track changes ---------------- */

export const InsertionMark = Mark.create({
  name: 'insertion',
  addAttributes() {
    return {
      author: { default: 'You' },
      date: { default: null }
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-insertion]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, 'data-insertion': '', class: 'track-ins' }, 0]
  }
})

export const DeletionMark = Mark.create({
  name: 'deletion',
  addAttributes() {
    return {
      author: { default: 'You' },
      date: { default: null }
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-deletion]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, 'data-deletion': '', class: 'track-del' }, 0]
  }
})

export interface DocChange {
  kind: 'ins' | 'del'
  from: number
  to: number
  text: string
  author: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scanChanges(editor: any): DocChange[] {
  const out: DocChange[] = []
  const doc = editor.state.doc
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return
    const ins = node.marks.find((m: { type: { name: string } }) => m.type.name === 'insertion')
    const del = node.marks.find((m: { type: { name: string } }) => m.type.name === 'deletion')
    const mark = ins ?? del
    if (!mark) return
    const last = out[out.length - 1]
    const kind = ins ? 'ins' : 'del'
    if (last && last.kind === kind && last.to === pos && last.author === (mark.attrs.author ?? 'You')) {
      last.to = pos + (node.text as string).length
      last.text += node.text as string
    } else {
      out.push({ kind, from: pos, to: pos + (node.text as string).length, text: node.text as string, author: mark.attrs.author ?? 'You' })
    }
  })
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyToRange(editor: any, ch: DocChange, mode: 'accept' | 'reject'): void {
  const { tr } = editor.state
  const markName = ch.kind === 'ins' ? 'insertion' : 'deletion'
  if (mode === 'accept') {
    if (ch.kind === 'ins') {
      tr.removeMark(ch.from, ch.to, editor.schema.marks[markName])
    } else {
      tr.delete(ch.from, ch.to)
    }
  } else {
    if (ch.kind === 'ins') {
      tr.delete(ch.from, ch.to)
    } else {
      tr.removeMark(ch.from, ch.to, editor.schema.marks[markName])
    }
  }
  editor.view.dispatch(tr)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function acceptChange(editor: any, ch: DocChange): void {
  applyToRange(editor, ch, 'accept')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rejectChange(editor: any, ch: DocChange): void {
  applyToRange(editor, ch, 'reject')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function acceptAllTracked(editor: any): void {
  const changes = scanChanges(editor).sort((a, b) => b.from - a.from)
  const { tr } = editor.state
  changes.forEach((ch) => {
    if (ch.kind === 'ins') tr.removeMark(ch.from, ch.to, editor.schema.marks.insertion)
    else tr.delete(ch.from, ch.to)
  })
  editor.view.dispatch(tr)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rejectAllTracked(editor: any): void {
  const changes = scanChanges(editor).sort((a, b) => b.from - a.from)
  const { tr } = editor.state
  changes.forEach((ch) => {
    if (ch.kind === 'ins') tr.delete(ch.from, ch.to)
    else tr.removeMark(ch.from, ch.to, editor.schema.marks.deletion)
  })
  editor.view.dispatch(tr)
}

/* ---------------- Footnotes / endnotes ---------------- */

export const FootnoteRef = Node.create({
  name: 'footnoteRef',
  inline: true,
  group: 'inline',
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      kind: { default: 'footnote' },
      note: { default: '' },
      n: { default: 1 }
    }
  },
  parseHTML() {
    return [{ tag: 'sup[data-footnote]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const kind = (HTMLAttributes.kind as string) ?? 'footnote'
    const n = (HTMLAttributes.n as number) ?? 1
    return [
      'sup',
      { 'data-footnote': kind, class: 'footnote-ref', title: String(HTMLAttributes.note ?? '') },
      `[${kind === 'endnote' ? 'e' : ''}${n}]`
    ]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertFootnote: (note: string, kind: 'footnote' | 'endnote') => ({ chain, editor }: any) => {
        let n = 1
        editor.state.doc.descendants((node: { type: { name: string } }) => {
          if (node.type.name === 'footnoteRef') n++
        })
        const id = `fn-${Date.now().toString(36)}-${n}`
        const ok = chain()
          .focus()
          .insertContent({ type: 'footnoteRef', attrs: { id, kind, note, n } })
          .run()
        if (ok) {
          const label = kind === 'endnote' ? 'Endnote' : 'Footnote'
          editor.chain().insertContent(`<p data-note-def="${id}"><sup>[${n}]</sup> <em>${label}:</em> ${note.replace(/</g, '&lt;')}</p>`).run()
        }
        return ok
      }
    } as never
  }
})

/* ---------------- Text box ---------------- */

export const TextBox = Node.create({
  name: 'textBox',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      border: { default: '#2B579A' },
      fill: { default: '#D6E4F7' }
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-textbox]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        'data-textbox': '',
        class: 'text-box',
        style: `border:2px solid ${(HTMLAttributes.border as string) ?? '#2B579A'};background:${(HTMLAttributes.fill as string) ?? '#D6E4F7'};border-radius:6px;padding:12px;margin:12px 0;`
      },
      0
    ]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertTextBox: (border = '#2B579A', fill = '#D6E4F7') => ({ chain }: any) =>
        chain().focus().insertContent({ type: 'textBox', attrs: { border, fill }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text box — click to edit' }] }] }).run()
    } as never
  }
})

/* ---------------- Shapes (SVG atoms) ---------------- */

export type ShapeKind = 'rectangle' | 'circle' | 'line' | 'arrow'

function shapeInner(kind: ShapeKind, color: string, w: number, h: number): string {
  if (kind === 'circle')
    return `<div style="width:${w}px;height:${h}px;border:3px solid ${color};border-radius:50%;"></div>`
  if (kind === 'line') return `<div style="width:${w}px;border-top:3px solid ${color};height:0;"></div>`
  if (kind === 'arrow')
    return `<div style="display:flex;align-items:center;"><div style="width:${w}px;border-top:3px solid ${color};height:0;"></div><div style="width:0;height:0;border-top:8px solid transparent;border-bottom:8px solid transparent;border-left:14px solid ${color};"></div></div>`
  return `<div style="width:${w}px;height:${h}px;border:3px solid ${color};"></div>`
}

export function shapeHtml(kind: ShapeKind, color: string, w: number, h: number): string {
  return `<div data-shape="${kind}" data-color="${color}" data-w="${w}" data-h="${h}" class="shape-node">${shapeInner(kind, color, w, h)}</div>`
}

export const ShapeNode = Node.create({
  name: 'shape',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      kind: { default: 'rectangle', parseHTML: (el) => el.getAttribute('data-shape') ?? 'rectangle' },
      color: { default: '#2B579A', parseHTML: (el) => el.getAttribute('data-color') ?? '#2B579A' },
      w: { default: 160, parseHTML: (el) => Number(el.getAttribute('data-w') ?? 160) },
      h: { default: 90, parseHTML: (el) => Number(el.getAttribute('data-h') ?? 90) }
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-shape]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const kind = (HTMLAttributes.kind as ShapeKind) ?? 'rectangle'
    const color = (HTMLAttributes.color as string) ?? '#2B579A'
    const w = Number(HTMLAttributes.w ?? 160)
    const h = Number(HTMLAttributes.h ?? 90)
    const box = { style: `width:${w}px;height:${h}px;border:3px solid ${color};` }
    let inner: unknown
    if (kind === 'circle') inner = ['div', { style: `${box.style}border-radius:50%;` }]
    else if (kind === 'line') inner = ['div', { style: `width:${w}px;border-top:3px solid ${color};height:0;` }]
    else if (kind === 'arrow')
      inner = [
        'div',
        { style: 'display:flex;align-items:center;' },
        ['div', { style: `width:${w}px;border-top:3px solid ${color};height:0;` }],
        ['div', { style: `width:0;height:0;border-top:8px solid transparent;border-bottom:8px solid transparent;border-left:14px solid ${color};` }]
      ]
    else inner = ['div', box]
    return ['div', { 'data-shape': kind, 'data-color': color, 'data-w': String(w), 'data-h': String(h), class: 'shape-node' }, inner]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertShape: (kind: ShapeKind, color: string, w: number, h: number) => ({ chain }: any) =>
        chain().focus().insertContent({ type: 'shape', attrs: { kind, color, w, h } }).run()
    } as never
  }
})

/* ---------------- Equation (KaTeX, rendered post-hoc) ---------------- */

export const EquationNode = Node.create({
  name: 'equation',
  inline: true,
  group: 'inline',
  atom: true,
  addAttributes() {
    return {
      latex: { default: '' },
      display: { default: false }
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-equation]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        'data-equation': '',
        'data-latex': (HTMLAttributes.latex as string) ?? '',
        'data-display': String((HTMLAttributes.display as boolean) ?? false),
        class: 'equation-node'
      },
      (HTMLAttributes.latex as string) ?? ''
    ]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertEquation: (latex: string, display = false) => ({ chain }: any) =>
        chain().focus().insertContent({ type: 'equation', attrs: { latex, display } }).run(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateEquation: (latex: string) => ({ chain, editor }: any) => {
        const { $from } = editor.state.selection
        const node = $from.nodeAfter ?? $from.parent
        void node
        return chain().updateAttributes('equation', { latex }).run()
      }
    } as never
  }
})

/* ---------------- Drop cap ---------------- */

export const DropCap = Extension.create({
  name: 'dropCap',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          dropCap: {
            default: false,
            parseHTML: (el) => el.hasAttribute('data-dropcap'),
            renderHTML: (attrs) => (attrs.dropCap ? { 'data-dropcap': '', class: 'dropcap' } : {})
          }
        }
      }
    ]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toggleDropCap: () => ({ chain, editor }: any) => {
        const cur = (editor.getAttributes('paragraph') as { dropCap?: boolean }).dropCap ?? false
        return chain().updateAttributes('paragraph', { dropCap: !cur }).run()
      }
    } as never
  }
})

/* ---------------- Table of contents node ---------------- */

export interface TocItem {
  level: number
  text: string
  pos: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function collectTocItems(editor: any): TocItem[] {
  const items: TocItem[] = []
  editor.state.doc.descendants((node: { type: { name: string }; textContent: string }, pos: number) => {
    if (node.type.name === 'heading') {
      const level = (node as unknown as { attrs: { level: number } }).attrs.level ?? 1
      const text = node.textContent.trim()
      if (text) items.push({ level, text, pos })
    }
  })
  return items
}

export const TocNode = Node.create({
  name: 'toc',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      items: { default: '[]', parseHTML: (el) => el.getAttribute('data-items') ?? '[]' }
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-toc]' }]
  },
  renderHTML({ HTMLAttributes }) {
    let items: TocItem[] = []
    try {
      items = JSON.parse((HTMLAttributes.items as string) ?? '[]') as TocItem[]
    } catch {
      items = []
    }
    const rows: unknown[] = [['p', {}, ['strong', {}, 'Table of Contents']]]
    if (items.length === 0) rows.push(['p', {}, 'No headings found.'])
    items.forEach((it) => {
      rows.push(['p', { style: `margin-left:${(it.level - 1) * 18}px;` }, String(it.text)])
    })
    return ['div', { 'data-toc': '1', 'data-items': (HTMLAttributes.items as string) ?? '[]', class: 'toc-block' }, ...rows]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertToc: () => ({ chain, editor }: any) => {
        const items = collectTocItems(editor)
        return chain().focus().insertContent({ type: 'toc', attrs: { items: JSON.stringify(items) } }).run()
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      refreshToc: () => ({ editor }: any) => {
        const items = collectTocItems(editor)
        const { tr } = editor.state
        let dirty = false
        editor.state.doc.descendants((node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => {
          if (node.type.name === 'toc') {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, items: JSON.stringify(items) })
            dirty = true
          }
        })
        if (dirty) {
          editor.view.dispatch(tr)
          return true
        }
        return false
      }
    } as never
  }
})
