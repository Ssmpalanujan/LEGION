/** Webcam capture (getUserMedia) → preview → insert into the document. */

import { useEffect, useRef, useState } from 'react'
import { Modal } from '../../components/Dialogs'

interface WebcamModalProps {
  onCapture: (dataUrl: string) => void
  onClose: () => void
}

export function WebcamModal({ onCapture, onClose }: WebcamModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState('')
  const [shot, setShot] = useState('')

  useEffect(() => {
    let s: MediaStream | null = null
    let alive = true
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((st) => {
        if (!alive) {
          st.getTracks().forEach((t) => t.stop())
          return
        }
        s = st
        setStream(st)
        if (videoRef.current) videoRef.current.srcObject = st
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
      })
    return () => {
      alive = false
      s?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (stream && videoRef.current && !shot) videoRef.current.srcObject = stream
  }, [stream, shot])

  const take = () => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0)
    setShot(c.toDataURL('image/png'))
  }

  return (
    <Modal title="Take a photo" onClose={onClose}>
      {error ? (
        <p role="alert" className="py-4 text-center text-[13px] text-red-600">
          Camera unavailable: {error}
          <br />
          <span className="text-neutral-500">Allow camera access for WordPad Pro when asked.</span>
        </p>
      ) : !stream ? (
        <p role="status" className="py-4 text-center text-[13px] text-neutral-500">
          Starting camera…
        </p>
      ) : shot ? (
        <>
          <img src={shot} alt="Captured photo preview" className="max-h-64 w-full rounded border border-neutral-300 object-contain" />
          <div className="mt-2 flex gap-2">
            <button onClick={() => onCapture(shot)} title="Insert this photo into the document" className="flex-1 rounded bg-[#2B579A] py-1.5 text-[13px] text-white">
              Insert photo
            </button>
            <button onClick={() => setShot('')} title="Discard and take another" className="rounded border border-neutral-300 px-4 py-1.5 text-[13px]">
              Retake
            </button>
          </div>
        </>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="max-h-64 w-full rounded border border-neutral-300 bg-black" aria-label="Camera preview" />
          <button onClick={take} title="Capture the current frame" className="mt-2 w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white">
            Capture
          </button>
        </>
      )}
    </Modal>
  )
}
