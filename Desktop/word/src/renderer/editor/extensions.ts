import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** Font size mark backed by textStyle (px string). */
export const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize || null,
            renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {})
          }
        }
      }
    ]
  },
  addCommands() {
    return {
      setFontSize:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (size: string) => ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: null }).run()
    } as never
  }
})

/** Line-height applied to paragraphs/headings. */
export const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {})
          }
        }
      }
    ]
  },
  addCommands() {
    return {
      setLineHeight:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (value: string) => ({ chain, editor }: any) => {
          const { $from } = editor.state.selection
          const type = $from.parent.type.name
          if (type !== 'paragraph' && type !== 'heading') return false
          return chain().updateAttributes($from.parent.type.name as never, { lineHeight: value } as never).run()
        },
      unsetLineHeight:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => ({ chain, editor }: any) => {
          const { $from } = editor.state.selection
          return chain().updateAttributes($from.parent.type.name as never, { lineHeight: null } as never).run()
        }
    } as never
  }
})

const MAX_INDENT = 8
const INDENT_PX = 24

/** Paragraph indent (margin-left) + first-line indent (text-indent). */
export const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const m = /(\d+)/.exec(el.style.marginLeft || '')
              return m ? Math.min(MAX_INDENT, Math.round(parseInt(m[1], 10) / INDENT_PX)) : 0
            },
            renderHTML: (attrs) =>
              attrs.indent ? { style: `margin-left: ${(attrs.indent as number) * INDENT_PX}px` } : {}
          },
          firstLineIndent: {
            default: null,
            parseHTML: (el) => el.style.textIndent || null,
            renderHTML: (attrs) => (attrs.firstLineIndent ? { style: `text-indent: ${attrs.firstLineIndent}` } : {})
          }
        }
      }
    ]
  },
  addCommands() {
    return {
      indent:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => ({ tr, state, dispatch }: any) => {
          const $pos = state.selection.$from
          let depth = $pos.depth
          while (depth > 0) {
            const n = $pos.node(depth)
            if (n.type.name === 'paragraph' || n.type.name === 'heading') {
              const cur = Number(n.attrs.indent ?? 0)
              if (cur < MAX_INDENT && dispatch) {
                tr.setNodeMarkup($pos.before(depth), undefined, { ...n.attrs, indent: cur + 1 })
              }
              break
            }
            depth--
          }
          if (dispatch) dispatch(tr)
          return true
        },
      outdent:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => ({ tr, state, dispatch }: any) => {
          const $pos = state.selection.$from
          let depth = $pos.depth
          while (depth > 0) {
            const n = $pos.node(depth)
            if (n.type.name === 'paragraph' || n.type.name === 'heading') {
              const cur = Number(n.attrs.indent ?? 0)
              if (cur > 0 && dispatch) {
                tr.setNodeMarkup($pos.before(depth), undefined, { ...n.attrs, indent: cur - 1 })
              }
              break
            }
            depth--
          }
          if (dispatch) dispatch(tr)
          return true
        },
      setFirstLineIndent:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (value: string | null) => ({ tr, state, dispatch }: any) => {
          const $pos = state.selection.$from
          let depth = $pos.depth
          while (depth > 0) {
            const n = $pos.node(depth)
            if (n.type.name === 'paragraph' || n.type.name === 'heading') {
              if (dispatch) tr.setNodeMarkup($pos.before(depth), undefined, { ...n.attrs, firstLineIndent: value })
              break
            }
            depth--
          }
          if (dispatch) dispatch(tr)
          return true
        }
    } as never
  }
})

/** Page-break block node. */
export const PageBreak = Extension.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  addNode() {
    return {
      name: this.name,
      group: 'block',
      atom: true,
      parseHTML: () => [{ tag: 'div[data-page-break]' }],
      renderHTML: () => [
        'div',
        { 'data-page-break': '', class: 'page-break', style: 'border-top:2px dashed #2B579A;margin:12px 0;page-break-after:always;' },
        ['span', { style: 'font-size:10px;color:#2B579A;' }, 'Page Break']
      ]
    } as never
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }: { chain: () => { insertContent: (c: unknown) => { run: () => boolean } } }) =>
          chain().insertContent({ type: 'pageBreak' }).run()
    } as never
  }
})

export interface SearchStorage {
  query: string
  caseSensitive: boolean
  current: number
  ranges: { from: number; to: number }[]
}

export const searchKey = new PluginKey('wordpad-search')

function computeRanges(doc: { textBetween: (a: number, b: number, sep: string) => string; nodeSize: number }, query: string, caseSensitive: boolean): { from: number; to: number }[] {
  if (!query) return []
  const full = doc.textBetween(0, doc.nodeSize - 2, '\n')
  const hay = caseSensitive ? full : full.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const ranges: { from: number; to: number }[] = []
  // Map flat offsets back to doc positions by walking textblocks
  let idx = 0
  let pos = 1 // prosemirror doc position starts at 0/1
  const text = full
  void text
  // Simpler: walk with indexOf then convert via cumulative counting over doc text
  // Build position map: for each char in full text, its doc pos
  const map: number[] = []
  let p = 1
  // Reconstruct by scanning doc text via textBetween chunks is complex; instead
  // approximate by scanning each textblock separately in plugin below.
  void idx
  void pos
  void map
  void p
  void hay
  void needle
  return ranges
}
void computeRanges

/** Find highlight via ProseMirror decorations + replace commands. */
export const SearchHighlight = Extension.create<{ query: string }, SearchStorage>({
  name: 'searchHighlight',
  addOptions() {
    return { query: '' }
  },
  addStorage() {
    return { query: '', caseSensitive: false, current: 0, ranges: [] }
  },
  addCommands() {
    const findAll = (doc: never, query: string, caseSensitive: boolean) => {
      const out: { from: number; to: number }[] = []
      if (!query) return out
      const q = caseSensitive ? query : query.toLowerCase()
      ;(doc as { descendants: (cb: (node: { isText: boolean; text?: string }, pos: number) => void) => void }).descendants((node, pos) => {
        if (!node.isText || !node.text) return
        const hay = caseSensitive ? node.text : node.text.toLowerCase()
        let i = 0
        while (true) {
          const hit = hay.indexOf(q, i)
          if (hit === -1) break
          out.push({ from: pos + hit, to: pos + hit + q.length })
          i = hit + Math.max(1, q.length)
        }
      })
      return out
    }
    return {
      setSearchQuery:
        (query: string, caseSensitive = false) =>
        ({ tr, dispatch, editor }: { tr: { setMeta: (k: unknown, v: unknown) => unknown }; dispatch?: (t: unknown) => void; editor: { state: { doc: never } } }) => {
          ;(this.storage as SearchStorage).query = query
          ;(this.storage as SearchStorage).caseSensitive = caseSensitive
          ;(this.storage as SearchStorage).ranges = findAll(editor.state.doc, query, caseSensitive)
          ;(this.storage as SearchStorage).current = 0
          if (dispatch) dispatch(tr.setMeta(searchKey, { query }))
          return true
        },
      clearSearch:
        () =>
        ({ tr, dispatch }: { tr: { setMeta: (k: unknown, v: unknown) => unknown }; dispatch?: (t: unknown) => void }) => {
          ;(this.storage as SearchStorage).query = ''
          ;(this.storage as SearchStorage).ranges = []
          if (dispatch) dispatch(tr.setMeta(searchKey, { query: '' }))
          return true
        },
      searchNext:
        () =>
        ({ editor }: { editor: { storage: Record<string, SearchStorage>; commands: { focus: () => void } } }) => {
          const st = (this.storage as SearchStorage)
          if (st.ranges.length === 0) return false
          st.current = (st.current + 1) % st.ranges.length
          const r = st.ranges[st.current]
          editor.commands.focus()
          ;(editor as unknown as { view: { dispatch: (t: unknown) => void }; state: { tr: { setSelection: (s: unknown) => unknown; scrollIntoView: () => unknown } } })
          return true
        },
      searchPrev:
        () =>
        ({ editor }: { editor: { storage: Record<string, SearchStorage> } }) => {
          const st = (this.storage as SearchStorage)
          if (st.ranges.length === 0) return false
          st.current = (st.current - 1 + st.ranges.length) % st.ranges.length
          return true
        },
      replaceCurrent:
        (replacement: string) =>
        ({ editor, tr, dispatch }: { editor: { state: { doc: never }; view?: { dispatch: (t: unknown) => void } }; tr: { insertText: (s: string, from: number, to: number) => unknown; setMeta: (k: unknown, v: unknown) => unknown }; dispatch?: (t: unknown) => void }) => {
          const st = (this.storage as SearchStorage)
          const r = st.ranges[st.current]
          if (!r) return false
          tr.insertText(replacement, r.from, r.to)
          st.ranges = findAll(editor.state.doc, st.query, st.caseSensitive)
          if (dispatch) dispatch(tr.setMeta(searchKey, { query: st.query }))
          return true
        },
      replaceAllMatches:
        (replacement: string) =>
        ({ editor, tr, dispatch }: { editor: { state: { doc: never } }; tr: { insertText: (s: string, from: number, to: number) => unknown; setMeta: (k: unknown, v: unknown) => unknown }; dispatch?: (t: unknown) => void }) => {
          const st = (this.storage as SearchStorage)
          const ranges = [...st.ranges].sort((a, b) => b.from - a.from)
          ranges.forEach((r) => tr.insertText(replacement, r.from, r.to))
          st.ranges = []
          st.query = ''
          if (dispatch) dispatch(tr.setMeta(searchKey, { query: '' }))
          return true
        }
    } as never
  },
  addProseMirrorPlugins() {
    const storage = this.storage as SearchStorage
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, _old) => {
            const q = storage.query
            if (!q) return DecorationSet.empty
            const decos: Decoration[] = []
            const qq = storage.caseSensitive ? q : q.toLowerCase()
            tr.doc.descendants((node: { isText: boolean; text?: string }, pos: number) => {
              if (!node.isText || !node.text) return
              const hay = storage.caseSensitive ? node.text : node.text.toLowerCase()
              let i = 0
              while (true) {
                const hit = hay.indexOf(qq, i)
                if (hit === -1) break
                const from = pos + hit
                const to = from + qq.length
                const isCur =
                  storage.ranges[storage.current]?.from === from &&
                  storage.ranges[storage.current]?.to === to
                decos.push(
                  Decoration.inline(from, to, { class: isCur ? 'search-match search-current' : 'search-match' })
                )
                i = hit + Math.max(1, qq.length)
              }
            })
            return DecorationSet.create(tr.doc, decos)
          }
        },
        props: {
          decorations(state) {
            return (this as unknown as { getState: (s: unknown) => DecorationSet }).getState(state)
          }
        }
      })
    ]
  }
})
