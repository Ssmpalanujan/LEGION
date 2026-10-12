/** Interactive React NodeView for `atlasImage`: resize handles, free positioning, keyboard access. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { AtlasImageAttrs, ResizeHandleId } from './types'
import { resizeFromHandle, snapPosition, displaySize, PX_PER_CM } from './math'

const HANDLES: ResizeHandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function handleCursor(h: ResizeHandleId): string {
  if (h === 'nw' || h === 'se') return 'nwse-resize'
  if (h === 'ne' || h === 'sw') return 'nesw-resize'
  if (h === 'n' || h === 's') return 'ns-resize'
  return 'ew-resize'
}

function handlePos(h: ResizeHandleId): React.CSSProperties {
  const s: React.CSSProperties = { position: 'absolute', width: 12, height: 12, margin: -6, cursor: handleCursor(h), zIndex: 5 }
  if (h.includes('n')) s.top = 0
  if (h.includes('s')) s.bottom = 0
  if (h.includes('w')) s.left = 0
  if (h.includes('e')) s.right = 0
  if (h === 'n' || h === 's') s.left = '50%'
  if (h === 'e' || h === 'w') s.top = '50%'
  return s
}

export function ImageNodeView(props: NodeViewProps) {
  const a = props.node.attrs as unknown as AtlasImageAttrs
  const { selected, updateAttributes, editor } = props
  const [live, setLive] = useState<{ width: number; height: number } | null>(null)
  const [move, setMove] = useState<{ x: number; y: number } | null>(null)
  const [snapped, setSnapped] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number; handle: ResizeHandleId } | null>(null)
  const moveRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const rotated = a.rotation === 90 || a.rotation === 270
  const baseW = a.width ?? a.naturalWidth ?? 400
  const baseH = a.width != null && a.naturalWidth > 0 ? (a.width * a.naturalHeight) / a.naturalWidth : a.naturalHeight || 300
  const shownW = live?.width ?? baseW
  const shownH = live?.height ?? baseH
  const disp = displaySize(a.width, a.naturalWidth, a.naturalHeight, a.rotation)
  const frameW = live ? (rotated ? live.height : live.width) : disp.width
  const frameH = live ? (rotated ? live.width : live.height) : disp.height

  const isFloat = a.wrap === 'square' || a.wrap === 'tight'
  const isFree = a.wrap === 'behind' || a.wrap === 'front'
  const posX = move?.x ?? a.posX
  const posY = move?.y ?? a.posY

  const commitSize = useCallback(
    (w: number, h: number) => {
      // store the unrotated width so rotation stays a pure view transform
      const unrotatedW = rotated ? h : w
      updateAttributes({ width: Math.round(unrotatedW) })
    },
    [rotated, updateAttributes]
  )

  // ---- resize handles ----
  const onHandleDown = (handle: ResizeHandleId) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW: shownW, startH: shownH, handle }
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      let dx = ev.clientX - d.startX
      let dy = ev.clientY - d.startY
      if (rotated) [dx, dy] = [dy, dx]
      const r = resizeFromHandle(d.startW, d.startH, dx, dy, d.handle, {
        lockAspect: a.lockAspect,
        shiftKey: ev.shiftKey
      })
      setLive({ width: r.width, height: r.height })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const d = dragRef.current
      dragRef.current = null
      if (!d) return
      // recompute from the final event via live state
      setLive((cur) => {
        if (cur && (cur.width !== d.startW || cur.height !== d.startH)) commitSize(cur.width, cur.height)
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ---- free positioning (behind/front) ----
  const showGuides = useCallback((gx: number | null, gy: number | null) => {
    const root = editor.view.dom as HTMLElement
    root.querySelectorAll('.atlas-guide').forEach((el) => el.remove())
    const mk = (horiz: boolean, frac: number) => {
      const el = document.createElement('div')
      el.className = 'atlas-guide'
      el.style.cssText = horiz
        ? `position:absolute;left:0;right:0;top:${frac * 100}%;height:0;border-top:1px dashed #2B579A;pointer-events:none;z-index:60;`
        : `position:absolute;top:0;bottom:0;left:${frac * 100}%;width:0;border-left:1px dashed #2B579A;pointer-events:none;z-index:60;`
      root.appendChild(el)
    }
    if (gx !== null) mk(false, gx)
    if (gy !== null) mk(true, gy)
  }, [editor])

  const hideGuides = useCallback(() => {
    ;(editor.view.dom as HTMLElement).querySelectorAll('.atlas-guide').forEach((el) => el.remove())
  }, [editor])

  useEffect(() => hideGuides, [hideGuides])

  const onBodyDown = (e: React.PointerEvent) => {
    if (!isFree || !selected) return
    if ((e.target as HTMLElement).closest('.atlas-handle')) return
    e.preventDefault()
    const root = editor.view.dom as HTMLElement
    const rect = root.getBoundingClientRect()
    moveRef.current = { startX: e.clientX, startY: e.clientY, originX: posX, originY: posY }
    const onMove = (ev: PointerEvent) => {
      const m = moveRef.current
      if (!m || rect.width === 0 || rect.height === 0) return
      const raw = {
        x: m.originX + (ev.clientX - m.startX) / rect.width,
        y: m.originY + (ev.clientY - m.startY) / rect.height
      }
      const s = snapPosition(raw.x, raw.y, 0.02)
      setMove({ x: s.x, y: s.y })
      setSnapped({ x: s.guideX, y: s.guideY })
      showGuides(s.guideX, s.guideY)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      hideGuides()
      const m = moveRef.current
      moveRef.current = null
      setSnapped({ x: null, y: null })
      if (!m) return
      setMove((cur) => {
        if (cur) updateAttributes({ posX: Math.round(cur.x * 1000) / 1000, posY: Math.round(cur.y * 1000) / 1000 })
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ---- keyboard access on the selected image ----
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      editor.commands.deleteSelection()
      return
    }
    const ARROWS: Record<string, [number, number]> = {
      ArrowRight: [step, 0],
      ArrowLeft: [-step, 0],
      ArrowDown: [0, step],
      ArrowUp: [0, -step]
    }
    const dir = ARROWS[e.key]
    if (!dir) return
    e.preventDefault()
    e.stopPropagation()
    if (isFree) {
      const s = snapPosition(posX + dir[0] / 800, posY + dir[1] / 800, 0.02)
      updateAttributes({ posX: s.x, posY: s.y })
    } else {
      const r = resizeFromHandle(shownW, shownH, dir[0], dir[1], 'se', { lockAspect: a.lockAspect, shiftKey: e.shiftKey })
      commitSize(r.width, r.height)
    }
  }

  // ---- styles ----
  const crop = a.crop
  const cropW = crop ? frameW * crop.w : frameW
  const cropH = crop ? frameH * crop.h : frameH

  const frameStyle: React.CSSProperties = {
    position: 'relative',
    width: cropW,
    height: crop ? cropH : undefined,
    overflow: crop || a.radius > 0 ? 'hidden' : 'visible',
    borderRadius: a.cropShape === 'circle' ? '50%' : a.radius,
    border: a.border ? `${a.border.width}px ${a.border.style} ${a.border.color}` : undefined,
    boxShadow: a.shadow ? '0 10px 24px rgba(0,0,0,.35)' : undefined,
    transform: a.rotation ? `rotate(${a.rotation}deg)` : undefined,
    cursor: isFree ? (selected ? 'move' : 'default') : undefined
  }
  const imgStyle: React.CSSProperties = {
    display: 'block',
    width: frameW,
    height: 'auto',
    transform: [a.flipH ? 'scaleX(-1)' : '', a.flipV ? 'scaleY(-1)' : ''].filter(Boolean).join(' ') || undefined,
    marginLeft: crop ? -crop.x * frameW : undefined,
    marginTop: crop ? -crop.y * frameH : undefined,
    maxWidth: 'none'
  }

  const wrapStyle: React.CSSProperties = {}
  if (isFloat) {
    if (a.align === 'center') {
      wrapStyle.display = 'block'
      wrapStyle.margin = `${a.wrap === 'tight' ? 4 : 12}px auto`
    } else {
      wrapStyle.float = a.align === 'right' ? 'right' : 'left'
      wrapStyle.margin = a.wrap === 'tight' ? '4px' : '12px'
    }
  } else if (isFree) {
    wrapStyle.position = 'absolute'
    wrapStyle.left = `${posX * 100}%`
    wrapStyle.top = `${posY * 100}%`
    wrapStyle.transform = 'translate(-50%, 0)'
    wrapStyle.zIndex = a.wrap === 'behind' ? 0 : 10 + a.z
    wrapStyle.margin = 0
  } else {
    wrapStyle.display = 'block'
    wrapStyle.textAlign = a.align as 'left' | 'center' | 'right'
    wrapStyle.margin = '12px 0'
  }
  const sizeLabel = `${Math.round(shownW)} × ${Math.round(shownH)} px · ${(shownW / PX_PER_CM).toFixed(1)} × ${(shownH / PX_PER_CM).toFixed(1)} cm`

  return (
    <NodeViewWrapper
      className={`atlas-wrap atlas-wrap-${a.wrap}`}
      style={wrapStyle}
      onPointerDown={isFree ? onBodyDown : undefined}
    >
      <div
        className={`atlas-frame${selected ? ' atlas-selected' : ''}`}
        style={frameStyle}
        tabIndex={selected ? 0 : -1}
        role="img"
        aria-label={a.alt || 'Document image. Arrow keys resize, Delete removes.'}
        title={a.alt || 'Image — click to select, drag handles to resize'}
        onKeyDown={onKeyDown}
        onDoubleClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          // Phase 2 editor modal listens for this; harmless if nothing handles it.
          window.dispatchEvent(new CustomEvent('atlas:edit-image'))
        }}
      >
        <img src={a.src} alt={a.alt} title={a.alt} draggable={false} loading="lazy" style={imgStyle} />
        {a.reflection && <div className="atlas-reflection" aria-hidden="true"><img src={a.src} alt="" draggable={false} loading="lazy" style={{ ...imgStyle, transform: `${imgStyle.transform ?? ''} scaleY(-1)`.trim() }} /></div>}
        {a.caption && <div className="atlas-caption">{a.caption}</div>}
        {selected && (
          <>
            {HANDLES.map((h) => (
              <button
                key={h}
                className="atlas-handle"
                style={handlePos(h)}
                title={`${h.toUpperCase()} resize handle — drag to resize${a.lockAspect ? ' (Shift unlocks aspect)' : ''}`}
                aria-label={`Resize image from ${h}`}
                onPointerDown={onHandleDown(h)}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              />
            ))}
            {(live || move) && (
              <div className="atlas-size-tip" role="status">
                {live ? sizeLabel : null}
                {move && (snapped.x !== null || snapped.y !== null) ? ' · snapped to guide' : null}
              </div>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}
