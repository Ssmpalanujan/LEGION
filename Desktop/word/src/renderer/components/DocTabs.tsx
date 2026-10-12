import { X, Plus } from 'lucide-react'
import type { DocTab } from '../types'

interface DocTabsProps {
  tabs: DocTab[]
  activeId: number
  onSwitch: (id: number) => void
  onClose: (id: number) => void
  onNew: () => void
}

export default function DocTabs({ tabs, activeId, onSwitch, onClose, onNew }: DocTabsProps) {
  return (
    <div className="flex select-none items-end gap-1 overflow-x-auto border-b border-neutral-200 bg-[#E9E9E9] px-2 pt-1 dark:border-neutral-700 dark:bg-[#191919]">
      {tabs.map((t) => {
        const active = t.id === activeId
        return (
          <div
            key={t.id}
            onClick={() => onSwitch(t.id)}
            className={`group flex max-w-[200px] cursor-pointer items-center gap-1.5 rounded-t-md px-3 py-1.5 text-[12px] ${
              active
                ? 'bg-white font-medium text-neutral-900 dark:bg-[#2d2d2d] dark:text-neutral-100'
                : 'text-neutral-600 hover:bg-white/60 dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
            title={t.path ?? t.name}
          >
            <span className="truncate">
              {t.name}
              {t.dirty ? ' •' : ''}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose(t.id)
              }}
              className="rounded p-0.5 opacity-0 hover:bg-neutral-300 group-hover:opacity-100 dark:hover:bg-neutral-600"
              title="Close document"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
      <button
        onClick={onNew}
        title="New document (Ctrl+N)"
        className="mb-1 rounded p-1.5 text-neutral-500 hover:bg-white hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
