import { useState } from 'react'
import { Modal } from './Dialogs'

export function PasswordModal({ title, confirm, onSubmit, onClose }: { title: string; confirm?: boolean; onSubmit: (pw: string) => void; onClose: () => void }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [err, setErr] = useState('')
  const go = () => {
    if (!a) {
      setErr('Enter a password.')
      return
    }
    if (confirm && a !== b) {
      setErr('Passwords do not match.')
      return
    }
    onSubmit(a)
  }
  const input = 'w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800'
  return (
    <Modal title={title} onClose={onClose}>
      <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300">Password</label>
      <input aria-label="Password" type="password" autoFocus value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} className={input} />
      {confirm && (
        <>
          <label className="mb-1 mt-2 block text-[12px] text-neutral-600 dark:text-neutral-300">Confirm password</label>
          <input aria-label="Confirm password" type="password" value={b} onChange={(e) => setB(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} className={input} />
        </>
      )}
      {err && <p role="alert" className="mt-1.5 text-[12px] text-red-600">{err}</p>}
      <button onClick={go} className="mt-3 w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
        {confirm ? 'Encrypt and save' : 'Unlock'}
      </button>
    </Modal>
  )
}

export function FootnoteDialog({ kind, onSubmit, onClose }: { kind: 'footnote' | 'endnote'; onSubmit: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('')
  return (
    <Modal title={kind === 'footnote' ? 'Insert footnote' : 'Insert endnote'} onClose={onClose}>
      <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300">Note text</label>
      <textarea
        aria-label="Note text"
        autoFocus
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800"
      />
      <button onClick={() => note.trim() && onSubmit(note.trim())} className="mt-3 w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
        Insert
      </button>
    </Modal>
  )
}
