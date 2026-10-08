const MOODS = ['Happy', 'Sad', 'Bored', 'Romantic', 'Thrilling', 'Family']

export function GenreTile({ name, onPick }: { name: string; onPick: (name: string) => void }) {
  return (
    <button className="tile" onClick={() => onPick(name)} aria-label={`Browse ${name}`}>
      {name}
    </button>
  )
}

export function MoodTiles({ onPick }: { onPick: (mood: string) => void }) {
  return (
    <div className="tiles">
      {MOODS.map((m) => (
        <GenreTile key={m} name={m} onPick={onPick} />
      ))}
    </div>
  )
}
