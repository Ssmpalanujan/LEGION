import { useMemo, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { X, Link2, Unlink } from 'lucide-react'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-[420px] max-w-[90vw] rounded-lg bg-white p-4 shadow-2xl dark:bg-[#2d2d2d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[14px] font-semibold">{title}</span>
          <button onClick={onClose} className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700" title="Close">
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function WordCountDialog({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  const stats = useMemo(() => {
    if (!editor) return { words: 0, chars: 0, charsNoSpaces: 0, paras: 0 }
    const text = editor.getText()
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
    let paras = 0
    editor.state.doc.descendants((n) => {
      if (n.type.name === 'paragraph' || n.type.name.startsWith('heading')) paras++
    })
    return { words, chars: text.length, charsNoSpaces: text.replace(/\s/g, '').length, paras }
  }, [editor])
  const row = (k: string, v: number) => (
    <div className="flex justify-between border-b border-neutral-100 py-1.5 text-[13px] dark:border-neutral-700">
      <span className="text-neutral-600 dark:text-neutral-300">{k}</span>
      <span className="font-semibold tabular-nums">{v}</span>
    </div>
  )
  return (
    <Modal title="Word Count" onClose={onClose}>
      {row('Words', stats.words)}
      {row('Characters (with spaces)', stats.chars)}
      {row('Characters (no spaces)', stats.charsNoSpaces)}
      {row('Paragraphs', stats.paras)}
      <button onClick={onClose} className="mt-3 w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
        Close
      </button>
    </Modal>
  )
}

export function LinkDialog({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  const [url, setUrl] = useState((editor?.getAttributes('link').href as string) ?? 'https://')
  const apply = () => {
    if (!editor) return
    if (!url) {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url }).run()
    }
    onClose()
  }
  const remove = () => {
    editor?.chain().focus().unsetLink().run()
    onClose()
  }
  return (
    <Modal title="Hyperlink" onClose={onClose}>
      <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300">Address</label>
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        placeholder="https://example.com"
        className="w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800"
      />
      <div className="mt-3 flex gap-2">
        <button onClick={apply} className="flex flex-1 items-center justify-center gap-1.5 rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
          <Link2 size={14} /> Apply
        </button>
        <button onClick={remove} className="flex items-center gap-1.5 rounded border border-neutral-300 px-3 py-1.5 text-[13px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">
          <Unlink size={14} /> Remove
        </button>
      </div>
    </Modal>
  )
}

const SPECIAL_CHARS = ['©', '®', '™', '€', '£', '¥', '§', '¶', '•', '–', '—', '‘', '’', '“', '”', '…', '←', '→', '↑', '↓', '°', '±', '×', '÷', '¼', '½', '¾', '≠', '≈', '∞', '✓', '★', '♥', '♦', '♣', '♠', 'α', 'β', 'π', 'Ω']

export function SpecialCharsDialog({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  return (
    <Modal title="Special Characters" onClose={onClose}>
      <div className="grid max-h-64 grid-cols-8 gap-1 overflow-auto">
        {SPECIAL_CHARS.map((c) => (
          <button
            key={c}
            title={`Insert ${c}`}
            onClick={() => {
              editor?.chain().focus().insertContent(c).run()
            }}
            className="rounded border border-neutral-200 py-1.5 text-[16px] hover:border-[#2B579A] hover:bg-[#D6E4F7] dark:border-neutral-700 dark:hover:bg-sky-900"
          >
            {c}
          </button>
        ))}
      </div>
      <button onClick={onClose} className="mt-3 w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
        Done
      </button>
    </Modal>
  )
}

export function TableGridPicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 2, c: 2 })
  return (
    <div className="p-2">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(10, 18px)', gap: 2 }}>
        {Array.from({ length: 100 }, (_, i) => {
          const r = Math.floor(i / 10)
          const c = i % 10
          const on = r <= hover.r && c <= hover.c
          return (
            <div
              key={i}
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => onPick(r + 1, c + 1)}
              className={`h-[18px] w-[18px] cursor-pointer rounded-[3px] border ${on ? 'border-[#2B579A] bg-[#D6E4F7]' : 'border-neutral-300 bg-white dark:bg-neutral-700'}`}
            />
          )
        })}
      </div>
      <div className="mt-1.5 text-center text-[12px] text-neutral-600 dark:text-neutral-300">
        {hover.r + 1} × {hover.c + 1} table
      </div>
    </div>
  )
}
