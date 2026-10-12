import { useState } from 'react'
import { Modal } from './Dialogs'
import type { Editor } from '@tiptap/core'
import { parseCsv, findPlaceholders, fillPlaceholders } from '../lib/merge'

export default function MergeDialog({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [rowIdx, setRowIdx] = useState(0)
  const [status, setStatus] = useState('')
  const [field, setField] = useState('name')

  const parsed = (() => {
    try {
      return parseCsv(csvText)
    } catch {
      return { headers: [], rows: [] }
    }
  })()
  const placeholders = editor ? findPlaceholders(editor.getHTML()) : []

  const pickFile = (f: File | undefined) => {
    if (!f) return
    setFileName(f.name)
    const r = new FileReader()
    r.onload = () => setCsvText(String(r.result ?? ''))
    r.readAsText(f)
  }

  const insertField = () => {
    const name = field.trim().replace(/\s+/g, '_') || 'field'
    editor?.chain().focus().insertContent(`{{${name}}}`).run()
  }

  const apply = () => {
    if (!editor) return
    if (parsed.rows.length === 0) {
      setStatus('Load a CSV file with at least one data row first.')
      return
    }
    const row = parsed.rows[Math.min(rowIdx, parsed.rows.length - 1)]
    const { result, replaced } = fillPlaceholders(editor.getHTML(), row)
    if (replaced === 0) {
      setStatus('No matching placeholders found. Insert fields like {{name}} first.')
      return
    }
    editor.commands.setContent(result)
    setStatus(`Filled ${replaced} placeholder${replaced === 1 ? '' : 's'} from row ${Math.min(rowIdx, parsed.rows.length - 1) + 1}.`)
  }

  return (
    <Modal title="Mail merge" onClose={onClose}>
      <div className="mb-2 flex gap-1.5">
        <input aria-label="Merge field name" value={field} onChange={(e) => setField(e.target.value)} placeholder="Field name" className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
        <button onClick={insertField} title="Insert {{field}} at cursor" className="rounded bg-[#2B579A] px-3 py-1.5 text-[13px] text-white">
          Insert field
        </button>
      </div>
      {placeholders.length > 0 && <p className="mb-2 text-[12px] text-neutral-500">In document: {placeholders.map((p) => `{{${p}}}`).join(', ')}</p>}
      <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300">
        CSV file {fileName && <span className="text-neutral-400">({fileName})</span>}
      </label>
      <input aria-label="CSV file" type="file" accept=".csv,text/csv" onChange={(e) => pickFile(e.target.files?.[0])} className="mb-2 w-full text-[12px]" />
      {parsed.headers.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[12px] text-neutral-500">Columns: {parsed.headers.join(', ')} · {parsed.rows.length} row(s)</p>
          <label className="flex items-center gap-2 text-[12px]">
            Use row
            <input aria-label="Row number" type="number" min={1} max={parsed.rows.length} value={Math.min(rowIdx + 1, Math.max(1, parsed.rows.length))} onChange={(e) => setRowIdx(Math.max(0, (Number(e.target.value) || 1) - 1))} className="w-16 rounded border border-neutral-300 px-1 py-0.5 dark:border-neutral-600 dark:bg-neutral-800" />
          </label>
          <pre className="mt-1 max-h-24 overflow-auto rounded bg-neutral-100 p-1.5 text-[11px] dark:bg-neutral-800">{JSON.stringify(parsed.rows[Math.min(rowIdx, parsed.rows.length - 1)], null, 1)}</pre>
        </div>
      )}
      {status && <p role="status" className="mb-2 text-[12px] text-neutral-600 dark:text-neutral-300">{status}</p>}
      <button onClick={apply} className="w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
        Fill document
      </button>
    </Modal>
  )
}
