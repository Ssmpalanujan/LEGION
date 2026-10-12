import { useEffect, useState } from 'react'
import { X, Check, Undo2 } from 'lucide-react'
import { scanChanges, acceptChange, rejectChange, acceptAllTracked, rejectAllTracked, type DocChange } from '../../editor/advanced'
import type { Editor } from '@tiptap/core'

interface TrackPaneProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
  tracking: boolean
  onToggleTracking: () => void
  onClose: () => void
}

export default function TrackPane({ editor, tracking, onToggleTracking, onClose }: TrackPaneProps) {
  const [, setTick] = useState(0)
  const changes: DocChange[] = editor ? scanChanges(editor) : []

  useEffect(() => {
    if (!editor) return
    const bump = () => setTick((t) => t + 1)
    editor.on('transaction', bump)
    return () => {
      editor.off('transaction', bump)
    }
  }, [editor])

  const rerender = () => setTick((t) => t + 1)
  const wrap = (fn: () => void) => () => {
    fn()
    rerender()
  }

  const jump = (ch: DocChange) => {
    ;(editor as Editor | null)?.chain().focus().setTextSelection({ from: ch.from, to: ch.to } as never).run()
  }

  return (
    <aside aria-label="Track changes pane" className="flex w-72 flex-col border-l border-neutral-300 bg-white dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <span className="text-[13px] font-semibold">Track Changes</span>
        <button onClick={onClose} title="Close track changes" aria-label="Close track changes" className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-2 p-2">
        <button
          onClick={onToggleTracking}
          aria-pressed={tracking}
          title="Record insertions and deletions as you type"
          className={`w-full rounded py-1.5 text-[12px] font-medium ${tracking ? 'bg-red-600 text-white' : 'bg-[#2B579A] text-white hover:bg-[#1F3F70]'}`}
        >
          {tracking ? '● Tracking ON — click to stop' : 'Start tracking'}
        </button>
        <div className="flex gap-1.5">
          <button onClick={wrap(() => editor && acceptAllTracked(editor))} title="Accept all changes" className="flex flex-1 items-center justify-center gap-1 rounded border border-green-600 px-2 py-1 text-[12px] text-green-700 hover:bg-green-50 dark:text-green-300">
            <Check size={13} /> Accept all
          </button>
          <button onClick={wrap(() => editor && rejectAllTracked(editor))} title="Reject all changes" className="flex flex-1 items-center justify-center gap-1 rounded border border-red-500 px-2 py-1 text-[12px] text-red-600 hover:bg-red-50 dark:text-red-300">
            <Undo2 size={13} /> Reject all
          </button>
        </div>
      </div>
      <div className="word-scroll flex-1 space-y-1.5 overflow-auto p-2">
        <p className="px-1 text-[11px] text-neutral-500">{changes.length} change{changes.length === 1 ? '' : 's'}</p>
        {changes.map((ch, i) => (
          <div key={`${ch.from}-${ch.to}-${i}`} className={`rounded border p-1.5 ${ch.kind === 'ins' ? 'border-green-400' : 'border-red-400'}`}>
            <button onClick={() => jump(ch)} className="block w-full truncate text-left text-[12px]" title="Jump to change">
              <span className={`mr-1 rounded px-1 text-[10px] font-bold ${ch.kind === 'ins' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {ch.kind === 'ins' ? 'INS' : 'DEL'}
              </span>
              <span className={ch.kind === 'del' ? 'line-through' : ''}>{ch.text.slice(0, 80) || '(empty)'}</span>
            </button>
            <div className="mt-1 flex gap-1">
              <button onClick={wrap(() => editor && acceptChange(editor, ch))} className="flex-1 rounded bg-green-600 py-0.5 text-[11px] text-white">
                Accept
              </button>
              <button onClick={wrap(() => editor && rejectChange(editor, ch))} className="flex-1 rounded bg-neutral-200 py-0.5 text-[11px] dark:bg-neutral-700">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
