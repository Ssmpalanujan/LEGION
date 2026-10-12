import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { X, RefreshCw, ListTree } from 'lucide-react'
import { collectTocItems, type TocItem } from '../../editor/advanced'

function useHeadings(editor: Editor | null): TocItem[] {
  const [items, setItems] = useState<TocItem[]>(() => (editor ? collectTocItems(editor) : []))
  useEffect(() => {
    if (!editor) return
    const bump = () => setItems(collectTocItems(editor))
    bump()
    editor.on('transaction', bump)
    return () => {
      editor.off('transaction', bump)
    }
  }, [editor])
  return items
}

function jump(editor: Editor | null, pos: number): void {
  if (!editor) return
  editor.chain().focus().setTextSelection(pos).run()
  requestAnimationFrame(() => {
    try {
      const { node } = editor.view.domAtPos(pos)
      const el = node instanceof HTMLElement ? node : node.parentElement
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } catch {
      /* noop */
    }
  })
}

export function NavPane({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  const items = useHeadings(editor)
  return (
    <aside aria-label="Navigation pane" className="flex w-60 flex-col border-r border-neutral-300 bg-white dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          <ListTree size={14} /> Navigation
        </span>
        <button onClick={onClose} title="Close navigation pane" aria-label="Close navigation pane" className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
          <X size={14} />
        </button>
      </div>
      <nav aria-label="Document outline" className="word-scroll flex-1 overflow-auto p-1.5">
        {items.length === 0 && <p className="px-2 py-3 text-[12px] text-neutral-500">No headings yet. Apply Heading styles to build an outline.</p>}
        {items.map((h, i) => (
          <button
            key={`${h.pos}-${i}`}
            onClick={() => jump(editor, h.pos)}
            title={`Go to ${h.text}`}
            className="block w-full truncate rounded px-2 py-1 text-left text-[12px] hover:bg-[#D6E4F7] dark:hover:bg-sky-900"
            style={{ paddingLeft: `${8 + (h.level - 1) * 14}px`, fontWeight: h.level <= 2 ? 600 : 400 }}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </aside>
  )
}

export function TocPane({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  const items = useHeadings(editor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cmds = editor?.commands as unknown as { insertToc?: () => void; refreshToc?: () => boolean } | undefined
  return (
    <aside aria-label="Table of contents pane" className="flex w-64 flex-col border-l border-neutral-300 bg-white dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <span className="text-[13px] font-semibold">Table of Contents</span>
        <button onClick={onClose} title="Close table of contents" aria-label="Close table of contents" className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-1.5 p-2">
        <button onClick={() => cmds?.insertToc?.()} title="Insert a TOC block at the cursor" className="flex-1 rounded bg-[#2B579A] py-1 text-[12px] text-white hover:bg-[#1F3F70]">
          Insert TOC
        </button>
        <button onClick={() => cmds?.refreshToc?.()} title="Refresh all TOC blocks from headings" className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <nav aria-label="Headings" className="word-scroll flex-1 overflow-auto p-1.5">
        {items.map((h, i) => (
          <button
            key={`${h.pos}-${i}`}
            onClick={() => jump(editor, h.pos)}
            className="block w-full truncate rounded px-2 py-1 text-left text-[12px] hover:bg-[#D6E4F7] dark:hover:bg-sky-900"
            style={{ paddingLeft: `${8 + (h.level - 1) * 14}px` }}
          >
            {h.text}
          </button>
        ))}
        {items.length === 0 && <p className="px-2 py-2 text-[12px] text-neutral-500">No headings found.</p>}
      </nav>
    </aside>
  )
}
