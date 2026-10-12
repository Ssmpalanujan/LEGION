import { useRef } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { pageDims, type PageSettings } from '../types'

interface RulerProps {
  editor: TiptapEditor | null
  page: PageSettings
  zoom: number
}

/** Horizontal ruler with draggable left-indent + first-line markers controlling the active paragraph. */
export default function Ruler({ editor, page, zoom }: RulerProps) {
  const { w, pad } = pageDims(page)
  const trackRef = useRef<HTMLDivElement>(null)

  const curIndent = (() => {
    try {
      const a = editor?.getAttributes('paragraph') ?? {}
      return Number((a as { indent?: number }).indent ?? 0)
    } catch {
      return 0
    }
  })()

  const mmToPct = (mm: number) => (mm / w) * 100
  const indentMm = curIndent * 6.35
  const leftPct = mmToPct(pad + indentMm)

  const setIndent = (target: number) => {
    if (!editor) return
    const t = Math.max(0, Math.min(8, Math.round(target)))
    const cmds = editor.commands as unknown as { indent: () => void; outdent: () => void }
    let guard = 0
    // read current each step
    while (guard++ < 10) {
      const cur = Number((editor.getAttributes('paragraph') as { indent?: number }).indent ?? 0)
      if (cur === t) break
      if (cur < t) cmds.indent()
      else cmds.outdent()
      editor.view.dispatch(editor.view.state.tr)
    }
  }

  const dragMarker = (e: React.PointerEvent, kind: 'left' | 'first') => {
    e.preventDefault()
    const track = trackRef.current
    if (!track || !editor) return
    const rect = track.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left))
      const mm = (x / rect.width) * w - pad
      if (kind === 'left') {
        setIndent(mm / 6.35)
      } else {
        const cmds = editor.commands as unknown as { setFirstLineIndent: (v: string | null) => void }
        cmds.setFirstLineIndent(mm > 4 ? `${Math.min(40, mm).toFixed(1)}mm` : null)
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const ticks = Array.from({ length: Math.round(w * 2) }, (_, i) => i)

  return (
    <div className="sticky top-0 z-10 flex justify-center border-b border-neutral-300 bg-[#F3F3F3] dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <div className="relative h-6 overflow-hidden bg-white dark:bg-[#2d2d2d]" style={{ width: `${w}mm`, maxWidth: '100%', zoom: `${zoom}%` } as React.CSSProperties}>
        <div className="absolute inset-y-0 left-0 bg-neutral-200/70 dark:bg-neutral-700/60" style={{ width: `${mmToPct(pad)}%` }} />
        <div className="absolute inset-y-0 right-0 bg-neutral-200/70 dark:bg-neutral-700/60" style={{ width: `${mmToPct(pad)}%` }} />
        <div ref={trackRef} className="relative flex h-full items-end justify-between" style={{ paddingLeft: `${mmToPct(pad)}%`, paddingRight: `${mmToPct(pad)}%` }}>
          {ticks.map((t) => {
            const isCm = t % 2 === 0
            return (
              <div key={t} className="flex flex-col items-center">
                {isCm && (
                  <span className="-mb-0.5 hidden text-[8px] leading-none text-neutral-500 lg:inline">{t / 2}</span>
                )}
                <div className={`w-px bg-neutral-400 ${isCm ? 'h-2.5' : 'h-1.5'}`} />
              </div>
            )
          })}
        </div>
        {/* indent markers */}
        <div
          title="Left indent (drag)"
          onPointerDown={(e) => dragMarker(e, 'left')}
          className="absolute bottom-0 h-3 w-3 cursor-ew-resize bg-[#2B579A]"
          style={{ left: `calc(${leftPct}% - 6px)`, clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
        />
        <div
          title="First-line indent (drag)"
          onPointerDown={(e) => dragMarker(e, 'first')}
          className="absolute top-0 h-3 w-3 cursor-ew-resize bg-[#2B579A]/60"
          style={{ left: `calc(${leftPct}% - 6px)`, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}
        />
      </div>
    </div>
  )
}
