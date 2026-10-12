/** Picture Format side panel: size, rotate/flip, crop, wrap, style, content. */

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { X } from 'lucide-react'
import type { AtlasImageAttrs, CropPreset, SizeUnit, WrapMode, ImageAlign, BorderStyle } from './types'
import { unitsToPx, pxToUnits, clampCropBox, cropPresetBox } from './math'
import { selectedAtlasImage, setAtlasAttrsAt } from './imageNode'
import { fileToAtlasSources } from './downscale'
import { compressSrc } from './export'

interface FormatPanelProps {
  editor: Editor | null
  onClose: () => void
  onOpenCrop: () => void
  onOpenEditor: () => void
  onOpenSmart: () => void
}

function useSelectedAtlas(editor: Editor | null): { pos: number; attrs: AtlasImageAttrs } | null {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!editor) return
    const bump = () => setTick((t) => t + 1)
    editor.on('selectionUpdate', bump)
    editor.on('transaction', bump)
    return () => {
      editor.off('selectionUpdate', bump)
      editor.off('transaction', bump)
    }
  }, [editor])
  if (!editor) return null
  const found = selectedAtlasImage(editor)
  if (!found) return null
  return { pos: found.pos, attrs: found.node.attrs as unknown as AtlasImageAttrs }
}

const inputCls = 'rounded border border-neutral-300 px-1.5 py-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800'
const secTitle = 'px-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400'

function Row({ label, tip, children }: { label: string; tip: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 px-1 py-1 text-[12px]" title={tip}>
      <span className="text-neutral-600 dark:text-neutral-300">{label}</span>
      <span className="flex items-center gap-1">{children}</span>
    </label>
  )
}

function Seg<T extends string>({ options, value, onPick, aria }: { options: { v: T; label: string; tip: string }[]; value: T; onPick: (v: T) => void; aria: string }) {
  return (
    <div className="flex gap-1" role="group" aria-label={aria}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onPick(o.v)}
          title={o.tip}
          aria-pressed={value === o.v}
          className={`rounded border px-2 py-1 text-[12px] ${
            value === o.v
              ? 'border-[#2B579A] bg-[#D6E4F7] font-medium text-[#2B579A] dark:border-sky-500 dark:bg-sky-900 dark:text-sky-200'
              : 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function FormatPanel({ editor, onClose, onOpenCrop, onOpenEditor, onOpenSmart }: FormatPanelProps) {
  const sel = useSelectedAtlas(editor)
  const fileRef = useRef<HTMLInputElement>(null)
  const [unit, setUnit] = useState<SizeUnit>('px')
  const [sizeVal, setSizeVal] = useState('')
  const [quality, setQuality] = useState(80)
  const [busy, setBusy] = useState('')

  const patch = (p: Partial<AtlasImageAttrs>) => {
    if (!editor || !sel) return
    setAtlasAttrsAt(editor, sel.pos, p)
  }

  if (!editor) return null

  const refWidth = (() => {
    try {
      return (editor.view.dom as HTMLElement).clientWidth || 640
    } catch {
      return 640
    }
  })()

  const commitSize = () => {
    const v = Number(sizeVal)
    if (!sel || Number.isNaN(v) || v <= 0) return
    patch({ width: Math.round(unitsToPx(v, unit, refWidth)) })
  }

  const rotate = (dir: 1 | -1) => {
    if (!sel) return
    const steps = [0, 90, 180, 270] as const
    const i = steps.indexOf(sel.attrs.rotation)
    patch({ rotation: steps[(i + dir + 4) % 4] })
  }

  const quickCrop = (preset: CropPreset) => {
    if (!sel) return
    const nat = sel.attrs
    const imgAspect = nat.naturalWidth > 0 && nat.naturalHeight > 0 ? nat.naturalWidth / nat.naturalHeight : 1
    const aspect = preset === '1:1' || preset === 'circle' ? 1 : preset === '4:3' ? 4 / 3 : preset === '16:9' ? 16 / 9 : null
    patch({ crop: clampCropBox(cropPresetBox(preset, imgAspect), aspect), cropShape: preset === 'circle' ? 'circle' : 'rect' })
  }

  const doReplace = async (f: File | undefined) => {
    if (!f || !sel) return
    setBusy('Loading replacement…')
    try {
      const { src, original } = await fileToAtlasSources(f)
      patch({ src: src.dataUrl, originalSrc: original.dataUrl, naturalWidth: src.width, naturalHeight: src.height, crop: null, editsJson: '' })
    } catch (err) {
      alert(`Could not load image: ${err instanceof Error ? err.message : err}`)
    } finally {
      setBusy('')
    }
  }

  const doReset = () => {
    if (!sel || !sel.attrs.originalSrc) return
    patch({ src: sel.attrs.originalSrc, crop: null, rotation: 0, flipH: false, flipV: false, editsJson: '' })
  }

  const doCompress = async () => {
    if (!sel) return
    setBusy('Compressing…')
    try {
      const out = await compressSrc(sel.attrs.src, quality / 100)
      patch({ src: out })
    } catch (err) {
      alert(`Compress failed: ${err instanceof Error ? err.message : err}`)
    } finally {
      setBusy('')
    }
  }

  const shownSize = sel ? (sel.attrs.width ?? sel.attrs.naturalWidth) : 0

  return (
    <aside aria-label="Picture Format panel" className="flex w-64 flex-col border-l border-neutral-300 bg-white dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <span className="text-[13px] font-semibold">Picture Format</span>
        <button onClick={onClose} title="Close Picture Format (Esc)" aria-label="Close Picture Format" className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700">
          <X size={14} />
        </button>
      </div>
      {!sel ? (
        <p className="p-3 text-[12px] text-neutral-500">Select an image in the document to format it. Drag the corner handles to resize, or use the controls here for exact values.</p>
      ) : (
        <div className="word-scroll flex-1 overflow-auto pb-3">
          <div className={secTitle}>Size</div>
          <Row label="Width" tip="Exact display width. Corners keep aspect ratio unless unlocked.">
            <input
              aria-label="Image width"
              value={sizeVal === '' ? pxToUnits(shownSize, unit, refWidth).toFixed(unit === 'px' ? 0 : 2) : sizeVal}
              onChange={(e) => setSizeVal(e.target.value)}
              onBlur={() => setSizeVal('')}
              onKeyDown={(e) => e.key === 'Enter' && commitSize()}
              className={`${inputCls} w-20`}
              inputMode="decimal"
            />
            <select aria-label="Size unit" title="Size unit: pixels, centimetres, or percent of text width" value={unit} onChange={(e) => setUnit(e.target.value as SizeUnit)} className={inputCls}>
              <option value="px">px</option>
              <option value="cm">cm</option>
              <option value="pct">%</option>
            </select>
            <button onClick={commitSize} title="Apply width (Enter)" className="rounded bg-[#2B579A] px-2 py-1 text-[12px] text-white">Set</button>
          </Row>
          <Row label="Lock aspect ratio" tip="Corner handles keep proportions. Hold Shift while dragging to unlock temporarily.">
            <input type="checkbox" aria-label="Lock aspect ratio" checked={sel.attrs.lockAspect} onChange={(e) => patch({ lockAspect: e.target.checked })} />
          </Row>
          <p className="px-2 text-[11px] text-neutral-400">Natural: {sel.attrs.naturalWidth} × {sel.attrs.naturalHeight} px</p>

          <div className={secTitle}>Rotate & flip</div>
          <div className="flex gap-1 px-1 py-1">
            <button onClick={() => rotate(-1)} title="Rotate 90° counter-clockwise" aria-label="Rotate left" className="flex-1 rounded border border-neutral-300 py-1 text-[13px] hover:bg-neutral-100 dark:border-neutral-600">⟲ {sel.attrs.rotation}°</button>
            <button onClick={() => rotate(1)} title="Rotate 90° clockwise" aria-label="Rotate right" className="flex-1 rounded border border-neutral-300 py-1 text-[13px] hover:bg-neutral-100 dark:border-neutral-600">⟳</button>
            <button onClick={() => patch({ flipH: !sel.attrs.flipH })} title="Flip horizontally" aria-pressed={sel.attrs.flipH} className={`flex-1 rounded border py-1 text-[12px] ${sel.attrs.flipH ? 'border-[#2B579A] bg-[#D6E4F7]' : 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-600'}`}>Flip H</button>
            <button onClick={() => patch({ flipV: !sel.attrs.flipV })} title="Flip vertically" aria-pressed={sel.attrs.flipV} className={`flex-1 rounded border py-1 text-[12px] ${sel.attrs.flipV ? 'border-[#2B579A] bg-[#D6E4F7]' : 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-600'}`}>Flip V</button>
          </div>

          <div className={secTitle}>Crop</div>
          <div className="px-1 py-1">
            <div className="flex flex-wrap gap-1">
              {(['free', '1:1', '4:3', '16:9', 'circle'] as CropPreset[]).map((p) => (
                <button key={p} onClick={() => quickCrop(p)} title={`Quick crop: ${p}`} className="rounded border border-neutral-300 px-2 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">{p}</button>
              ))}
            </div>
            <div className="mt-1 flex gap-1">
              <button onClick={onOpenCrop} title="Open the crop tool with draggable box and overlay" className="flex-1 rounded bg-[#2B579A] py-1 text-[12px] text-white hover:bg-[#1F3F70]">Open crop tool…</button>
              {sel.attrs.crop && (
                <button onClick={() => patch({ crop: null, cropShape: 'rect' })} title="Remove the crop" className="rounded border border-neutral-300 px-2 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600">Clear</button>
              )}
            </div>
          </div>

          <div className={secTitle}>Text wrapping</div>
          <div className="px-1 py-1">
            <Seg<WrapMode>
              aria="Text wrapping mode"
              value={sel.attrs.wrap}
              onPick={(v) => patch({ wrap: v })}
              options={[
                { v: 'inline', label: 'Inline', tip: 'Image sits in the text flow' },
                { v: 'square', label: 'Square', tip: 'Text wraps the image box' },
                { v: 'tight', label: 'Tight', tip: 'Text hugs the image closely' },
                { v: 'behind', label: 'Behind', tip: 'Image floats behind the text (drag to position)' },
                { v: 'front', label: 'Front', tip: 'Image floats in front of the text (drag to position)' }
              ]}
            />
          </div>
          {(sel.attrs.wrap === 'inline' || sel.attrs.wrap === 'square' || sel.attrs.wrap === 'tight') && (
            <div className="px-1 py-1">
              <Seg<ImageAlign>
                aria="Image alignment"
                value={sel.attrs.align}
                onPick={(v) => patch({ align: v })}
                options={[
                  { v: 'left', label: 'Left', tip: 'Align image left' },
                  { v: 'center', label: 'Center', tip: 'Center image' },
                  { v: 'right', label: 'Right', tip: 'Align image right' }
                ]}
              />
            </div>
          )}
          {(sel.attrs.wrap === 'behind' || sel.attrs.wrap === 'front') && (
            <>
              <Row label="Position X" tip="Horizontal position as percent of page width. Drag the image or use arrows.">
                <input aria-label="Position X percent" type="range" min={0} max={100} value={Math.round(sel.attrs.posX * 100)} onChange={(e) => patch({ posX: Number(e.target.value) / 100 })} className="w-28" />
                <span className="w-9 text-right tabular-nums">{Math.round(sel.attrs.posX * 100)}%</span>
              </Row>
              <Row label="Position Y" tip="Vertical position as percent of page height.">
                <input aria-label="Position Y percent" type="range" min={0} max={100} value={Math.round(sel.attrs.posY * 100)} onChange={(e) => patch({ posY: Number(e.target.value) / 100 })} className="w-28" />
                <span className="w-9 text-right tabular-nums">{Math.round(sel.attrs.posY * 100)}%</span>
              </Row>
              <Row label="Layer order" tip="Bring forward or send backward among floating images.">
                <span className="flex gap-1">
                  <button onClick={() => patch({ z: sel.attrs.z - 1 })} title="Send backward" aria-label="Send backward" className="rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-100 dark:border-neutral-600">−</button>
                  <span className="w-6 text-center tabular-nums">{sel.attrs.z}</span>
                  <button onClick={() => patch({ z: sel.attrs.z + 1 })} title="Bring forward" aria-label="Bring forward" className="rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-100 dark:border-neutral-600">+</button>
                </span>
              </Row>
            </>
          )}
          <div className="flex gap-1 px-1 py-1">
            <button onClick={() => editor?.commands.groupWithNext()} title="Group this image with the next image into a grid" className="flex-1 rounded border border-neutral-300 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">Group →</button>
            <button onClick={() => editor?.commands.ungroupSelected()} title="Ungroup the selected image grid" className="flex-1 rounded border border-neutral-300 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">Ungroup</button>
          </div>

          <div className={secTitle}>Picture style</div>
          <Row label="Border" tip="Outline around the image frame.">
            <input type="checkbox" aria-label="Border enabled" checked={!!sel.attrs.border} onChange={(e) => patch({ border: e.target.checked ? { color: '#2B579A', width: 2, style: 'solid' } : null })} />
          </Row>
          {sel.attrs.border && (
            <div className="flex items-center gap-1 px-1 py-1">
              <input type="color" aria-label="Border colour" title="Border colour" value={sel.attrs.border.color} onChange={(e) => patch({ border: { ...sel.attrs.border!, color: e.target.value } })} className="h-7 w-9 cursor-pointer" />
              <input type="number" aria-label="Border width in pixels" title="Border width (px)" min={1} max={20} value={sel.attrs.border.width} onChange={(e) => patch({ border: { ...sel.attrs.border!, width: Number(e.target.value) || 1 } })} className={`${inputCls} w-14`} />
              <select aria-label="Border style" title="Border style" value={sel.attrs.border.style} onChange={(e) => patch({ border: { ...sel.attrs.border!, style: e.target.value as BorderStyle } })} className={inputCls}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="double">Double</option>
              </select>
            </div>
          )}
          <Row label="Rounded corners" tip="Corner radius in pixels.">
            <input aria-label="Corner radius" type="range" min={0} max={120} value={sel.attrs.radius} onChange={(e) => patch({ radius: Number(e.target.value) })} className="w-28" />
            <span className="w-9 text-right tabular-nums">{sel.attrs.radius}</span>
          </Row>
          <Row label="Drop shadow" tip="Soft shadow under the image frame.">
            <input type="checkbox" aria-label="Drop shadow" checked={sel.attrs.shadow} onChange={(e) => patch({ shadow: e.target.checked })} />
          </Row>
          <Row label="Reflection" tip="Mirror reflection below the image.">
            <input type="checkbox" aria-label="Reflection" checked={sel.attrs.reflection} onChange={(e) => patch({ reflection: e.target.checked })} />
          </Row>

          <div className={secTitle}>Content</div>
          <div className="space-y-1.5 px-1 py-1">
            <button onClick={onOpenEditor} title="Open the built-in editor: adjust, filters, annotate (double-click the image works too)" className="w-full rounded bg-[#2B579A] py-1 text-[12px] text-white hover:bg-[#1F3F70]">Edit image…</button>
            <button onClick={onOpenSmart} title="Smart tools: remove background, OCR, AI alt text, generate, stock photos, icons" className="w-full rounded border border-[#2B579A] py-1 text-[12px] text-[#2B579A] hover:bg-[#D6E4F7] dark:text-sky-200">Smart tools…</button>
            <label className="block text-[12px]" title="Caption shown under the image and exported to Word.">
              <span className="text-neutral-600 dark:text-neutral-300">Caption</span>
              <input aria-label="Image caption" value={sel.attrs.caption} onChange={(e) => patch({ caption: e.target.value })} placeholder="Add a caption…" className={`${inputCls} mt-0.5 w-full`} />
            </label>
            <label className="block text-[12px]" title="Alt text for screen readers. Also stored in exported Word files.">
              <span className="text-neutral-600 dark:text-neutral-300">Alt text</span>
              <input aria-label="Image alt text" value={sel.attrs.alt} onChange={(e) => patch({ alt: e.target.value })} placeholder="Describe the image…" className={`${inputCls} mt-0.5 w-full`} />
            </label>
            <button onClick={() => fileRef.current?.click()} title="Replace with another image file (size and style are kept)" className="w-full rounded border border-neutral-300 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">Replace image…</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Replacement image file" onChange={(e) => { void doReplace(e.target.files?.[0]); e.target.value = '' }} />
            <button onClick={doReset} disabled={!sel.attrs.originalSrc} title="Restore the original pixels and clear crop, rotation and edits" className="w-full rounded border border-neutral-300 py-1 text-[12px] hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-600 dark:hover:bg-neutral-700">Reset to original</button>
            <div title="Re-encode the current pixels as JPEG to shrink the document. The master copy is kept for Reset.">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-neutral-600 dark:text-neutral-300">Compress (JPEG {quality}%)</span>
                <button onClick={doCompress} title={`Compress now at ${quality}% quality`} className="rounded bg-[#2B579A] px-2 py-0.5 text-white">Apply</button>
              </div>
              <input aria-label="JPEG quality" type="range" min={30} max={95} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="mt-1 w-full" />
            </div>
            {busy && <p role="status" className="text-[12px] text-neutral-500">{busy}</p>}
          </div>
        </div>
      )}
    </aside>
  )
}
