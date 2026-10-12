/** Shared image feature types for Atlas Write (Phase 1: document handling). */

export type WrapMode = 'inline' | 'square' | 'tight' | 'behind' | 'front'
export type ImageAlign = 'left' | 'center' | 'right'
export type SizeUnit = 'px' | 'cm' | 'pct'
export type CropPreset = 'free' | '1:1' | '4:3' | '16:9' | 'circle'
export type CropShape = 'rect' | 'circle'
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double'

/** Crop box as fractions of the source image (0..1). */
export interface CropBox {
  x: number
  y: number
  w: number
  h: number
}

export interface ImageBorder {
  color: string
  width: number
  style: BorderStyle
}

/** Full attribute set of the `atlasImage` Tiptap node. */
export interface AtlasImageAttrs {
  src: string
  /** Downscaled-but-larger master kept for reset + editor (non-destructive base). */
  originalSrc: string
  alt: string
  caption: string
  /** Display width in CSS px. null = natural/auto. */
  width: number | null
  lockAspect: boolean
  /** Natural pixel size of `src` (used for aspect math + export). */
  naturalWidth: number
  naturalHeight: number
  rotation: 0 | 90 | 180 | 270
  flipH: boolean
  flipV: boolean
  wrap: WrapMode
  align: ImageAlign
  /** Free-position fractions (0..1) relative to the page for behind/front. */
  posX: number
  posY: number
  z: number
  crop: CropBox | null
  cropShape: CropShape
  border: ImageBorder | null
  radius: number
  shadow: boolean
  reflection: boolean
  /** Phase-2 editor state (filter values + annotations), JSON string. */
  editsJson: string
}

export const DEFAULT_ATLAS_ATTRS: AtlasImageAttrs = {
  src: '',
  originalSrc: '',
  alt: '',
  caption: '',
  width: null,
  lockAspect: true,
  naturalWidth: 0,
  naturalHeight: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  wrap: 'inline',
  align: 'center',
  posX: 0.5,
  posY: 0.2,
  z: 1,
  crop: null,
  cropShape: 'rect',
  border: null,
  radius: 0,
  shadow: false,
  reflection: false,
  editsJson: ''
}

/** Compact layout descriptor embedded in docx alt-text for round-tripping. */
export interface AtlasMeta {
  atlas: 1
  w?: number | null
  rot?: number
  fh?: boolean
  fv?: boolean
  wrap?: WrapMode
  al?: ImageAlign
  px?: number
  py?: number
  z?: number
  crop?: CropBox | null
  cs?: CropShape
}

export const ATLAS_META_VERSION = 1

/** Max long-edge (px) for images placed in the document. */
export const MAX_INSERT_EDGE = 1920
/** Max long-edge (px) kept as the non-destructive master. */
export const MAX_ORIGINAL_EDGE = 2560

export type ResizeHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
