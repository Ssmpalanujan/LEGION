import { useEffect } from 'react'

// Privacy-enhanced YouTube embed, lazy-loaded via click-to-play facade.
export function TrailerModal({ title, youtubeKey, onClose }: { title: string; youtubeKey: string | null; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${title} trailer`}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{title} — Trailer</strong>
          <button onClick={onClose} aria-label="Close trailer">
            ✕
          </button>
        </div>
        {youtubeKey ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0`}
            title={`${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <p style={{ padding: '2rem', color: 'var(--muted)' }}>No trailer available for this title yet.</p>
        )}
      </div>
    </div>
  )
}
