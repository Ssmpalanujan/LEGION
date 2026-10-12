/** Build a photo-grid collage: pick a layout, pick files, insert as an image group. */

import { useState } from 'react'
import { Modal } from '../../components/Dialogs'
import { COLLAGE_LAYOUTS, collageLayout } from './collage'
import { fileToAtlasSources } from './downscale'
import { DEFAULT_ATLAS_ATTRS } from './types'
import type { Editor } from '@tiptap/core'

interface CollageModalProps {
  editor: Editor | null
  onClose: () => void
}

export function CollageModal({ editor, onClose }: CollageModalProps) {
  const [layoutId, setLayoutId] = useState('2x2')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const layout = collageLayout(layoutId)

  const build = async () => {
    if (!editor) return
    if (files.length === 0) {
      setError('Choose at least one image file first.')
      return
    }
    setBusy('Preparing images…')
    setError('')
    try {
      const picked = files.slice(0, layout.slots)
      const nodes = []
      for (const f of picked) {
        const { src, original } = await fileToAtlasSources(f)
        nodes.push({
          type: 'atlasImage',
          attrs: {
            ...DEFAULT_ATLAS_ATTRS,
            src: src.dataUrl,
            originalSrc: original.dataUrl,
            naturalWidth: src.width,
            naturalHeight: src.height,
            width: null,
            wrap: 'inline',
            alt: f.name.replace(/\.[^.]+$/, '')
          }
        })
      }
      editor
        .chain()
        .focus()
        .insertContent({ type: 'imageGroup', attrs: { columns: layout.columns }, content: nodes })
        .run()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <Modal title="Photo grid / collage" onClose={onClose}>
      <div className="mb-1 text-[12px] text-neutral-600 dark:text-neutral-300">Layout (uses the first N files)</div>
      <div className="mb-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Collage layout">
        {COLLAGE_LAYOUTS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={layoutId === l.id}
            onClick={() => setLayoutId(l.id)}
            title={`${l.tip} — ${l.slots} photos`}
            className={`rounded border px-2 py-1.5 text-[12px] ${
              layoutId === l.id
                ? 'border-[#2B579A] bg-[#D6E4F7] font-medium text-[#2B579A] dark:border-sky-500 dark:bg-sky-900 dark:text-sky-200'
                : 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300" htmlFor="collage-files">
        Photos (up to {layout.slots})
      </label>
      <input
        id="collage-files"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className="w-full text-[13px]"
      />
      {files.length > 0 && <p className="mt-1 text-[12px] text-neutral-500">{Math.min(files.length, layout.slots)} of {files.length} selected will be used.</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] text-red-600">
          {error}
        </p>
      )}
      <button onClick={build} disabled={!!busy} title="Insert the collage at the cursor" className="mt-3 w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white disabled:opacity-50">
        {busy || 'Insert collage'}
      </button>
    </Modal>
  )
}
