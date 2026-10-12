/** Export a document picture as PNG / JPG / WebP (crop baked in, optional downscale). */

import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Modal } from '../../components/Dialogs'
import { scanDocumentImages, type ScannedImage } from './imageNode'
import { buildExportPlan, renderCroppedBytes, type ExportFormat } from './export'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = typeof window !== 'undefined' ? ((window as any).electron as any | undefined) : undefined

interface ExportImageModalProps {
  editor: Editor | null
  initialPos: number | null
  onClose: () => void
}

export function ExportImageModal({ editor, initialPos, onClose }: ExportImageModalProps) {
  const images: ScannedImage[] = editor ? scanDocumentImages(editor) : []
  const [selPos, setSelPos] = useState<number | null>(initialPos ?? images[0]?.pos ?? null)
  const [format, setFormat] = useState<ExportFormat>('png')
  const [quality, setQuality] = useState(90)
  const [scale, setScale] = useState(100)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const sel = images.find((i) => i.pos === selPos) ?? images[0]
  const plan = sel ? buildExportPlan(sel.naturalWidth, sel.naturalHeight, sel.crop, format, quality / 100, (sel.alt || 'image').replace(/[^\w\-]+/g, '-').slice(0, 40)) : null
  const outW = plan ? Math.max(1, Math.round((plan.outWidth * scale) / 100)) : 0
  const outH = plan ? Math.max(1, Math.round((plan.outHeight * scale) / 100)) : 0

  const save = async () => {
    if (!sel || !api) {
      setError(api ? 'Select an image first.' : 'Export needs the desktop app (Electron).')
      return
    }
    setBusy('Rendering…')
    setError('')
    try {
      const base = await renderCroppedBytes(sel.src, sel.crop, sel.cropShape, plan!.mime, plan!.quality)
      let bytes = base.bytes
      let w = base.width
      let h = base.height
      if (scale !== 100) {
        // downscale via canvas
        const blob = new Blob([new Uint8Array(bytes)], { type: base.mime })
        const url = URL.createObjectURL(blob)
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const im = new Image()
            im.onload = () => resolve(im)
            im.onerror = () => reject(new Error('decode failed'))
            im.src = url
          })
          const c = document.createElement('canvas')
          c.width = outW
          c.height = outH
          const ctx = c.getContext('2d')
          if (!ctx) throw new Error('no 2d context')
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, outW, outH)
          const b2: Blob = await new Promise((resolve, reject) => {
            c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), base.mime, plan!.quality)
          })
          bytes = new Uint8Array(await b2.arrayBuffer())
          w = outW
          h = outH
        } finally {
          URL.revokeObjectURL(url)
        }
      }
      void w
      void h
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      }
      const res = await api.saveDialog(plan!.fileName, format)
      if (res.canceled || !res.path) return
      const wr = await api.writeFile(res.path, btoa(bin))
      if (!wr.ok) throw new Error(wr.error ?? 'write failed')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <Modal title="Save picture as…" onClose={onClose}>
      {images.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-neutral-500">No pictures in this document yet.</p>
      ) : (
        <>
          <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300" htmlFor="exp-img">
            Picture
          </label>
          <select
            id="exp-img"
            value={sel?.pos ?? ''}
            onChange={(e) => setSelPos(Number(e.target.value))}
            className="mb-2 w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800"
          >
            {images.map((im, i) => (
              <option key={im.pos} value={im.pos}>
                {i + 1}. {im.alt.slice(0, 40)} ({im.naturalWidth}×{im.naturalHeight})
              </option>
            ))}
          </select>
          {sel && (
            <div className="mb-2 flex items-center gap-3">
              <img src={sel.src} alt="" className="max-h-28 rounded border border-neutral-300" />
              <p className="text-[12px] text-neutral-500">
                Output: {outW} × {outH} px
                <br />
                Crop and rotation from the document are baked in.
              </p>
            </div>
          )}
          <div className="mb-2 flex gap-1.5" role="radiogroup" aria-label="Export format">
            {(['png', 'jpg', 'webp'] as ExportFormat[]).map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
                title={f === 'png' ? 'Lossless, keeps transparency' : f === 'jpg' ? 'Smaller files, no transparency' : 'Modern, small files'}
                className={`flex-1 rounded border py-1 text-[12px] uppercase ${format === f ? 'border-[#2B579A] bg-[#D6E4F7] font-medium' : 'border-neutral-300'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-center gap-2 text-[12px]">
            <label className="flex flex-1 items-center gap-2" title="Output scale relative to the cropped pixels">
              Scale
              <input aria-label="Export scale percent" type="range" min={10} max={100} step={5} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="flex-1" />
              <span className="w-10 text-right tabular-nums">{scale}%</span>
            </label>
          </div>
          {format !== 'png' && (
            <label className="mb-2 flex items-center gap-2 text-[12px]" title="Quality for JPG/WebP">
              Quality
              <input aria-label="Export quality" type="range" min={30} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="flex-1" />
              <span className="w-10 text-right tabular-nums">{quality}</span>
            </label>
          )}
          {error && (
            <p role="alert" className="mb-2 text-[12px] text-red-600">
              {error}
            </p>
          )}
          <button onClick={save} disabled={!!busy} title="Render and save the picture file" className="w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white disabled:opacity-50">
            {busy || 'Save picture…'}
          </button>
        </>
      )}
    </Modal>
  )
}
