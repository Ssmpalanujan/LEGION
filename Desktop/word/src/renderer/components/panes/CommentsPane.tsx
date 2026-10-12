import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import { X, MessageSquarePlus, Reply, CheckCheck, Trash2 } from 'lucide-react'
import type { DocComment } from '../../types'

interface CommentsPaneProps {
  editor: Editor | null
  comments: DocComment[]
  onChange: (c: DocComment[]) => void
  onClose: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findMarkRange(editor: any, id: string): { from: number; to: number } | null {
  let from = -1
  let to = -1
  editor.state.doc.descendants((node: { isText: boolean; marks: { type: { name: string }; attrs: { id: string } }[] }, pos: number) => {
    if (!node.isText) return
    if (node.marks.some((m) => m.type.name === 'comment' && m.attrs.id === id)) {
      if (from === -1) from = pos
      to = pos + (node as unknown as { text: string }).text.length
    }
  })
  return from === -1 ? null : { from, to }
}

export default function CommentsPane({ editor, comments, onChange, onClose }: CommentsPaneProps) {
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const addComment = () => {
    if (!editor || !draft.trim()) return
    const { from, to } = editor.state.selection
    const quote = editor.state.doc.textBetween(from, to, ' ').slice(0, 120)
    if (from === to) {
      alert('Select some text first, then add a comment.')
      return
    }
    const id = `c-${Date.now().toString(36)}`
    editor.chain().focus().setMark('comment', { id }).run()
    const c: DocComment = { id, quote: quote || '(selection)', body: draft.trim(), replies: [], resolved: false, at: Date.now() }
    onChange([...comments, c])
    setDraft('')
  }

  const jump = (id: string) => {
    if (!editor) return
    const r = findMarkRange(editor, id)
    if (r) {
      editor.chain().focus().setTextSelection(r).run()
      requestAnimationFrame(() => document.querySelector('.comment-range')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    }
  }

  const removeMark = (id: string) => {
    if (!editor) return
    const r = findMarkRange(editor, id)
    if (r) {
      const { tr } = editor.state
      tr.removeMark(r.from, r.to, editor.schema.marks.comment)
      editor.view.dispatch(tr)
    }
  }

  const visible = comments.filter((c) => (showResolved ? true : !c.resolved))

  return (
    <aside aria-label="Comments pane" className="flex w-72 flex-col border-l border-neutral-300 bg-white dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <span className="text-[13px] font-semibold">Comments ({comments.filter((c) => !c.resolved).length})</span>
        <button onClick={onClose} title="Close comments" aria-label="Close comments" className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
          <X size={14} />
        </button>
      </div>
      <div className="border-b border-neutral-200 p-2 dark:border-neutral-700">
        <textarea
          aria-label="New comment"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Select text, write a comment…"
          rows={2}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800"
        />
        <button onClick={addComment} className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded bg-[#2B579A] py-1 text-[12px] text-white hover:bg-[#1F3F70]">
          <MessageSquarePlus size={13} /> Add comment
        </button>
      </div>
      <label className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-neutral-600 dark:text-neutral-300">
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved
      </label>
      <div className="word-scroll flex-1 space-y-2 overflow-auto p-2">
        {visible.length === 0 && <p className="px-1 py-2 text-[12px] text-neutral-500">No comments yet.</p>}
        {visible.map((c) => (
          <div key={c.id} className={`rounded border p-2 ${c.resolved ? 'border-neutral-200 opacity-60 dark:border-neutral-700' : 'border-[#2B579A]/40'}`}>
            <button onClick={() => jump(c.id)} title="Jump to commented text" className="mb-1 block w-full truncate text-left text-[11px] italic text-neutral-500">
              “{c.quote}”
            </button>
            <p className="text-[12px]">{c.body}</p>
            {c.replies.map((r, i) => (
              <p key={i} className="ml-2 mt-1 border-l-2 border-neutral-300 pl-2 text-[12px] text-neutral-600 dark:border-neutral-600 dark:text-neutral-300">
                {r.body}
              </p>
            ))}
            {replyTo === c.id ? (
              <div className="mt-1.5 flex gap-1">
                <input aria-label="Reply text" autoFocus value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && replyText.trim() && (onChange(comments.map((x) => (x.id === c.id ? { ...x, replies: [...x.replies, { body: replyText.trim(), at: Date.now() }] } : x))), setReplyTo(null), setReplyText(''))} placeholder="Reply…" className="flex-1 rounded border border-neutral-300 px-1.5 py-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800" />
                <button onClick={() => (setReplyTo(null), setReplyText(''))} className="text-[12px] text-neutral-500">Cancel</button>
              </div>
            ) : (
              <div className="mt-1.5 flex gap-1">
                <button onClick={() => setReplyTo(c.id)} title="Reply" aria-label="Reply to comment" className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
                  <Reply size={13} />
                </button>
                <button onClick={() => onChange(comments.map((x) => (x.id === c.id ? { ...x, resolved: !x.resolved } : x)))} title={c.resolved ? 'Reopen' : 'Resolve'} aria-label={c.resolved ? 'Reopen comment' : 'Resolve comment'} className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
                  <CheckCheck size={13} />
                </button>
                <button
                  onClick={() => {
                    removeMark(c.id)
                    onChange(comments.filter((x) => x.id !== c.id))
                  }}
                  title="Delete comment"
                  aria-label="Delete comment"
                  className="rounded p-1 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
