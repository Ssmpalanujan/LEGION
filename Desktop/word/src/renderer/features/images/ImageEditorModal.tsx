/** Built-in image editor modal: adjustments, filter presets, annotations, history. Non-destructive. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Undo2, Redo2, Eye } from 'lucide-react'
import type { Annotation, AnnotationTool, FilterPresetId, FilterState, ImageEdits } from './editorTypes'
import { DEFAULT_FILTERS, EMPTY_EDITS, FILTER_PRESETS } from './editorTypes'
import { adjustPixels, bufferToImageData, cssFilterString, drawAnnotations, imageDataToBuffer, sharpenPixels } from './pipeline'
import { loadImageElement } from './downscale'

interface ImageEditorModalProps {
  baseSrc: string
  initial: ImageEdits
  onApply: (dataUrl: string, edits: ImageEdits) => void
  onClose: () => void
}

type Tab = 'adjust' | 'filters' | 'annotate'

const TOOLS: { id: AnnotationTool; label: string; tip: string }[] = [
  { id: 'pen', label: 'Pen', tip: 'Freehand pen (left-drag to draw)' },
  { id: 'highlighter', label: 'Marker', tip: 'Translucent highlighter' },
  { id: 'arrow', label: 'Arrow', tip: 'Drag to draw an arrow' },
  { id: 'rect', label: 'Rect', tip: 'Drag to draw a rectangle' },
  { id: 'circle', label: 'Circle', tip: 'Drag to draw an ellipse' },
  { id: 'text', label: 'Text', tip: 'Click to place text, type, Enter to commit' },
  { id: 'redact', label: 'Blur', tip: 'Drag a region to blur or pixelate it' }
]

const SWATCHES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#111111']

function cloneEdits(e: ImageEdits): ImageEdits {
  return JSON.parse(JSON.stringify(e)) as ImageEdits
}

/** Render filtered photo (no annotations) onto canvas at natural size. */
function renderPhoto(base: HTMLCanvasElement, filters: FilterState, target: HTMLCanvasElement): void {
  target.width = base.width
  target.height = base.height
  const ctx = target.getContext('2d')
  if (!ctx) return
  ctx.save()
  ctx.clearRect(0, 0, target.width, target.height)
  const f = cssFilterString(filters)
  if (f !== 'none') ctx.filter = f
  ctx.drawImage(base, 0, 0)
  ctx.restore()
  const needsCpu = filters.exposure !== 0 || filters.temperature !== 0 || filters.tint !== 0 || filters.sharpness !== 0
  if (!needsCpu) return
  try {
    const id = ctx.getImageData(0, 0, target.width, target.height)
    const buf = imageDataToBuffer(id)
    adjustPixels(buf, filters)
    const sharp = sharpenPixels(buf, filters.sharpness / 100)
    ctx.putImageData(bufferToImageData(sharp), 0, 0)
  } catch {
    /* tainted canvas (remote URL without CORS) — GPU-only filters still applied */
  }
}

export function ImageEditorModal({ baseSrc, initial, onApply, onClose }: ImageEditorModalProps) {
  const [base, setBase] = useState<HTMLCanvasElement | null>(null)
  const [loadError, setLoadError] = useState('')
  const [edits, setEdits] = useState<ImageEdits>(() => cloneEdits(initial.version === 1 ? initial : EMPTY_EDITS))
  const [past, setPast] = useState<ImageEdits[]>([])
  const [future, setFuture] = useState<ImageEdits[]>([])
  const [tab, setTab] = useState<Tab>('adjust')
  const [compare, setCompare] = useState(50)
  const [showOriginal, setShowOriginal] = useState(false)
  const [tool, setTool] = useState<AnnotationTool>('pen')
  const [color, setColor] = useState('#ef4444')
  const [strokeW, setStrokeW] = useState(4)
  const [redactMode, setRedactMode] = useState<'blur' | 'pixel'>('blur')
  const [textSize, setTextSize] = useState(48)
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const [presetThumbs, setPresetThumbs] = useState<Record<string, string>>({})

  const photoRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<{ points: { x: number; y: number }[]; start: { x: number; y: number } } | null>(null)
  const rafRef = useRef(0)

  // load master pixels once
  useEffect(() => {
    let alive = true
    loadImageElement(baseSrc)
      .then((img) => {
        if (!alive) return
        const c = document.createElement('canvas')
        c.width = img.naturalWidth || img.width
        c.height = img.naturalHeight || img.height
        const ctx = c.getContext('2d')
        if (!ctx) throw new Error('no 2d context')
        ctx.drawImage(img, 0, 0)
        setBase(c)
      })
      .catch(() => alive && setLoadError('Could not load the image for editing.'))
    return () => {
      alive = false
    }
  }, [baseSrc])

  // repaint preview (photo + annotations), rAF-throttled
  const repaint = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const photo = photoRef.current
      const view = viewRef.current
      if (!base || !photo || !view) return
      renderPhoto(base, edits.filters, photo)
      view.width = photo.width
      view.height = photo.height
      const vctx = view.getContext('2d')
      if (!vctx) return
      vctx.clearRect(0, 0, view.width, view.height)
      vctx.drawImage(photo, 0, 0)
      drawAnnotations(vctx, view.width, view.height, edits.annotations)
    })
  }, [base, edits])

  useEffect(() => {
    repaint()
    return () => cancelAnimationFrame(rafRef.current)
  }, [repaint])

  // filter preset thumbnails (once the base loads)
  useEffect(() => {
    if (!base) return
    const thumbs: Record<string, string> = {}
    for (const p of FILTER_PRESETS) {
      const c = document.createElement('canvas')
      const S = 96
      const scale = Math.min(1, S / Math.max(base.width, base.height))
      c.width = Math.max(1, Math.round(base.width * scale))
      c.height = Math.max(1, Math.round(base.height * scale))
      const ctx = c.getContext('2d')
      if (!ctx) continue
      const f = cssFilterString({ ...DEFAULT_FILTERS, ...p.values })
      if (f !== 'none') ctx.filter = f
      ctx.drawImage(base, 0, 0, c.width, c.height)
      try {
        if (p.values.exposure || p.values.temperature || p.values.tint) {
          const id = ctx.getImageData(0, 0, c.width, c.height)
          const buf = imageDataToBuffer(id)
          adjustPixels(buf, {
            exposure: p.values.exposure ?? 0,
            temperature: p.values.temperature ?? 0,
            tint: p.values.tint ?? 0
          })
          ctx.putImageData(bufferToImageData(buf), 0, 0)
        }
      } catch {
        /* ignore */
      }
      thumbs[p.id] = c.toDataURL()
    }
    setPresetThumbs(thumbs)
  }, [base])

  const commit = useCallback(
    (next: ImageEdits) => {
      setPast((p) => [...p.slice(-49), cloneEdits(edits)])
      setFuture([])
      setEdits(next)
    },
    [edits]
  )

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      setFuture((f) => [cloneEdits(edits), ...f].slice(0, 50))
      setEdits(prev)
      return p.slice(0, -1)
    })
  }, [edits])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const [next, ...rest] = f
      setPast((p) => [...p.slice(-49), cloneEdits(edits)])
      setEdits(next)
      return rest
    })
  }, [edits])

  const setFilters = (patch: Partial<FilterState>, live = true) => {
    const next = { ...edits, filters: { ...edits.filters, ...patch } }
    if (live) {
      setEdits(next) // slider drags preview live; history entry on release
    } else {
      commit(next)
    }
  }

  // Slider drags preview live; a single history entry is pushed on release.
  const sliderStart = useRef<ImageEdits | null>(null)
  const editsRef = useRef(edits)
  editsRef.current = edits
  const beginSlider = () => {
    sliderStart.current = cloneEdits(editsRef.current)
  }
  const endSlider = () => {
    const snap = sliderStart.current
    sliderStart.current = null
    if (!snap) return
    if (JSON.stringify(editsRef.current) !== JSON.stringify(snap)) {
      setPast((p) => [...p.slice(-49), snap])
      setFuture([])
    }
  }

  const stageFrac = (clientX: number, clientY: number) => {
    const r = stageRef.current?.getBoundingClientRect()
    const vw = viewRef.current?.width ?? 1
    const vh = viewRef.current?.height ?? 1
    if (!r) return { x: 0, y: 0 }
    // canvas is letterboxed with object-contain → map through displayed rect
    const scale = Math.min(r.width / vw, r.height / vh)
    const dw = vw * scale
    const dh = vh * scale
    const ox = r.left + (r.width - dw) / 2
    const oy = r.top + (r.height - dh) / 2
    return {
      x: Math.min(1, Math.max(0, (clientX - ox) / dw)),
      y: Math.min(1, Math.max(0, (clientY - oy) / dh))
    }
  }

  const pushAnnotation = (a: Annotation) => {
    const next = { ...edits, annotations: [...edits.annotations, a] }
    commit(next)
  }

  const onStageDown = (e: React.PointerEvent) => {
    if (tab !== 'annotate' || pendingText) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const p = stageFrac(e.clientX, e.clientY)
    if (tool === 'text') {
      setPendingText(p)
      setTextDraft('')
      return
    }
    gestureRef.current = { points: [p], start: p }
    const onMove = (ev: PointerEvent) => {
      const g = gestureRef.current
      if (!g) return
      g.points.push(stageFrac(ev.clientX, ev.clientY))
      // live sketch on the overlay canvas
      const ov = drawRef.current
      const view = viewRef.current
      if (!ov || !view || !stageRef.current) return
      const r = stageRef.current.getBoundingClientRect()
      ov.width = r.width
      ov.height = r.height
      const octx = ov.getContext('2d')
      if (!octx) return
      const scale = Math.min(r.width / view.width, r.height / view.height)
      const dw = view.width * scale
      const dh = view.height * scale
      const ox = (r.width - dw) / 2
      const oy = (r.height - dh) / 2
      octx.clearRect(0, 0, r.width, r.height)
      octx.strokeStyle = color
      octx.lineWidth = Math.max(2, strokeW)
      octx.lineCap = 'round'
      octx.globalAlpha = tool === 'highlighter' ? 0.45 : 1
      const pts = g.points.map((q) => ({ x: ox + q.x * dw, y: oy + q.y * dh }))
      octx.beginPath()
      if (tool === 'pen' || tool === 'highlighter') {
        pts.forEach((q, i) => (i === 0 ? octx.moveTo(q.x, q.y) : octx.lineTo(q.x, q.y)))
        octx.stroke()
      } else {
        const s = g.start
        const last = pts[pts.length - 1]
        const x0 = ox + s.x * dw
        const y0 = oy + s.y * dh
        if (tool === 'rect' || tool === 'redact') octx.strokeRect(x0, y0, last.x - x0, last.y - y0)
        else if (tool === 'circle') {
          octx.beginPath()
          octx.ellipse((x0 + last.x) / 2, (y0 + last.y) / 2, Math.abs(last.x - x0) / 2, Math.abs(last.y - y0) / 2, 0, 0, Math.PI * 2)
          octx.stroke()
        } else {
          octx.beginPath()
          octx.moveTo(x0, y0)
          octx.lineTo(last.x, last.y)
          octx.stroke()
        }
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const g = gestureRef.current
      gestureRef.current = null
      const ov = drawRef.current
      ov?.getContext('2d')?.clearRect(0, 0, ov.width, ov.height)
      if (!g || g.points.length === 0) return
      const last = g.points[g.points.length - 1]
      const norm = (a: number, b: number) => ({ o: Math.min(a, b), s: Math.abs(b - a) })
      if (tool === 'pen' || tool === 'highlighter') {
        if (g.points.length < 2) return
        pushAnnotation({ kind: 'stroke', tool, color, width: strokeW, points: g.points })
      } else if (tool === 'redact') {
        const nx = norm(g.start.x, last.x)
        const ny = norm(g.start.y, last.y)
        if (nx.s < 0.01 || ny.s < 0.01) return
        pushAnnotation({ kind: 'redact', mode: redactMode, x: nx.o, y: ny.o, w: nx.s, h: ny.s })
      } else {
        const nx = norm(g.start.x, last.x)
        const ny = norm(g.start.y, last.y)
        if (nx.s < 0.005 && ny.s < 0.005) return
        pushAnnotation({ kind: 'shape', tool, color, width: strokeW, x: nx.o, y: ny.o, w: nx.s, h: ny.s })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const commitText = () => {
    if (!pendingText || !textDraft.trim()) {
      setPendingText(null)
      return
    }
    const W = viewRef.current?.width ?? 800
    pushAnnotation({ kind: 'text', color, size: Math.max(12, Math.round(textSize * (W / 800))), x: pendingText.x, y: pendingText.y, text: textDraft.trim() })
    setPendingText(null)
    setTextDraft('')
  }

  const applyAll = () => {
    const photo = photoRef.current
    const view = viewRef.current
    if (!photo || !view) return
    // full-resolution composite: filtered photo + annotations
    const out = document.createElement('canvas')
    out.width = photo.width
    out.height = photo.height
    const octx = out.getContext('2d')
    if (!octx) return
    octx.drawImage(photo, 0, 0)
    drawAnnotations(octx, out.width, out.height, edits.annotations)
    onApply(out.toDataURL('image/png'), cloneEdits(edits))
  }

  const sliders: { key: keyof FilterState; label: string; tip: string; min: number; max: number; step: number }[] = useMemo(
    () => [
      { key: 'brightness', label: 'Brightness', tip: 'Overall lightness (-100 to +100)', min: -100, max: 100, step: 1 },
      { key: 'contrast', label: 'Contrast', tip: 'Difference between light and dark', min: -100, max: 100, step: 1 },
      { key: 'saturation', label: 'Saturation', tip: 'Color intensity (-100 is grayscale)', min: -100, max: 100, step: 1 },
      { key: 'exposure', label: 'Exposure', tip: 'Simulated exposure compensation (±2 EV)', min: -2, max: 2, step: 0.1 },
      { key: 'sharpness', label: 'Sharpness', tip: 'Edge detail enhancement', min: 0, max: 100, step: 1 },
      { key: 'blur', label: 'Blur', tip: 'Gaussian softening in pixels', min: 0, max: 20, step: 0.5 },
      { key: 'temperature', label: 'Temperature', tip: 'Warm (amber) vs cool (blue)', min: -100, max: 100, step: 1 },
      { key: 'tint', label: 'Tint', tip: 'Green vs magenta balance', min: -100, max: 100, step: 1 },
      { key: 'hue', label: 'Hue', tip: 'Rotate all hues around the color wheel', min: -180, max: 180, step: 1 }
    ],
    []
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        // keep doc-level shortcuts (e.g. Ctrl+Z) from firing while editing pixels
        e.stopPropagation()
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault()
          undo()
        } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
          e.preventDefault()
          redo()
        } else if (e.key === 'Escape' && !pendingText) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Image editor"
        className="flex max-h-[92vh] w-[980px] max-w-[96vw] flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-[#2d2d2d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-700">
          <span className="text-[14px] font-semibold">Edit image (non-destructive — original kept)</span>
          <div className="flex items-center gap-1">
            <button onClick={undo} disabled={past.length === 0} title="Undo edit (Ctrl+Z)" aria-label="Undo edit" className="rounded p-1.5 hover:bg-neutral-200 disabled:opacity-40 dark:hover:bg-neutral-700">
              <Undo2 size={15} />
            </button>
            <button onClick={redo} disabled={future.length === 0} title="Redo edit (Ctrl+Y)" aria-label="Redo edit" className="rounded p-1.5 hover:bg-neutral-200 disabled:opacity-40 dark:hover:bg-neutral-700">
              <Redo2 size={15} />
            </button>
            <button onClick={onClose} title="Cancel without applying" aria-label="Cancel" className="rounded p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700">
              <X size={15} />
            </button>
          </div>
        </div>

        {loadError ? (
          <p role="alert" className="p-8 text-center text-[13px] text-red-600">{loadError}</p>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* canvas stage */}
            <div className="relative flex min-w-0 flex-1 items-center justify-center bg-black/85 p-3">
              <div ref={stageRef} className="relative h-full w-full" onPointerDown={onStageDown} style={{ touchAction: 'none', cursor: tab === 'annotate' ? 'crosshair' : 'default' }}>
                {/* base image (before) */}
                {base && <img src={base.toDataURL()} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain" />}
                <canvas ref={photoRef} className="hidden" aria-hidden="true" />
                {/* edited result, clipped by the compare slider */}
                <canvas
                  ref={viewRef}
                  className="absolute inset-0 h-full w-full object-contain"
                  style={showOriginal ? { display: 'none' } : { clipPath: `inset(0 0 0 ${compare}%)` }}
                  aria-label="Edited image preview"
                />
                <canvas ref={drawRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
                {/* compare divider */}
                {!showOriginal && (
                  <div className="absolute inset-y-0" style={{ left: `${compare}%` }} aria-hidden="true">
                    <div className="h-full w-0.5 -translate-x-1/2 bg-white shadow" />
                  </div>
                )}
                {pendingText && (
                  <input
                    autoFocus
                    value={textDraft}
                    onChange={(e) => setTextDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitText()
                      if (e.key === 'Escape') setPendingText(null)
                    }}
                    onBlur={commitText}
                    placeholder="Type text, Enter to place"
                    aria-label="Annotation text"
                    className="absolute rounded border border-[#2B579A] bg-white/90 px-1 py-0.5 text-[13px] text-black"
                    style={{ left: `${pendingText.x * 100}%`, top: `${pendingText.y * 100}%` }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                )}
              </div>
              <div className="absolute bottom-3 left-1/2 flex w-64 -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1.5" title="Drag to compare before (left) and after (right)">
                <span className="text-[11px] text-white/80">Before</span>
                <input aria-label="Before after comparison slider" type="range" min={0} max={100} value={compare} onChange={(e) => setCompare(Number(e.target.value))} className="flex-1" />
                <span className="text-[11px] text-white/80">After</span>
                <button
                  onMouseDown={() => setShowOriginal(true)}
                  onMouseUp={() => setShowOriginal(false)}
                  onMouseLeave={() => setShowOriginal(false)}
                  title="Hold to view the original"
                  aria-label="Hold to view original"
                  className="rounded p-1 text-white/80 hover:text-white"
                >
                  <Eye size={13} />
                </button>
              </div>
            </div>

            {/* controls */}
            <div className="word-scroll w-64 shrink-0 overflow-y-auto border-l border-neutral-200 p-3 dark:border-neutral-700">
              <div className="mb-2 flex gap-1" role="tablist" aria-label="Editor sections">
                {(['adjust', 'filters', 'annotate'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded py-1 text-[12px] capitalize ${tab === t ? 'bg-[#2B579A] text-white' : 'border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-600'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {tab === 'adjust' && (
                <div>
                  {sliders.map((s) => (
                    <label key={s.key} className="block py-1 text-[12px]" title={s.tip}>
                      <span className="flex justify-between text-neutral-600 dark:text-neutral-300">
                        <span>{s.label}</span>
                        <span className="tabular-nums">{edits.filters[s.key]}</span>
                      </span>
                      <input
                        aria-label={s.label}
                        type="range"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={edits.filters[s.key]}
                        onChange={(e) => setFilters({ [s.key]: Number(e.target.value) } as Partial<FilterState>)}
                        onPointerDown={beginSlider}
                        onPointerUp={endSlider}
                        onKeyUp={endSlider}
                        onDoubleClick={() => setFilters({ [s.key]: DEFAULT_FILTERS[s.key] } as Partial<FilterState>, false)}
                        className="w-full"
                      />
                    </label>
                  ))}
                  <button
                    onClick={() => commit({ ...edits, filters: { ...DEFAULT_FILTERS } })}
                    title="Reset all adjustments"
                    className="mt-1 w-full rounded border border-neutral-300 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
                  >
                    Reset adjustments
                  </button>
                  <p className="mt-1 text-[11px] text-neutral-400">Tip: double-click a slider to reset it.</p>
                </div>
              )}

              {tab === 'filters' && (
                <div className="grid grid-cols-2 gap-1.5">
                  {FILTER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => commit({ ...edits, filters: { ...DEFAULT_FILTERS, ...p.values } })}
                      title={`${p.tip} — click to apply`}
                      className="overflow-hidden rounded border border-neutral-300 hover:border-[#2B579A] dark:border-neutral-600"
                    >
                      {presetThumbs[p.id as FilterPresetId] ? (
                        <img src={presetThumbs[p.id as FilterPresetId]} alt="" draggable={false} className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="aspect-square w-full bg-neutral-200" />
                      )}
                      <div className="py-0.5 text-[12px]">{p.label}</div>
                    </button>
                  ))}
                </div>
              )}

              {tab === 'annotate' && (
                <div>
                  <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Annotation tool">
                    {TOOLS.map((t) => (
                      <button
                        key={t.id}
                        role="radio"
                        aria-checked={tool === t.id}
                        onClick={() => setTool(t.id)}
                        title={t.tip}
                        className={`rounded border py-1 text-[12px] ${tool === t.id ? 'border-[#2B579A] bg-[#D6E4F7] text-[#2B579A] dark:bg-sky-900 dark:text-sky-200' : 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-600'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <input type="color" aria-label="Annotation colour" title="Annotation colour" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 cursor-pointer" />
                    <div className="flex flex-1 flex-wrap gap-1">
                      {SWATCHES.map((c) => (
                        <button key={c} onClick={() => setColor(c)} title={`Use colour ${c}`} aria-label={`Use colour ${c}`} className="h-5 w-5 rounded-full border border-black/20" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <label className="mt-2 block text-[12px]" title="Stroke width for pen, marker and shapes">
                    <span className="flex justify-between text-neutral-600 dark:text-neutral-300"><span>Stroke width</span><span className="tabular-nums">{strokeW}</span></span>
                    <input aria-label="Stroke width" type="range" min={1} max={20} value={strokeW} onChange={(e) => setStrokeW(Number(e.target.value))} className="w-full" />
                  </label>
                  {tool === 'redact' && (
                    <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Redaction style">
                      {(['blur', 'pixel'] as const).map((m) => (
                        <button key={m} role="radio" aria-checked={redactMode === m} onClick={() => setRedactMode(m)} title={m === 'blur' ? 'Soft gaussian blur' : 'Pixelated blocks'} className={`flex-1 rounded border py-1 text-[12px] capitalize ${redactMode === m ? 'border-[#2B579A] bg-[#D6E4F7]' : 'border-neutral-300'}`}>
                          {m === 'blur' ? 'Blur' : 'Pixelate'}
                        </button>
                      ))}
                    </div>
                  )}
                  {tool === 'text' && (
                    <label className="mt-1 block text-[12px]" title="Text size in pixels">
                      <span className="flex justify-between text-neutral-600 dark:text-neutral-300"><span>Text size</span><span className="tabular-nums">{textSize}</span></span>
                      <input aria-label="Text size" type="range" min={12} max={160} value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="w-full" />
                    </label>
                  )}
                  <button
                    onClick={() => commit({ ...edits, annotations: [] })}
                    disabled={edits.annotations.length === 0}
                    title="Remove all annotations"
                    className="mt-2 w-full rounded border border-neutral-300 py-1 text-[12px] hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-600 dark:hover:bg-neutral-700"
                  >
                    Clear annotations ({edits.annotations.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 border-t border-neutral-200 p-3 dark:border-neutral-700">
          <button onClick={applyAll} title="Bake edits into the document image (original kept for reset/reopen)" className="flex-1 rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
            Apply
          </button>
          <button onClick={onClose} title="Discard edits and close" className="rounded border border-neutral-300 px-5 py-1.5 text-[13px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
