/** Custom Tiptap image node (`atlasImage`) + group node (`imageGroup`) with full formatting attrs. */

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { AtlasImageAttrs, CropBox, ImageBorder, WrapMode, ImageAlign, CropShape } from './types'
import { DEFAULT_ATLAS_ATTRS, ATLAS_META_VERSION, type AtlasMeta } from './types'
import { ImageNodeView } from './ImageNodeView'

export const ATLAS_IMAGE = 'atlasImage'
export const IMAGE_GROUP = 'imageGroup'

const f4 = (v: number) => Math.round(v * 10000) / 10000

function parseCrop(v: string | null): CropBox | null {
  if (!v) return null
  const p = v.split(',').map(Number)
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return null
  const [x, y, w, h] = p
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

function parseBorder(v: string | null): ImageBorder | null {
  if (!v) return null
  const [color, width, style] = v.split('|')
  if (!color) return null
  return { color, width: Number(width) || 2, style: (style as ImageBorder['style']) || 'solid' }
}

const num = (v: string | null, fallback: number): number => {
  const n = Number(v)
  return v === null || Number.isNaN(n) ? fallback : n
}
const bool = (v: string | null, fallback: boolean): boolean => {
  if (v === null) return fallback
  return v === '1' || v === 'true'
}

/** Read our data-* attributes (or a legacy <img>) into node attrs. */
export function attrsFromElement(el: HTMLElement): Partial<AtlasImageAttrs> {
  if (el.tagName.toLowerCase() === 'img') {
    const img = el as HTMLImageElement
    // Round-trip payload written by docx export lives in alt text (keeps human text after it)
    const { meta, text } = splitAlt(img.getAttribute('alt') ?? '')
    const layout = meta ? metaFromAlt(JSON.stringify(meta)) : null
    const w = num(img.getAttribute('width'), 0)
    return {
      ...DEFAULT_ATLAS_ATTRS,
      src: img.getAttribute('src') ?? '',
      originalSrc: img.getAttribute('src') ?? '',
      alt: text,
      width: w > 0 ? w : (layout?.width ?? null),
      naturalWidth: num(img.getAttribute('data-nw'), w),
      naturalHeight: num(img.getAttribute('data-nh'), 0),
      ...(layout ?? {})
    }
  }
  return {
    src: el.getAttribute('data-src') ?? '',
    originalSrc: el.getAttribute('data-original') ?? el.getAttribute('data-src') ?? '',
    alt: el.getAttribute('data-alt') ?? '',
    caption: el.getAttribute('data-caption') ?? '',
    width: el.hasAttribute('data-width') ? num(el.getAttribute('data-width'), 0) || null : null,
    lockAspect: bool(el.getAttribute('data-lock'), true),
    naturalWidth: num(el.getAttribute('data-nw'), 0),
    naturalHeight: num(el.getAttribute('data-nh'), 0),
    rotation: ([0, 90, 180, 270] as const).includes(Number(el.getAttribute('data-rot')) as 0 | 90 | 180 | 270)
      ? (Number(el.getAttribute('data-rot')) as 0 | 90 | 180 | 270)
      : 0,
    flipH: bool(el.getAttribute('data-fliph'), false),
    flipV: bool(el.getAttribute('data-flipv'), false),
    wrap: (el.getAttribute('data-wrap') as WrapMode) || 'inline',
    align: (el.getAttribute('data-align') as ImageAlign) || 'center',
    posX: num(el.getAttribute('data-px'), 0.5),
    posY: num(el.getAttribute('data-py'), 0.2),
    z: num(el.getAttribute('data-z'), 1),
    crop: parseCrop(el.getAttribute('data-crop')),
    cropShape: (el.getAttribute('data-cropshape') as CropShape) || 'rect',
    border: parseBorder(el.getAttribute('data-border')),
    radius: num(el.getAttribute('data-radius'), 0),
    shadow: bool(el.getAttribute('data-shadow'), false),
    reflection: bool(el.getAttribute('data-reflection'), false),
    editsJson: el.getAttribute('data-edits') ?? ''
  }
}

/** Serialize node attrs back to data-* attributes for stable HTML persistence. */
export function attrsToDataAttrs(a: AtlasImageAttrs): Record<string, string> {
  const d: Record<string, string> = {
    'data-atlas-image': '',
    'data-src': a.src,
    'data-nw': String(a.naturalWidth),
    'data-nh': String(a.naturalHeight)
  }
  if (a.originalSrc && a.originalSrc !== a.src) d['data-original'] = a.originalSrc
  if (a.alt) d['data-alt'] = a.alt
  if (a.caption) d['data-caption'] = a.caption
  if (a.width != null) d['data-width'] = String(Math.round(a.width))
  if (!a.lockAspect) d['data-lock'] = '0'
  if (a.rotation) d['data-rot'] = String(a.rotation)
  if (a.flipH) d['data-fliph'] = '1'
  if (a.flipV) d['data-flipv'] = '1'
  if (a.wrap !== 'inline') d['data-wrap'] = a.wrap
  if (a.align !== 'center') d['data-align'] = a.align
  if (a.wrap === 'behind' || a.wrap === 'front') {
    d['data-px'] = String(f4(a.posX))
    d['data-py'] = String(f4(a.posY))
    if (a.z !== 1) d['data-z'] = String(a.z)
  }
  if (a.crop) d['data-crop'] = [a.crop.x, a.crop.y, a.crop.w, a.crop.h].map(f4).join(',')
  if (a.cropShape !== 'rect') d['data-cropshape'] = a.cropShape
  if (a.border) d['data-border'] = `${a.border.color}|${a.border.width}|${a.border.style}`
  if (a.radius) d['data-radius'] = String(a.radius)
  if (a.shadow) d['data-shadow'] = '1'
  if (a.reflection) d['data-reflection'] = '1'
  if (a.editsJson) d['data-edits'] = a.editsJson
  return d
}

/** Extract raw atlas layout JSON from the start of an alt string (brace-scan, nesting-safe). */
function extractMeta(alt: string): { meta: AtlasMeta; rest: string } | null {
  const t = alt.trimStart()
  if (!t.startsWith('{')) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
    } else if (ch === '"') {
      inStr = true
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          const m = JSON.parse(t.slice(0, i + 1)) as AtlasMeta
          if (!m || m.atlas !== ATLAS_META_VERSION) return null
          return { meta: m, rest: t.slice(i + 1).trimStart() }
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/** Parse raw atlas layout JSON (exported via docx alt text). Null when absent/invalid. */
export function atlasMetaJson(alt: string): AtlasMeta | null {
  return extractMeta(alt)?.meta ?? null
}

/** Decode the layout payload embedded in docx alt text (written on export). */
export function metaFromAlt(alt: string): Partial<AtlasImageAttrs> | null {
  const found = extractMeta(alt)
  if (!found) return null
  {
    const m = found.meta
    const out: Partial<AtlasImageAttrs> = {}
    if (m.w !== undefined) out.width = m.w
    if (m.rot !== undefined) out.rotation = m.rot as AtlasImageAttrs['rotation']
    if (m.fh !== undefined) out.flipH = m.fh
    if (m.fv !== undefined) out.flipV = m.fv
    if (m.wrap) out.wrap = m.wrap
    if (m.al) out.align = m.al
    if (m.px !== undefined) out.posX = m.px
    if (m.py !== undefined) out.posY = m.py
    if (m.z !== undefined) out.z = m.z
    if (m.crop !== undefined) out.crop = m.crop
    if (m.cs) out.cropShape = m.cs
    return out
  }
}

/** Encode layout attrs for docx alt text (only when they differ from defaults). */
export function metaToAlt(a: AtlasImageAttrs): string {
  const d = DEFAULT_ATLAS_ATTRS
  const m: AtlasMeta = { atlas: ATLAS_META_VERSION }
  let dirty = false
  const put = <K extends keyof AtlasMeta>(k: K, v: AtlasMeta[K], isDefault: boolean) => {
    if (!isDefault) {
      m[k] = v
      dirty = true
    }
  }
  put('w', a.width ?? null, (a.width ?? null) === d.width)
  put('rot', a.rotation, a.rotation === d.rotation)
  put('fh', a.flipH, a.flipH === d.flipH)
  put('fv', a.flipV, a.flipV === d.flipV)
  put('wrap', a.wrap, a.wrap === d.wrap)
  put('al', a.align, a.align === d.align)
  put('px', f4(a.posX), a.posX === d.posX)
  put('py', f4(a.posY), a.posY === d.posY)
  put('z', a.z, a.z === d.z)
  put('crop', a.crop, JSON.stringify(a.crop) === JSON.stringify(d.crop))
  put('cs', a.cropShape, a.cropShape === d.cropShape)
  if (!dirty) return a.alt
  // Human alt text is preserved after a separator so screen readers still work
  return a.alt ? `${JSON.stringify(m)} ${a.alt}` : JSON.stringify(m)
}

/** Split an alt string back into atlas meta + human text (import path). */
export function splitAlt(alt: string): { meta: AtlasMeta | null; text: string } {
  const found = extractMeta(alt)
  if (!found) return { meta: null, text: alt }
  return { meta: found.meta, text: found.rest }
}

export const AtlasImage = Node.create({
  name: ATLAS_IMAGE,
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      originalSrc: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      width: { default: null },
      lockAspect: { default: true },
      naturalWidth: { default: 0 },
      naturalHeight: { default: 0 },
      rotation: { default: 0 },
      flipH: { default: false },
      flipV: { default: false },
      wrap: { default: 'inline' },
      align: { default: 'center' },
      posX: { default: 0.5 },
      posY: { default: 0.2 },
      z: { default: 1 },
      crop: { default: null },
      cropShape: { default: 'rect' },
      border: { default: null },
      radius: { default: 0 },
      shadow: { default: false },
      reflection: { default: false },
      editsJson: { default: '' }
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-atlas-image]' }, { tag: 'img' }]
  },

  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes as unknown as AtlasImageAttrs
    const img: Record<string, string> = { src: a.src, alt: a.alt, loading: 'lazy' }
    if (a.width != null) img.width = String(Math.round(a.width))
    const caption = a.caption
      ? ['figcaption', { class: 'atlas-caption' }, a.caption]
      : null
    const parts: unknown[] = [['img', img]]
    if (caption) parts.push(caption)
    return ['figure', mergeAttributes({ class: 'atlas-figure' }, attrsToDataAttrs(a)), ...parts]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },

  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insertAtlasImage: (attrs: Partial<AtlasImageAttrs>) => ({ chain }: any) =>
        chain()
          .focus()
          .insertContent({ type: ATLAS_IMAGE, attrs: { ...DEFAULT_ATLAS_ATTRS, ...attrs } })
          .run(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateAtlasImage: (patch: Partial<AtlasImageAttrs>) => ({ tr, state, dispatch }: any) => {
        const { selection } = state
        if (selection instanceof NodeSelection && selection.node.type.name === ATLAS_IMAGE) {
          tr.setNodeMarkup(selection.from, undefined, { ...selection.node.attrs, ...patch })
          if (dispatch) dispatch(tr)
          return true
        }
        return false
      }
    }
  }
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    atlasImage: {
      insertAtlasImage: (attrs: Partial<AtlasImageAttrs>) => ReturnType
      updateAtlasImage: (patch: Partial<AtlasImageAttrs>) => ReturnType
    }
    imageGroup: {
      groupWithNext: () => ReturnType
      ungroupSelected: () => ReturnType
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function selectedAtlasImage(editor: any): { pos: number; node: any } | null {
  const { selection, doc } = editor.state
  if (selection instanceof NodeSelection && selection.node.type.name === ATLAS_IMAGE) {
    return { pos: selection.from, node: selection.node }
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setAtlasAttrsAt(editor: any, pos: number, patch: Partial<AtlasImageAttrs>): void {
  const node = editor.state.doc.nodeAt(pos)
  if (!node || node.type.name !== ATLAS_IMAGE) return
  const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch })
  editor.view.dispatch(tr)
}

export interface ScannedImage {
  pos: number
  src: string
  alt: string
  naturalWidth: number
  naturalHeight: number
  crop: AtlasImageAttrs['crop']
  cropShape: AtlasImageAttrs['cropShape']
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scanDocumentImages(editor: any): ScannedImage[] {
  const out: ScannedImage[] = []
  editor.state.doc.descendants((node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => {
    if (node.type.name !== ATLAS_IMAGE) return
    const a = node.attrs as unknown as AtlasImageAttrs
    if (!a.src) return
    out.push({ pos, src: a.src, alt: a.alt || `Image ${out.length + 1}`, naturalWidth: a.naturalWidth, naturalHeight: a.naturalHeight, crop: a.crop, cropShape: a.cropShape })
  })
  return out
}

/* ---------------- Image group (collage / grouping container) ---------------- */

export const ImageGroup = Node.create({
  name: IMAGE_GROUP,
  group: 'block',
  content: `${ATLAS_IMAGE}+`,
  defining: true,
  addAttributes() {
    return { columns: { default: 2 } }
  },
  parseHTML() {
    return [{ tag: 'div[data-image-group]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const cols = Number((HTMLAttributes as { columns?: number }).columns ?? 2)
    return [
      'div',
      {
        'data-image-group': '',
        class: 'atlas-group',
        style: `display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;margin:12px 0;`
      },
      0
    ]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      groupWithNext: () => ({ tr, state, dispatch }: any) => {
        const { selection } = state
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== ATLAS_IMAGE) return false
        const next = state.doc.nodeAt(selection.to)
        if (!next || next.type.name !== ATLAS_IMAGE) return false
        const group = state.schema.nodes[IMAGE_GROUP].create({ columns: 2 }, [selection.node, next])
        tr.replaceWith(selection.from, selection.to + next.nodeSize, group)
        if (dispatch) dispatch(tr)
        return true
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ungroupSelected: () => ({ tr, state, dispatch }: any) => {
        const { $from } = state.selection
        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d)
          if (node.type.name === IMAGE_GROUP) {
            const from = $from.before(d)
            const kids: { nodeSize: number }[] = []
            node.forEach((child: { nodeSize: number }) => {
              kids.push(child)
            })
            tr.replaceWith(from, from + node.nodeSize, kids as never)
            if (dispatch) dispatch(tr)
            return true
          }
        }
        return false
      }
    }
  }
})
