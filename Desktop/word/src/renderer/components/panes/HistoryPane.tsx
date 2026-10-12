import { X, History, Camera } from 'lucide-react'
import type { Snapshot } from '../../types'

interface HistoryPaneProps {
  snapshots: Snapshot[]
  onRestore: (s: Snapshot) => void
  onSnapshot: () => void
  onClose: () => void
}

export default function HistoryPane({ snapshots, onRestore, onSnapshot, onClose }: HistoryPaneProps) {
  return (
    <aside aria-label="Version history pane" className="flex w-64 flex-col border-l border-neutral-300 bg-white dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          <History size={14} /> Versions
        </span>
        <button onClick={onClose} title="Close version history" aria-label="Close version history" className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
          <X size={14} />
        </button>
      </div>
      <div className="p-2">
        <button onClick={onSnapshot} className="flex w-full items-center justify-center gap-1.5 rounded bg-[#2B579A] py-1.5 text-[12px] text-white hover:bg-[#1F3F70]">
          <Camera size={13} /> Snapshot now
        </button>
        <p className="mt-1 px-1 text-[11px] text-neutral-500">Auto-snapshot every 5 minutes. Last 12 kept.</p>
      </div>
      <div className="word-scroll flex-1 space-y-1.5 overflow-auto p-2">
        {snapshots.length === 0 && <p className="px-1 py-2 text-[12px] text-neutral-500">No snapshots yet.</p>}
        {[...snapshots].reverse().map((s) => (
          <div key={s.id} className="rounded border border-neutral-200 p-2 dark:border-neutral-700">
            <div className="text-[12px] font-medium">{s.label}</div>
            <div className="text-[11px] text-neutral-500">{new Date(s.at).toLocaleString()}</div>
            <button onClick={() => onRestore(s)} title={`Restore version from ${new Date(s.at).toLocaleString()}`} className="mt-1 w-full rounded border border-[#2B579A] py-1 text-[12px] text-[#2B579A] hover:bg-[#D6E4F7] dark:text-sky-300">
              Restore this version
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
