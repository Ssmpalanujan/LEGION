import { BookOpen, Newspaper, Globe, Minus, Plus, ListChecks, Target } from 'lucide-react'
import type { ViewMode } from '../types'
import { readingTimeMinutes, goalProgress } from '../lib/doc-utils'

interface StatusBarProps {
  page: number
  wordCount: number
  zoom: number
  onZoomChange: (zoom: number) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onOpenWordCount: () => void
  wordGoal?: number
  onOpenSettings?: () => void
}

export default function StatusBar({ page, wordCount, zoom, onZoomChange, viewMode, onViewModeChange, onOpenWordCount, wordGoal = 0, onOpenSettings }: StatusBarProps) {
  const clamp = (v: number) => Math.min(500, Math.max(10, Math.round(v)))

  const viewBtn = (mode: ViewMode, tip: string, Icon: typeof BookOpen) => (
    <button
      key={mode}
      data-tip={tip}
      onClick={() => onViewModeChange(mode)}
      className={`ribbon-tip rounded p-1.5 ${
        viewMode === mode ? 'bg-[#D6E4F7] text-[#2B579A] dark:bg-sky-900 dark:text-sky-200'
          : 'text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700'
      }`}
    >
      <Icon size={15} />
    </button>
  )

  return (
    <footer className="flex h-8 select-none items-center gap-4 border-t border-neutral-300 bg-[#F3F3F3] px-3 text-[12px] text-neutral-600 dark:border-neutral-700 dark:bg-[#1e1e1e] dark:text-neutral-300">
      <span data-tip="Current page" className="ribbon-tip">
        Page {page} of 1
      </span>
      <button data-tip="Open word count dialog" onClick={onOpenWordCount} className="ribbon-tip flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white">
        <ListChecks size={13} /> {wordCount} words
      </button>
      <span data-tip={`Reading time at 200 words per minute: about ${readingTimeMinutes(wordCount)} minute(s)`} className="ribbon-tip hidden md:inline">
        ~{readingTimeMinutes(wordCount)} min read
      </span>
      {wordGoal > 0 && (
        <button
          data-tip={`Word goal: ${wordCount} of ${wordGoal} words (${goalProgress(wordCount, wordGoal)}%). Click to change goal in Settings.`}
          onClick={onOpenSettings}
          className="ribbon-tip hidden items-center gap-1.5 sm:flex"
          aria-label={`Word goal progress ${goalProgress(wordCount, wordGoal)} percent`}
        >
          <Target size={13} />
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-300 dark:bg-neutral-700">
            <span className="block h-full rounded-full bg-[#2B579A]" style={{ width: `${goalProgress(wordCount, wordGoal)}%` }} />
          </span>
          <span className="tabular-nums">{goalProgress(wordCount, wordGoal)}%</span>
        </button>
      )}
      <span data-tip="Proofing language" className="ribbon-tip hidden sm:inline">
        English (US)
      </span>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {viewBtn('read', 'Read Mode', BookOpen)}
        {viewBtn('print', 'Print Layout', Newspaper)}
        {viewBtn('web', 'Web Layout', Globe)}
      </div>

      <div className="flex items-center gap-2">
        <button data-tip="Zoom out" onClick={() => onZoomChange(clamp(zoom - 10))} className="ribbon-tip rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
          <Minus size={13} />
        </button>
        <input
          data-tip={`Zoom: ${zoom}% (10%–500%)`}
          aria-label="Zoom"
          type="range"
          min={10}
          max={500}
          value={zoom}
          onChange={(e) => onZoomChange(clamp(Number(e.target.value)))}
          className="zoom-range ribbon-tip w-28"
        />
        <button data-tip="Zoom in" onClick={() => onZoomChange(clamp(zoom + 10))} className="ribbon-tip rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
          <Plus size={13} />
        </button>
        <span className="w-11 text-right tabular-nums">{zoom}%</span>
      </div>
    </footer>
  )
}
