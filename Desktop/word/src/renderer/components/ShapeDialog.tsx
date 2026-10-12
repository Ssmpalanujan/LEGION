import { useState } from 'react'
import { Modal } from './Dialogs'
import type { Editor } from '@tiptap/core'
import type { ShapeKind } from '../editor/advanced'

const KINDS: ShapeKind[] = ['rectangle', 'circle', 'line', 'arrow']

export default function ShapeDialog({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  const [kind, setKind] = useState<ShapeKind>('rectangle')
  const [color, setColor] = useState('#2B579A')
  const [w, setW] = useState(160)
  const [h, setH] = useState(90)

  const insert = () => {
    ;(editor?.commands as unknown as { insertShape?: (k: ShapeKind, c: string, w: number, h: number) => void }).insertShape?.(kind, color, w, h)
    onClose()
  }

  return (
    <Modal title="Insert shape" onClose={onClose}>
      <div className="mb-2 flex gap-1.5" role="radiogroup" aria-label="Shape type">
        {KINDS.map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            title={k}
            className={`flex-1 rounded border px-2 py-1.5 text-[12px] capitalize ${kind === k ? 'border-[#2B579A] bg-[#D6E4F7] text-[#2B579A]' : 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-600'}`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[12px]">
        <label className="flex items-center gap-1.5">
          Color <input aria-label="Shape color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 cursor-pointer" />
        </label>
        <label className="flex items-center gap-1">
          W <input aria-label="Width" type="number" min={20} max={600} value={w} onChange={(e) => setW(Number(e.target.value) || 160)} className="w-16 rounded border border-neutral-300 px-1 py-0.5 dark:border-neutral-600 dark:bg-neutral-800" />
        </label>
        <label className="flex items-center gap-1">
          H <input aria-label="Height" type="number" min={8} max={400} value={h} onChange={(e) => setH(Number(e.target.value) || 90)} className="w-16 rounded border border-neutral-300 px-1 py-0.5 dark:border-neutral-600 dark:bg-neutral-800" />
        </label>
      </div>
      <button onClick={insert} className="mt-3 w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
        Insert shape
      </button>
    </Modal>
  )
}
