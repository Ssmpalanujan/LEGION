/** Modal crop tool: draggable crop box, aspect presets, circle crop, live preview. */

import { useEffect, useRef, useState } from 'react'
import { Modal } from '../../components/Dialogs'
import type { CropBox, CropPreset } from './types'
import { clampCropBox, cropPresetBox } from './math'
import { loadImageElement } from './downscale'

const PRESETS: { id: CropPreset; label: string; tip: string }[] = [
  { id: 'free', label: 'Free', tip: 'Free crop — drag any corner' },
  { id: '1:1', label: '1:1', tip: 'Square crop' },
  { id: '4:3', label: '4:3', tip: 'Standard 4:3 crop' },
  { id: '16:9', label: '16:9', tip: 'Widescreen 16:9 crop' },
  { id: 'circle', label: 'Circle', tip: 'Circular crop (square box + round mask)' }
]

function presetAspect(p: CropPreset): number | null {
  if (p === '1:1' || p === 'circle') return 1
  if (p === '4:3') return 4 / 3
  if (p === '16:9') return 16 / 9
  return null
}

interface CropOverlayProps {
  src: string
  initial?: CropBox | null
  onApply: (box: CropBox, shape: 'rect' | 'circle') => void
  onClose: () => void
}

type DragMode = { kind: 'move' } | { kind: 'corner'; corner: 'nw' | 'ne' | 'sw' | 'se' } | null

export function CropOverlay({ src, initial, onApply, onClose }: CropOverlayProps) {
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [loadError, setLoadError] = useState('')
  const [preset, setPreset] = useState<CropPreset>('free')
  const [box, setBox] = useState<CropBox>(initial ?? { x: 0, y: 0, w: 1, h: 1 })
  const dragRef = useRef<DragMode>(null)
  const dragStart = useRef({ x: 0, y: 0, box: { x: 0, y: 0, w: 1, h: 1 } })
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadImageElement(src)
      .then((img) => {
        if (!alive) return
        setImgSize({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height })
      })
      .catch(() => alive && setLoadError('Could not load image for cropping.'))
    return () => {
      alive = false
    }
  }, [src])

  const aspect = presetAspect(preset)
  const imgAspect = imgSize.w > 0 && imgSize.h > 0 ? imgSize.w / imgSize.h : 1

  const pickPreset = (p: CropPreset) => {
    setPreset(p)
    setBox(clampCropBox(cropPresetBox(p, imgAspect), presetAspect(p)))
  }

  const toFrac = (clientX: number, clientY: number) => {
    const r = stageRef.current?.getBoundingClientRect()
    if (!r || r.width === 0 || r.height === 0) return { x: 0, y: 0 }
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height }
  }

  const onPointerDown = (mode: Exclude<DragMode, null>) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const p = toFrac(e.clientX, e.clientY)
    dragRef.current = mode
    dragStart.current = { x: p.x, y: p.y, box: { ...box } }
    const onMove = (ev: PointerEvent) => {
      const m = dragRef.current
      if (!m) return
      const q = toFrac(ev.clientX, ev.clientY)
      const s = dragStart.current
      const dx = q.x - s.x
      const dy = q.y - s.y
      const b = { ...s.box }
      if (m.kind === 'move') {
        b.x = s.box.x + dx
        b.y = s.box.y + dy
      } else {
        // anchor the opposite corner, grow/shrink toward the pointer
        if (m.corner.includes('w')) {
          b.x = Math.min(s.box.x + s.box.w, s.box.x + dx)
          b.w = s.box.x + s.box.w - b.x
        } else {
          b.w = Math.max(0.02, q.x - s.box.x)
        }
        if (m.corner.includes('n')) {
          b.y = Math.min(s.box.y + s.box.h, s.box.y + dy)
          b.h = s.box.y + s.box.h - b.y
        } else {
          b.h = Math.max(0.02, q.y - s.box.y)
        }
      }
      setBox(clampCropBox(b, aspect))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const circle = preset === 'circle'
  // preview of the cropped result
  const pw = Math.max(1, Math.round(box.w * imgSize.w))
  const ph = Math.max(1, Math.round(box.h * imgSize.h))

  return (
    <Modal title="Crop image" onClose={onClose}>
      <div className="mb-2 flex gap-1.5" role="group" aria-label="Crop presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => pickPreset(p.id)}
            title={p.tip}
            aria-pressed={preset === p.id}
            className={`flex-1 rounded border px-2 py-1 text-[12px] ${
              preset === p.id
                ? 'border-[#2B579A] bg-[#D6E4F7] font-medium text-[#2B579A] dark:border-sky-500 dark:bg-sky-900 dark:text-sky-200'
                : 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {loadError ? (
        <p role="alert" className="py-6 text-center text-[13px] text-red-600">{loadError}</p>
      ) : (
        <div
          ref={stageRef}
          className="relative max-h-[50vh] touch-none select-none overflow-hidden rounded border border-neutral-300 bg-black/80 dark:border-neutral-600"
          style={{ aspectRatio: imgSize.w > 0 ? `${imgSize.w} / ${imgSize.h}` : '4 / 3' }}
          aria-label="Crop canvas. Drag inside the box to move it, drag corners to resize."
        >
          <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full opacity-40" />
          <div
            className="absolute"
            style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
          >
            <div className="absolute overflow-hidden" style={{ inset: 0, borderRadius: circle ? '50%' : 0 }}>
              <img
                src={src}
                alt=""
                draggable={false}
                className="absolute max-w-none"
                style={{
                  width: `${(1 / Math.max(box.w, 1e-6)) * 100}%`,
                  height: `${(1 / Math.max(box.h, 1e-6)) * 100}%`,
                  left: `${(-box.x / Math.max(box.w, 1e-6)) * 100}%`,
                  top: `${(-box.y / Math.max(box.h, 1e-6)) * 100}%`
                }}
              />
            </div>
            {/* rule-of-thirds grid */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="border border-white/40" />
              ))}
            </div>
            <div
              className="absolute inset-0 cursor-move"
              title="Drag to move the crop box"
              onPointerDown={onPointerDown({ kind: 'move' })}
            />
            {(['nw', 'ne', 'sw', 'se'] as const).map((c) => (
              <button
                key={c}
                className="absolute h-4 w-4 rounded-full border-2 border-white bg-[#2B579A]"
                style={{
                  left: c.includes('w') ? -8 : undefined,
                  right: c.includes('e') ? -8 : undefined,
                  top: c.includes('n') ? -8 : undefined,
                  bottom: c.includes('s') ? -8 : undefined,
                  cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize'
                }}
                title={`Crop corner ${c.toUpperCase()} — drag to resize`}
                aria-label={`Crop corner ${c}`}
                onPointerDown={onPointerDown({ kind: 'corner', corner: c })}
              />
            ))}
          </div>
        </div>
      )}
      <p className="mt-1.5 text-[12px] tabular-nums text-neutral-500">
        Crop: {pw} × {ph} px{circle ? ' · circular mask' : ''}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onApply(box, circle ? 'circle' : 'rect')}
          title="Apply this crop to the image"
          className="flex-1 rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]"
        >
          Apply crop
        </button>
        <button
          onClick={onClose}
          title="Close without cropping"
          className="rounded border border-neutral-300 px-4 py-1.5 text-[13px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
