import { useMemo, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Modal } from './Dialogs'
import type { Editor } from '@tiptap/core'

export default function EquationDialog({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  const initial = (() => {
    try {
      return (editor?.getAttributes('equation') as { latex?: string }).latex ?? ''
    } catch {
      return ''
    }
  })()
  const [latex, setLatex] = useState(initial || 'E = mc^2')
  const preview = useMemo(() => {
    try {
      return katex.renderToString(latex || '', { throwOnError: false })
    } catch {
      return '<span style="color:red">Invalid equation</span>'
    }
  }, [latex])

  const insert = () => {
    if (!editor || !latex.trim()) return
    const onEq = editor.isActive('equation')
    if (onEq) {
      ;(editor.commands as unknown as { updateEquation: (s: string) => void }).updateEquation(latex.trim())
    } else {
      ;(editor.commands as unknown as { insertEquation: (s: string) => void }).insertEquation(latex.trim())
    }
    onClose()
  }

  return (
    <Modal title="Equation (KaTeX)" onClose={onClose}>
      <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300">LaTeX</label>
      <input aria-label="LaTeX" autoFocus value={latex} onChange={(e) => setLatex(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && insert()} placeholder="E = mc^2" className="w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
      <div aria-label="Equation preview" className="mt-2 min-h-[48px] overflow-auto rounded border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-800" dangerouslySetInnerHTML={{ __html: preview }} />
      <div className="mt-2 flex flex-wrap gap-1">
        {['\\frac{a}{b}', '\\sqrt{x}', 'x^{2}', '\\sum_{i=1}^{n} x_i', '\\int_{0}^{\\infty} e^{-x} dx', '\\alpha + \\beta = \\gamma'].map((s) => (
          <button key={s} onClick={() => setLatex(s)} title={`Use ${s}`} className="rounded border border-neutral-300 px-1.5 py-0.5 font-mono text-[11px] hover:bg-neutral-100 dark:border-neutral-600">
            {s}
          </button>
        ))}
      </div>
      <button onClick={insert} className="mt-3 w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
        Insert equation
      </button>
    </Modal>
  )
}
