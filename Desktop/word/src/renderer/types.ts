export interface DocTab {
  id: number
  name: string
  path: string | null
  html: string
  dirty: boolean
}

export type PageSize = 'A4' | 'Letter' | 'Legal'
export type Orientation = 'portrait' | 'landscape'
export type MarginsPreset = 'normal' | 'narrow' | 'wide'
export type ViewMode = 'print' | 'read' | 'web'

export interface PageSettings {
  size: PageSize
  orientation: Orientation
  margins: MarginsPreset
  columns: number
  showHeaderFooter: boolean
  showPageNumbers: boolean
  watermark?: string
  pageBorder?: 'none' | 'single' | 'double'
  dropCapPara?: boolean
}

export const PAGE_MM: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 }
}

export const MARGIN_MM: Record<MarginsPreset, number> = {
  narrow: 12.7,
  normal: 25.4,
  wide: 38.1
}

export interface DocComment {
  id: string
  quote: string
  body: string
  replies: { body: string; at: number }[]
  resolved: boolean
  at: number
}

export interface StyleDef {
  id: string
  name: string
  builtin?: 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'title' | 'quote' | 'code'
  fontFamily: string
  fontSize: string
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right' | 'justify'
}

export const BUILTIN_STYLES: StyleDef[] = [
  { id: 'normal', name: 'Normal', builtin: 'normal', fontFamily: 'Default', fontSize: '11', color: '', bold: false, italic: false, align: 'left' },
  { id: 'h1', name: 'Heading 1', builtin: 'h1', fontFamily: 'Default', fontSize: '24', color: '#2B579A', bold: true, italic: false, align: 'left' },
  { id: 'h2', name: 'Heading 2', builtin: 'h2', fontFamily: 'Default', fontSize: '18', color: '#2B579A', bold: true, italic: false, align: 'left' },
  { id: 'h3', name: 'Heading 3', builtin: 'h3', fontFamily: 'Default', fontSize: '14', color: '#2B579A', bold: true, italic: false, align: 'left' },
  { id: 'h4', name: 'Heading 4', builtin: 'h4', fontFamily: 'Default', fontSize: '12', color: '#2B579A', bold: true, italic: false, align: 'left' },
  { id: 'h5', name: 'Heading 5', builtin: 'h5', fontFamily: 'Default', fontSize: '11', color: '#2B579A', bold: true, italic: false, align: 'left' },
  { id: 'h6', name: 'Heading 6', builtin: 'h6', fontFamily: 'Default', fontSize: '11', color: '#595959', bold: true, italic: false, align: 'left' },
  { id: 'title', name: 'Title', builtin: 'title', fontFamily: 'Default', fontSize: '32', color: '#2B579A', bold: true, italic: false, align: 'left' },
  { id: 'quote', name: 'Quote', builtin: 'quote', fontFamily: 'Default', fontSize: '11', color: '#595959', bold: false, italic: true, align: 'left' },
  { id: 'code', name: 'Code', builtin: 'code', fontFamily: 'Courier New', fontSize: '10', color: '', bold: false, italic: false, align: 'left' }
]

export interface Snapshot {
  id: string
  at: number
  html: string
  label: string
}

export interface AppSettings {
  defaultFont: string
  defaultSize: string
  autosaveSec: number
  language: string
  theme: 'light' | 'dark'
  wordGoal: number
}
export function pageDims(ps: PageSettings): { w: number; h: number; pad: number } {
  const base = PAGE_MM[ps.size]
  const portrait = ps.orientation === 'portrait'
  return {
    w: portrait ? base.w : base.h,
    h: portrait ? base.h : base.w,
    pad: MARGIN_MM[ps.margins]
  }
}
