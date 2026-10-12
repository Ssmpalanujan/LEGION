import { useEffect } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import katex from 'katex'
import { pageDims, type PageSettings } from '../types'

interface EditorViewProps {
  editor: TiptapEditor | null
  page: PageSettings
  zoom: number
  header: string
  footer: string
  onHeader: (v: string) => void
  onFooter: (v: string) => void
  readMode: boolean
  longDoc: boolean
}

export default function EditorView({ editor, page, zoom, header, footer, onHeader, onFooter, readMode, longDoc }: EditorViewProps) {
  const { w, h, pad } = pageDims(page)
  const minH = readMode ? undefined : `${h}mm`
  const borderCls = page.pageBorder === 'single' ? 'page-border-single' : page.pageBorder === 'double' ? 'page-border-double' : ''

  // Render KaTeX equations post-hoc (equation nodes carry data-latex)
  useEffect(() => {
    if (!editor) return
    const renderEqs = () => {
      const root = document.querySelector('.a4-page')
      if (!root) return
      root.querySelectorAll('span[data-equation]').forEach((el) => {
        const latex = el.getAttribute('data-latex') ?? ''
        if ((el as HTMLElement).dataset.rendered === latex) return
        try {
          katex.render(latex, el as HTMLElement, { throwOnError: false })
          ;(el as HTMLElement).dataset.rendered = latex
        } catch {
          /* leave raw latex */
        }
      })
    }
    renderEqs()
    editor.on('transaction', renderEqs)
    editor.on('update', renderEqs)
    return () => {
      editor.off('transaction', renderEqs)
      editor.off('update', renderEqs)
    }
  }, [editor])

  return (
    <div className={`flex justify-center px-6 py-8 ${longDoc ? 'long-doc' : ''}`}>
      <div
        role="document"
        aria-label="Document page"
        className={`a4-page relative ${borderCls}`}
        style={
          {
            width: `${w}mm`,
            minHeight: minH,
            padding: `${pad}mm`,
            zoom: `${zoom}%`
          } as React.CSSProperties
        }
      >
        {page.watermark && (
          <div className="page-watermark" aria-hidden="true">
            <span>{page.watermark}</span>
          </div>
        )}
        {page.showHeaderFooter && !readMode && (
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => onHeader(e.currentTarget.textContent ?? '')}
            className="mb-4 border-b border-neutral-200 pb-2 text-[12px] text-neutral-500 outline-none empty:before:text-neutral-400 empty:before:content-['Double-click_to_edit_header']"
          >
            {header}
          </div>
        )}
        <div style={page.columns > 1 ? { columnCount: page.columns, columnGap: '12mm', columnRule: '1px solid #e5e5e5' } : undefined}>
          <EditorContent editor={editor} aria-label="Document editor. Start typing here." />
        </div>
        {page.showHeaderFooter && !readMode && (
          <div className="mt-6 border-t border-neutral-200 pt-2 text-[12px] text-neutral-500">
            <div
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => onFooter(e.currentTarget.textContent ?? '')}
              className="outline-none"
            >
              {footer}
            </div>
            {page.showPageNumbers && <div className="mt-1 text-center tabular-nums">— 1 —</div>}
          </div>
        )}
      </div>
    </div>
  )
}
