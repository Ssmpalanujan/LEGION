import { FileText, Save, Undo2, Redo2, Minus, Square, X, Sun, Moon } from 'lucide-react'

interface TitleBarProps {
  docName: string
  dirty: boolean
  isMac: boolean
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
}

function QaButton({ tip, children, onClick }: { tip: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      data-tip={tip}
      onClick={onClick}
      className="ribbon-tip no-drag rounded p-1.5 text-white/90 hover:bg-white/15 hover:text-white"
    >
      {children}
    </button>
  )
}

export default function TitleBar({ docName, dirty, isMac, theme, onToggleTheme, onSave, onUndo, onRedo }: TitleBarProps) {
  const mod = isMac ? '⌘' : 'Ctrl'
  const api = typeof window !== 'undefined' ? (window.electron as { minimize: () => void; maximize: () => void; close: () => void } | undefined) : undefined

  return (
    <header className="drag flex h-10 select-none items-center bg-[#2B579A] text-white" style={{ paddingLeft: isMac ? 76 : 8 }}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-white/15">
          <FileText size={15} strokeWidth={2.2} />
        </span>
        <span className="truncate text-[13px] font-medium">
          {docName}
          {dirty ? ' •' : ''} - WordPad Pro
        </span>
      </div>

      <div className="ml-4 flex items-center gap-0.5">
        <QaButton tip={`Save (${mod}+S)`} onClick={onSave}>
          <Save size={15} />
        </QaButton>
        <QaButton tip={`Undo (${mod}+Z)`} onClick={onUndo}>
          <Undo2 size={15} />
        </QaButton>
        <QaButton tip={`Redo (${isMac ? '⇧⌘+Z' : 'Ctrl+Y'})`} onClick={onRedo}>
          <Redo2 size={15} />
        </QaButton>
        <button
          data-tip="Toggle light / dark theme"
          onClick={onToggleTheme}
          className="ribbon-tip no-drag rounded p-1.5 text-white/90 hover:bg-white/15 hover:text-white"
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>

      <div className="flex-1" />

      {!isMac && (
        <div className="no-drag flex h-full items-stretch">
          <button data-tip="Minimize" onClick={() => api?.minimize()} className="ribbon-tip flex w-12 items-center justify-center hover:bg-white/15">
            <Minus size={15} />
          </button>
          <button data-tip="Maximize / Restore" onClick={() => api?.maximize()} className="ribbon-tip flex w-12 items-center justify-center hover:bg-white/15">
            <Square size={12} />
          </button>
          <button data-tip="Close" onClick={() => api?.close()} className="ribbon-tip flex w-12 items-center justify-center hover:bg-[#E81123]">
            <X size={16} />
          </button>
        </div>
      )}
    </header>
  )
}
