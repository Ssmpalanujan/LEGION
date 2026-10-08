import { useEffect, useState } from 'react'

// Hybrid slider: Content <-> Collaborative. Debounced refetch via onChange(alpha).
export function HybridSlider({ value, onChange }: { value: number; onChange: (alpha: number) => void }) {
  const [local, setLocal] = useState(value)

  useEffect(() => setLocal(value), [value])

  useEffect(() => {
    if (local === value) return
    const t = setTimeout(() => onChange(local), 400)
    return () => clearTimeout(t)
  }, [local, value, onChange])

  return (
    <div className="slider-row" data-testid="hybrid-slider">
      <span>Content</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        aria-label="Hybrid mix: content versus collaborative"
        aria-valuetext={`${Math.round(local * 100)} percent content`}
      />
      <span>Collaborative</span>
      <strong>{Math.round(local * 100)}% content</strong>
    </div>
  )
}
