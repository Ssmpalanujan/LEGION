/** Non-destructive image editor state: adjustments, presets, vector annotations. */

export interface FilterState {
  brightness: number // -100..100 (% offset)
  contrast: number // -100..100
  saturation: number // -100..100 (0 = normal)
  exposure: number // -2..2 EV
  sharpness: number // 0..100
  blur: number // 0..20 px
  temperature: number // -100..100 (amber <-> blue)
  tint: number // -100..100 (green <-> magenta)
  hue: number // -180..180 deg
}

export const DEFAULT_FILTERS: FilterState = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  sharpness: 0,
  blur: 0,
  temperature: 0,
  tint: 0,
  hue: 0
}

export type FilterPresetId = 'none' | 'bw' | 'sepia' | 'vintage' | 'cool' | 'warm'

export const FILTER_PRESETS: { id: FilterPresetId; label: string; tip: string; values: Partial<FilterState> }[] = [
  { id: 'none', label: 'Normal', tip: 'No filter', values: { ...DEFAULT_FILTERS } },
  { id: 'bw', label: 'B&W', tip: 'Black and white', values: { saturation: -100, contrast: 10 } },
  { id: 'sepia', label: 'Sepia', tip: 'Warm sepia tone', values: { saturation: -60, temperature: 45, tint: 10, contrast: 5 } },
  { id: 'vintage', label: 'Vintage', tip: 'Faded film look', values: { saturation: -25, contrast: -15, brightness: 8, temperature: 30 } },
  { id: 'cool', label: 'Cool', tip: 'Cool blue cast', values: { temperature: -45, tint: -5, saturation: 8 } },
  { id: 'warm', label: 'Warm', tip: 'Warm golden cast', values: { temperature: 40, saturation: 12, brightness: 4 } }
]

export type AnnotationTool = 'pen' | 'highlighter' | 'arrow' | 'rect' | 'circle' | 'text' | 'redact'

export interface StrokeAnnotation {
  kind: 'stroke'
  tool: 'pen' | 'highlighter'
  color: string
  width: number
  points: { x: number; y: number }[] // fractions of image 0..1
}

export interface ShapeAnnotation {
  kind: 'shape'
  tool: 'arrow' | 'rect' | 'circle'
  color: string
  width: number
  x: number
  y: number
  w: number
  h: number // fractions of image 0..1
}

export interface TextAnnotation {
  kind: 'text'
  color: string
  size: number // px at natural resolution
  x: number
  y: number // fractions of image 0..1 (anchor top-left)
  text: string
}

export interface RedactAnnotation {
  kind: 'redact'
  mode: 'blur' | 'pixel'
  x: number
  y: number
  w: number
  h: number // fractions of image 0..1
}

export type Annotation = StrokeAnnotation | ShapeAnnotation | TextAnnotation | RedactAnnotation

export interface ImageEdits {
  version: 1
  filters: FilterState
  annotations: Annotation[]
}

export const EMPTY_EDITS: ImageEdits = { version: 1, filters: { ...DEFAULT_FILTERS }, annotations: [] }

export function parseEdits(json: string): ImageEdits {
  if (!json) return structuredClone(EMPTY_EDITS)
  try {
    const v = JSON.parse(json) as Partial<ImageEdits>
    if (!v || typeof v !== 'object') return structuredClone(EMPTY_EDITS)
    return {
      version: 1,
      filters: { ...DEFAULT_FILTERS, ...(v.filters ?? {}) },
      annotations: Array.isArray(v.annotations) ? (v.annotations as Annotation[]) : []
    }
  } catch {
    return structuredClone(EMPTY_EDITS)
  }
}
