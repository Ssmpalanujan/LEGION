import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import { X, Plus, Pencil } from 'lucide-react'
import { BUILTIN_STYLES, type StyleDef } from '../../types'

interface StylesPaneProps {
  editor: Editor | null
  styles: StyleDef[]
  onChange: (s: StyleDef[]) => void
  onClose: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyStyle(editor: any, st: StyleDef): void {
  if (!editor) return
  const c = editor.chain().focus()
  const b = st.builtin
  if (b === 'normal') c.setParagraph()
  else if (b === 'quote') c.toggleBlockquote()
  else if (b === 'code') c.toggleCodeBlock()
  else if (b && b.startsWith('h')) {
    const level = Number(b.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6
    c.setHeading({ level })
  } else if (b === 'title') c.setHeading({ level: 1 })
  else c.setParagraph()
  // font + color
  if (st.fontFamily && st.fontFamily !== 'Default') c.setFontFamily(st.fontFamily)
  else c.unsetFontFamily()
  if (st.fontSize) (c as unknown as { setFontSize: (s: string) => unknown }).setFontSize(`${st.fontSize}px`)
  if (st.color) c.setColor(st.color)
  else c.unsetColor()
  // bold / italic as absolute state
  const isB = editor.isActive('bold')
  if (st.bold && !isB) c.toggleBold()
  if (!st.bold && isB) c.toggleBold()
  const isI = editor.isActive('italic')
  if (st.italic && !isI) c.toggleItalic()
  if (!st.italic && isI) c.toggleItalic()
  c.setTextAlign(st.align)
  c.run()
}

const FONTS = ['Default', 'Calibri', 'Arial', 'Times New Roman', 'Georgia', 'Segoe UI', 'Courier New', 'Verdana']
const SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48']

function StyleForm({ value, onSave, onCancel }: { value: StyleDef; onSave: (s: StyleDef) => void; onCancel: () => void }) {
  const [s, setS] = useState<StyleDef>({ ...value })
  const set = (p: Partial<StyleDef>) => setS((prev) => ({ ...prev, ...p }))
  const input = 'w-full rounded border border-neutral-300 px-1.5 py-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800'
  return (
    <div className="space-y-2 rounded border border-neutral-200 p-2 dark:border-neutral-700">
      {!s.builtin && (
        <input aria-label="Style name" value={s.name} onChange={(e) => set({ name: e.target.value })} className={input} placeholder="Style name" />
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <select aria-label="Font family" value={s.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} className={input}>
          {FONTS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select aria-label="Font size" value={s.fontSize} onChange={(e) => set({ fontSize: e.target.value })} className={input}>
          {SIZES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <input aria-label="Color" type="color" value={s.color || '#000000'} onChange={(e) => set({ color: e.target.value })} className="h-7 w-10 cursor-pointer" />
        <button onClick={() => set({ color: '' })} className="rounded border border-neutral-300 px-2 py-1 text-[11px] dark:border-neutral-600" title="Automatic color">
          Auto
        </button>
        <label className="flex items-center gap-1 text-[12px]">
          <input type="checkbox" checked={s.bold} onChange={(e) => set({ bold: e.target.checked })} /> B
        </label>
        <label className="flex items-center gap-1 text-[12px]">
          <input type="checkbox" checked={s.italic} onChange={(e) => set({ italic: e.target.checked })} /> <em>I</em>
        </label>
      </div>
      <select aria-label="Alignment" value={s.align} onChange={(e) => set({ align: e.target.value as StyleDef['align'] })} className={input}>
        <option value="left">Align left</option>
        <option value="center">Center</option>
        <option value="right">Align right</option>
        <option value="justify">Justify</option>
      </select>
      <div className="flex gap-1.5">
        <button onClick={() => s.name.trim() && onSave(s)} className="flex-1 rounded bg-[#2B579A] py-1 text-[12px] text-white">
          Save
        </button>
        <button onClick={onCancel} className="rounded border border-neutral-300 px-3 py-1 text-[12px] dark:border-neutral-600">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function StylesPane({ editor, styles, onChange, onClose }: StylesPaneProps) {
  const [editing, setEditing] = useState<StyleDef | null>(null)
  const [creating, setCreating] = useState(false)
  const all = styles.length ? styles : BUILTIN_STYLES

  const saveEdit = (s: StyleDef) => {
    onChange(all.map((x) => (x.id === s.id ? s : x)))
    setEditing(null)
  }
  const create = (s: StyleDef) => {
    onChange([...all, { ...s, id: `custom-${Date.now().toString(36)}` }])
    setCreating(false)
  }

  return (
    <aside aria-label="Styles pane" className="flex w-64 flex-col border-l border-neutral-300 bg-white dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <span className="text-[13px] font-semibold">Styles</span>
        <div className="flex gap-1">
          <button onClick={() => setCreating(true)} title="Create new style" aria-label="Create new style" className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
            <Plus size={14} />
          </button>
          <button onClick={onClose} title="Close styles pane" aria-label="Close styles pane" className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="word-scroll flex-1 space-y-1 overflow-auto p-2">
        {creating && <StyleForm value={{ id: '', name: 'My Style', fontFamily: 'Default', fontSize: '11', color: '', bold: false, italic: false, align: 'left' }} onSave={create} onCancel={() => setCreating(false)} />}
        {all.map((st) => (
          <div key={st.id}>
            <div className="group flex items-center gap-1">
              <button
                onClick={() => applyStyle(editor, st)}
                title={`Apply ${st.name}`}
                className="flex-1 truncate rounded border border-neutral-200 px-2 py-1.5 text-left text-[12px] hover:border-[#2B579A] hover:bg-[#D6E4F7] dark:border-neutral-700 dark:hover:bg-sky-900"
                style={{ fontWeight: st.bold ? 700 : 400, fontStyle: st.italic ? 'italic' : 'normal', color: st.color || undefined, fontSize: `${Math.min(16, Number(st.fontSize) || 12)}px` }}
              >
                {st.name}
              </button>
              <button onClick={() => setEditing(st)} title={`Modify ${st.name}`} aria-label={`Modify ${st.name}`} className="rounded p-1 opacity-0 hover:bg-neutral-200 group-hover:opacity-100 dark:hover:bg-neutral-700">
                <Pencil size={12} />
              </button>
            </div>
            {editing?.id === st.id && <StyleForm value={editing} onSave={saveEdit} onCancel={() => setEditing(null)} />}
          </div>
        ))}
      </div>
    </aside>
  )
}
