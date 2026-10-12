/** Bridge between atlas figures (editor HTML) and .docx ImageRun objects. */

import {
  ImageRun,
  Paragraph,
  TextRun,
  AlignmentType,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  VerticalPositionAlign,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  TextWrappingSide
} from 'docx'
import type { AtlasImageAttrs, ImageAlign } from './types'
import { DEFAULT_ATLAS_ATTRS } from './types'
import { attrsFromElement, metaToAlt, splitAlt } from './imageNode'
import { renderCroppedBytes, dataUrlBytes } from './export'
import { cropToDocxPercent } from './math'

const PX_TO_EMU = 914400 / 96
/** Reference page width for % positions (A4 @96dpi). Export is an approximation. */
const REF_PAGE_PX = 794
const REF_PAGE_PY = 1123

/** Display size in px for export (explicit width or natural; rotation swaps). */
export function exportDisplaySize(a: AtlasImageAttrs): { width: number; height: number } {
  const w = a.width ?? a.naturalWidth ?? 400
  const h = a.width != null && a.naturalWidth > 0 ? (a.width * a.naturalHeight) / a.naturalWidth : (a.naturalHeight || 300)
  const swapped = a.rotation === 90 || a.rotation === 270
  return { width: Math.max(1, Math.round(swapped ? h : w)), height: Math.max(1, Math.round(swapped ? w : h)) }
}

/** Convert one rendered <figure data-atlas-image> into a docx ImageRun. */
export async function atlasFigureToImageRun(el: HTMLElement): Promise<ImageRun | null> {
  const a = { ...DEFAULT_ATLAS_ATTRS, ...attrsFromElement(el) } as AtlasImageAttrs
  if (!a.src) return null
  let bytes: Uint8Array
  let type: 'jpg' | 'png' | 'gif' | 'bmp'
  try {
    const srcMime = dataUrlBytes(a.src).mime
    const direct = srcMime === 'image/jpeg' ? 'jpg' : srcMime === 'image/png' ? 'png' : srcMime === 'image/gif' ? 'gif' : srcMime === 'image/bmp' ? 'bmp' : null
    if (a.crop || !direct) {
      // bake the crop into the exported pixels so every reader shows the crop;
      // also normalizes webp/svg (unsupported by Word) to png (or jpeg for photos)
      const jpegOk = srcMime === 'image/jpeg' && a.cropShape === 'rect'
      const out = await renderCroppedBytes(a.src, a.crop, a.cropShape, jpegOk ? 'image/jpeg' : 'image/png')
      bytes = out.bytes
      type = out.mime === 'image/jpeg' ? 'jpg' : 'png'
    } else {
      bytes = dataUrlBytes(a.src).bytes
      type = direct
    }
  } catch {
    return null
  }
  const size = exportDisplaySize(a)
  const options: Record<string, unknown> = {
    data: bytes,
    type,
    transformation: { width: size.width, height: size.height }
  }
  if (a.flipH || a.flipV) {
    ;(options.transformation as { flip?: { horizontal?: boolean; vertical?: boolean } }).flip = {
      ...(a.flipH ? { horizontal: true } : {}),
      ...(a.flipV ? { vertical: true } : {})
    }
  }
  if (a.crop) {
    const c = cropToDocxPercent(a.crop)
    options.crop = { left: c.left, top: c.top, right: c.right, bottom: c.bottom }
  }
  if (a.border) {
    options.outline = {
      width: Math.round(a.border.width * 9525),
      color: a.border.color.replace('#', ''),
      style: a.border.style
    }
  }
  // layout meta round-trips through alt text (mammoth preserves it on import)
  const altText = metaToAlt(a)
  options.altText = { description: altText.slice(0, 2000), title: a.caption.slice(0, 200) || 'Image' }

  if (a.wrap === 'square' || a.wrap === 'tight') {
    options.floating = {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.COLUMN,
        align: a.align === 'right' ? HorizontalPositionAlign.RIGHT : a.align === 'center' ? HorizontalPositionAlign.CENTER : HorizontalPositionAlign.LEFT
      },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH },
      allowOverlap: true,
      wrap: {
        type: a.wrap === 'tight' ? TextWrappingType.TIGHT : TextWrappingType.SQUARE,
        side: TextWrappingSide.BOTH_SIDES
      },
      zIndex: a.z
    }
  } else if (a.wrap === 'behind' || a.wrap === 'front') {
    options.floating = {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.PAGE,
        offset: Math.round(a.posX * REF_PAGE_PX * PX_TO_EMU)
      },
      verticalPosition: {
        relative: VerticalPositionRelativeFrom.PAGE,
        offset: Math.round(a.posY * REF_PAGE_PY * PX_TO_EMU)
      },
      allowOverlap: true,
      behindDocument: a.wrap === 'behind',
      zIndex: a.z
    }
  }
  return new ImageRun(options as never)
}

/** Wrap an ImageRun in a paragraph (caption becomes a second paragraph). */
export function imageRunParagraphs(run: ImageRun, caption: string, align: ImageAlign): Paragraph[] {  const alignment =
    align === 'center' ? AlignmentType.CENTER : align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
  const out = [new Paragraph({ children: [run], alignment })]
  if (caption) out.push(new Paragraph({ children: [new TextRun({ text: caption, italics: true })], alignment }))
  return out
}

/** Convert a rendered atlas <figure> straight to docx paragraphs (null when undecodable). */
export async function figureToDocxParagraphs(el: HTMLElement): Promise<Paragraph[] | null> {
  const run = await atlasFigureToImageRun(el)
  if (!run) return null
  const a = { ...DEFAULT_ATLAS_ATTRS, ...attrsFromElement(el) } as AtlasImageAttrs
  return imageRunParagraphs(run, a.caption, a.align)
}

/**
 * Post-process mammoth HTML: turn <img> tags carrying our atlas alt-JSON back
 * into <figure data-atlas-image> so the editor restores crop/wrap/position.
 * Plain images pass through (the node's img fallback handles them).
 */
export function postProcessImportedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let touched = false
  doc.querySelectorAll('img').forEach((img) => {
    const alt = img.getAttribute('alt') ?? ''
    if (!alt.trimStart().startsWith('{')) return
    const { meta, text } = splitAlt(alt)
    if (!meta) return
    const fig = doc.createElement('figure')
    fig.setAttribute('data-atlas-image', '')
    fig.setAttribute('data-src', img.getAttribute('src') ?? '')
    if (meta.w !== undefined && meta.w !== null) fig.setAttribute('data-width', String(meta.w))
    if (meta.rot) fig.setAttribute('data-rot', String(meta.rot))
    if (meta.fh) fig.setAttribute('data-fliph', '1')
    if (meta.fv) fig.setAttribute('data-flipv', '1')
    if (meta.wrap && meta.wrap !== 'inline') fig.setAttribute('data-wrap', meta.wrap)
    if (meta.al && meta.al !== 'center') fig.setAttribute('data-align', meta.al)
    if (meta.px !== undefined) fig.setAttribute('data-px', String(meta.px))
    if (meta.py !== undefined) fig.setAttribute('data-py', String(meta.py))
    if (meta.z !== undefined && meta.z !== 1) fig.setAttribute('data-z', String(meta.z))
    if (meta.crop) fig.setAttribute('data-crop', [meta.crop.x, meta.crop.y, meta.crop.w, meta.crop.h].join(','))
    if (meta.cs && meta.cs !== 'rect') fig.setAttribute('data-cropshape', meta.cs)
    const clone = img.cloneNode(false) as HTMLImageElement
    clone.setAttribute('alt', text)
    fig.appendChild(clone)
    img.replaceWith(fig)
    touched = true
  })
  return touched ? doc.body.innerHTML : html
}
