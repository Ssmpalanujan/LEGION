import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { X, ChevronUp, ChevronDown } from 'lucide-react'

interface FindReplaceProps {
  editor: Editor | null
  mode: 'find' | 'replace'
  onClose: () => void
}

export default function FindReplace({ editor, mode, onClose }: FindReplaceProps) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [count, setCount] = useState(0)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!editor) return
    const cmd = editor.commands as unknown as {
      setSearchQuery: (q: string, cs: boolean) => void
      clearSearch: () => void
    }
    if (!query) {
      cmd.clearSearch()
      setCount(0)
      return
    }
    cmd.setSearchQuery(query, caseSensitive)
    const st = (editor.storage as unknown as { searchHighlight: { ranges: unknown[]; current: number } }).searchHighlight
    setCount(st.ranges.length)
    setCurrent(st.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, caseSensitive, editor])

  const refresh = () => {
    if (!editor) return
    const st = (editor.storage as unknown as { searchHighlight: { ranges: unknown[]; current: number } }).searchHighlight
    setCount(st.ranges.length)
    setCurrent(st.current)
  }

  const jump = (dir: 1 | -1) => {
    if (!editor) return
    const cmds = editor.commands as unknown as { searchNext: () => void; searchPrev: () => void }
    if (dir === 1) cmds.searchNext()
    else cmds.searchPrev()
    // force decoration refresh + scroll to current match
    const st = (editor.storage as unknown as { searchHighlight: { ranges: { from: number; to: number }[]; current: number } }).searchHighlight
    const r = st.ranges[st.current]
    if (r) {
      editor.chain().focus().setTextSelection(r).run()
      requestAnimationFrame(() => {
        document.querySelector('.search-current')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    }
    refresh()
  }

  const doReplaceOne = () => {
    if (!editor || !replacement) return
    ;(editor.commands as unknown as { replaceCurrent: (s: string) => void }).replaceCurrent(replacement)
    refresh()
  }
  const doReplaceAll = () => {
    if (!editor) return
    ;(editor.commands as unknown as { replaceAllMatches: (s: string) => void }).replaceAllMatches(replacement)
    refresh()
  }

  return (
    <div className="absolute right-4 top-2 z-30 w-80 rounded-lg border border-neutral-300 bg-white p-3 shadow-xl dark:border-neutral-600 dark:bg-[#2d2d2d]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
          {mode === 'find' ? 'Find' : 'Find and Replace'}
        </span>
        <button onClick={onClose} className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700" title="Close (Esc)">
          <X size={14} />
        </button>
      </div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') jump(e.shiftKey ? -1 : 1)
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Search…"
        className="mb-1.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800"
      />
      {mode === 'replace' && (
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder="Replace with…"
          className="mb-1.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800"
        />
      )}
      <div className="mb-2 flex items-center justify-between text-[12px] text-neutral-600 dark:text-neutral-300">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
          Match case
        </label>
        <span>
          {count === 0 ? 'No matches' : `${current + 1} of ${count}`}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => jump(-1)} title="Previous match (Shift+Enter)" className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">
          <ChevronUp size={13} /> Prev
        </button>
        <button onClick={() => jump(1)} title="Next match (Enter)" className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">
          <ChevronDown size={13} /> Next
        </button>
        {mode === 'replace' && (
          <>
            <button onClick={doReplaceOne} title="Replace current match" className="rounded bg-[#2B579A] px-2 py-1 text-[12px] text-white hover:bg-[#1F3F70]">
              Replace
            </button>
            <button onClick={doReplaceAll} title="Replace all matches" className="rounded border border-[#2B579A] px-2 py-1 text-[12px] text-[#2B579A] dark:text-sky-300">
              All
            </button>
          </>
        )}
      </div>
    </div>
  )
}
