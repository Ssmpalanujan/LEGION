/** Photo grid / collage layouts built on the `imageGroup` container node. */

export interface CollageLayout {
  id: string
  label: string
  tip: string
  columns: number
  slots: number
}

export const COLLAGE_LAYOUTS: CollageLayout[] = [
  { id: '2x1', label: '2 across', tip: 'Two images side by side', columns: 2, slots: 2 },
  { id: '3x1', label: '3 across', tip: 'Three images in a row', columns: 3, slots: 3 },
  { id: '2x2', label: '2 × 2', tip: 'Four images in a square grid', columns: 2, slots: 4 },
  { id: '1x2', label: '2 stacked', tip: 'Two images stacked vertically', columns: 1, slots: 2 },
  { id: '1x3', label: '3 stacked', tip: 'Three images stacked vertically', columns: 1, slots: 3 },
  { id: '3x2', label: '3 × 2', tip: 'Six images in a gallery grid', columns: 3, slots: 6 }
]

export function collageLayout(id: string): CollageLayout {
  return COLLAGE_LAYOUTS.find((l) => l.id === id) ?? COLLAGE_LAYOUTS[0]
}

/** Picture style presets: one-click border/shadow/radius/reflection combos. */
export interface PictureStyle {
  id: string
  label: string
  tip: string
  patch: {
    border: { color: string; width: number; style: 'solid' | 'dashed' | 'dotted' | 'double' } | null
    radius: number
    shadow: boolean
    reflection: boolean
  }
}

export const PICTURE_STYLES: PictureStyle[] = [
  { id: 'none', label: 'None', tip: 'No frame', patch: { border: null, radius: 0, shadow: false, reflection: false } },
  { id: 'framed', label: 'Framed', tip: 'Thin dark frame', patch: { border: { color: '#1f2937', width: 2, style: 'solid' }, radius: 0, shadow: false, reflection: false } },
  { id: 'rounded', label: 'Rounded', tip: 'Rounded corners', patch: { border: null, radius: 24, shadow: false, reflection: false } },
  { id: 'shadow', label: 'Shadow', tip: 'Soft drop shadow', patch: { border: null, radius: 6, shadow: true, reflection: false } },
  { id: 'polaroid', label: 'Polaroid', tip: 'Thick white frame with shadow', patch: { border: { color: '#ffffff', width: 10, style: 'solid' }, radius: 2, shadow: true, reflection: false } },
  { id: 'mirror', label: 'Mirror', tip: 'Reflection below the picture', patch: { border: null, radius: 0, shadow: false, reflection: true } },
  { id: 'dashed', label: 'Dashed', tip: 'Dashed accent frame', patch: { border: { color: '#2B579A', width: 3, style: 'dashed' }, radius: 8, shadow: false, reflection: false } },
  { id: 'gallery', label: 'Gallery', tip: 'Rounded frame with shadow', patch: { border: { color: '#2B579A', width: 3, style: 'solid' }, radius: 12, shadow: true, reflection: false } }
]
