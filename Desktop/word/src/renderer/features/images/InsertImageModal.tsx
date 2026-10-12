/** Insert image from URL, file, or screenshot. */

import { useRef, useState } from 'react'
import { Modal } from '../../components/Dialogs'

interface InsertImageModalProps {
  onInsertUrl: (url: string) => void
  onPickFile: (f: File) => void
  onScreenshot: () => void
  screenshotAvailable: boolean
  onClose: () => void
}

export function InsertImageModal({ onInsertUrl, onPickFile, onScreenshot, screenshotAvailable, onClose }: InsertImageModalProps) {
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const submitUrl = () => {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) {
      setUrlError('Enter a full http(s) URL, e.g. https://example.com/photo.jpg')
      return
    }
    onInsertUrl(u)
  }

  return (
    <Modal title="Insert image" onClose={onClose}>
      <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300" htmlFor="img-url">
        Image URL
      </label>
      <div className="flex gap-1.5">
        <input
          id="img-url"
          autoFocus
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setUrlError('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && submitUrl()}
          placeholder="https://…"
          className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800"
        />
        <button onClick={submitUrl} title="Download the image and insert it (downscaled)" className="rounded bg-[#2B579A] px-3 py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
          Insert
        </button>
      </div>
      {urlError && (
        <p role="alert" className="mt-1 text-[12px] text-red-600">
          {urlError}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button onClick={() => fileRef.current?.click()} title="Choose an image file (PNG, JPG, GIF, WebP…)" className="rounded border border-neutral-300 py-1.5 text-[13px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700">
          From file…
        </button>
        <button
          onClick={onScreenshot}
          disabled={!screenshotAvailable}
          title={screenshotAvailable ? 'Capture the primary display and insert it' : 'Screenshots need the desktop app (Electron)'}
          className="rounded border border-neutral-300 py-1.5 text-[13px] hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-600 dark:hover:bg-neutral-700"
        >
          Screenshot…
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Image file"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPickFile(f)
          e.target.value = ''
        }}
      />
      <p className="mt-2 text-[11px] text-neutral-500">Large images are downscaled on insert (max 1920px) to keep documents fast.</p>
    </Modal>
  )
}
