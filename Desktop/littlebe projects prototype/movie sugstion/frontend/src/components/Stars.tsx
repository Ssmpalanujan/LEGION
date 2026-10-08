export function Stars({ value = 0, max = 5 }: { value?: number; max?: number }) {
  const full = Math.round((value / 10) * max * 2) / 2
  return (
    <span className="stars" role="img" aria-label={`Rated ${value} out of 10`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i}>{i < Math.round((full / max) * max) ? '★' : '☆'}</span>
      ))}
    </span>
  )
}

// Simpler deterministic star row from a 0..5 scale value
export function StarRow({ value = 0 }: { value?: number }) {
  return (
    <span className="stars" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < Math.round(value) ? '★' : '☆'}</span>
      ))}
    </span>
  )
}
