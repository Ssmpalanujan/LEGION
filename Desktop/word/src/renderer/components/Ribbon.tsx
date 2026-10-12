import { useEffect, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import {
  ClipboardPaste, Scissors, Copy, Paintbrush, Bold, Italic, Underline, Strikethrough,
  Subscript, Superscript, Eraser, List, ListOrdered, IndentDecrease, IndentIncrease,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Rows3, Search, Replace,
  MousePointerSquareDashed, ChevronDown, Droplet, Highlighter, Table as TableIcon,
  Image as ImageIcon, Link2, Minus as HrIcon, FilePlus2, FolderOpen, Save, Printer,
  FileDown, Trash2, CalendarClock, Sparkles, Plus, Minus, Combine, Ungroup,
  ListChecks, BookOpen, SpellCheck, ZoomIn, ZoomOut, Ruler as RulerIcon,
  MoonStar, FileText, SlidersHorizontal, Sigma, Shapes, Square, Asterisk, Bookmark,
  MessageSquare, PenLine, Check, X, ListTree, History, LayoutTemplate, Settings as SettingsIcon,
  Lock, Eye, Maximize, Mail, Type, PanelLeft, RefreshCw, ImagePlus, Camera, LayoutGrid, Video, Crop as CropIcon, Download
} from 'lucide-react'
import type { PageSettings } from '../types'
import { TableGridPicker } from './Dialogs'

export interface AdvActions {
  openStyles?: () => void
  openEquation?: () => void
  openShape?: () => void
  insertTextbox?: () => void
  openFootnote?: (kind: 'footnote' | 'endnote') => void
  openComments?: () => void
  tracking?: boolean
  onToggleTrack?: () => void
  openTrack?: () => void
  onAcceptAll?: () => void
  onRejectAll?: () => void
  openToc?: () => void
  onTocInsert?: () => void
  onTocRefresh?: () => void
  openMerge?: () => void
  openImageUrl?: () => void
  openScreenshot?: () => void
  openPictureFormat?: () => void
  openCollage?: () => void
  openWebcam?: () => void
  openClip?: () => void
  openExportImage?: () => void
  openNav?: () => void
  openHistory?: () => void
  openTemplates?: () => void
  onSaveProtected?: () => void
  openSettings?: () => void
  onToggleFocus?: () => void
  focusMode?: boolean
  onToggleFullscreen?: () => void
  onToggleDropCap?: () => void
  dropCapOn?: boolean
  watermark?: string
  onWatermark?: (text: string) => void
  pageBorder?: string
  onPageBorder?: (b: 'none' | 'single' | 'double') => void
}

export type RibbonTab = 'File' | 'Home' | 'Insert' | 'Layout' | 'References' | 'Review' | 'View'

interface RibbonProps {
  editor: Editor | null
  activeTab: RibbonTab
  onTabChange: (tab: RibbonTab) => void
  isMac: boolean
  painterArmed: boolean
  onPainter: () => void
  onOpenFind: () => void
  onOpenReplace: () => void
  onFileAction: (a: 'new' | 'open' | 'save' | 'saveAs' | 'exportPdf' | 'exportDocx' | 'exportTxt' | 'exportHtml' | 'print' | 'printPreview' | 'clearRecent', payload?: string) => void
  recent: string[]
  page: PageSettings
  onPage: (patch: Partial<PageSettings>) => void
  onOpenWordCount: () => void
  onOpenLink: () => void
  onOpenSpecial: () => void
  onPickImage: () => void
  spellcheck: boolean
  onToggleSpell: () => void
  showRuler: boolean
  onToggleRuler: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  zoom: number
  onZoom: (z: number) => void
  adv?: AdvActions
}

const TABS: RibbonTab[] = ['File', 'Home', 'Insert', 'Layout', 'References', 'Review', 'View']
const FONT_FAMILIES = ['Default', 'Calibri', 'Arial', 'Times New Roman', 'Georgia', 'Segoe UI', 'Courier New', 'Verdana']
const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '36', '48', '72']
const LINE_SPACING = ['1.0', '1.15', '1.5', '2.0', '2.5']

function BarButton({ tip, children, active = false, onClick }: { tip: string; children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      data-tip={tip}
      aria-label={tip}
      title={tip}
      onClick={onClick}
      className={`ribbon-tip rounded p-1.5 transition-colors ${
        active ? 'bg-[#D6E4F7] text-[#2B579A] dark:bg-sky-900 dark:text-sky-200'
          : 'text-neutral-700 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="toolbar" aria-label={label} className="flex flex-col justify-between px-2 py-1">
      <div className="flex items-start gap-0.5">{children}</div>
      <div className="mt-1 text-center text-[11px] leading-none text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  )
}

function Divider() {
  return <div className="my-1 w-px bg-neutral-300 dark:bg-neutral-700" />
}

function useTick(editor: Editor | null): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!editor) return
    const bump = () => setTick((t) => t + 1)
    editor.on('selectionUpdate', bump)
    editor.on('transaction', bump)
    return () => {
      editor.off('selectionUpdate', bump)
      editor.off('transaction', bump)
    }
  }, [editor])
  return tick
}

export default function Ribbon(props: RibbonProps) {
  const { editor, activeTab, onTabChange, isMac } = props
  const A = props.adv ?? {}
  const mod = isMac ? '⌘' : 'Ctrl'
  useTick(editor)
  const [tableOpen, setTableOpen] = useState(false)
  const [spacingOpen, setSpacingOpen] = useState(false)
  const [wmDraft, setWmDraft] = useState(A.watermark ?? '')

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.indexOf(activeTab)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onTabChange(TABS[(i + 1) % TABS.length])
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onTabChange(TABS[(i - 1 + TABS.length) % TABS.length])
    } else if (e.key === 'Home') {
      e.preventDefault()
      onTabChange(TABS[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      onTabChange(TABS[TABS.length - 1])
    }
  }

  const chain = () => editor?.chain().focus()
  const is = (name: string, attrs?: Record<string, unknown>) => editor?.isActive(name, attrs) ?? false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cmds = editor?.commands as unknown as Record<string, (...a: any[]) => void> | undefined

  const curFont = (() => {
    try {
      const a = editor?.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string } | undefined
      return { family: a?.fontFamily ?? 'Default', size: (a?.fontSize ?? '11').replace('px', '').replace('pt', '') }
    } catch {
      return { family: 'Default', size: '11' }
    }
  })()

  const textColor = (
    <label data-tip="Text color" className="ribbon-tip cursor-pointer rounded p-1.5 text-neutral-700 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-700">
      <span className="flex flex-col items-center">
        <Droplet size={16} />
        <span className="h-0.5 w-4 bg-red-500" />
      </span>
      <input
        type="color"
        className="hidden"
        onChange={(e) => chain()?.setColor(e.target.value).run()}
        title="Text color"
      />
    </label>
  )
  const hlColor = (
    <label data-tip="Highlight color" className="ribbon-tip cursor-pointer rounded p-1.5 text-neutral-700 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-700">
      <span className="flex flex-col items-center">
        <Highlighter size={16} />
        <span className="h-0.5 w-4 bg-yellow-400" />
      </span>
      <input
        type="color"
        className="hidden"
        onChange={(e) => chain()?.toggleHighlight({ color: e.target.value }).run()}
        title="Highlight color"
      />
    </label>
  )

  return (
    <div className="select-none border-b border-neutral-300 bg-[#F3F3F3] dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <nav role="tablist" aria-label="Ribbon tabs. Use left and right arrows to move." className="flex items-end gap-0.5 px-2 pt-1" onKeyDown={onTabKey}>
        {TABS.map((tab) => {
          const active = tab === activeTab
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onTabChange(tab)}
              className={`relative rounded-t px-3.5 py-1.5 text-[13px] transition-colors ${
                active ? 'bg-white font-semibold text-[#2B579A] dark:bg-[#2d2d2d] dark:text-sky-300'
                  : 'text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-700/60'
              }`}
            >
              {tab}
              {active && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-[#2B579A] dark:bg-sky-400" />}
            </button>
          )
        })}
      </nav>

      <div role="tabpanel" aria-label={`${activeTab} tools`} className="min-h-[104px] overflow-x-auto bg-white px-1 pb-1 dark:bg-[#2d2d2d]">
        {/* ============ HOME ============ */}
        {activeTab === 'Home' && (
          <div className="flex items-stretch">
            <Group label="Clipboard">
              <BarButton tip={`Paste (${mod}+V)`} onClick={() => document.execCommand('paste')}>
                <ClipboardPaste size={17} />
              </BarButton>
              <BarButton tip={`Cut (${mod}+X)`} onClick={() => document.execCommand('cut')}>
                <Scissors size={17} />
              </BarButton>
              <BarButton tip={`Copy (${mod}+C)`} onClick={() => document.execCommand('copy')}>
                <Copy size={17} />
              </BarButton>
              <BarButton tip="Format Painter (click, then select text)" active={props.painterArmed} onClick={props.onPainter}>
                <Paintbrush size={17} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Font">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <select
                    aria-label="Font family"
                    title="Font family"
                    value={curFont.family}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === 'Default') chain()?.unsetFontFamily().run()
                      else chain()?.setFontFamily(v).run()
                    }}
                    className="h-7 w-32 rounded border border-neutral-300 bg-white px-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Font size"
                    title="Font size"
                    value={FONT_SIZES.includes(curFont.size) ? curFont.size : '11'}
                    onChange={(e) => cmds?.setFontSize(`${e.target.value}px`)}
                    className="h-7 w-14 rounded border border-neutral-300 bg-white px-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800"
                  >
                    {FONT_SIZES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-0.5">
                  <BarButton tip={`Bold (${mod}+B)`} active={is('bold')} onClick={() => chain()?.toggleBold().run()}>
                    <Bold size={16} />
                  </BarButton>
                  <BarButton tip={`Italic (${mod}+I)`} active={is('italic')} onClick={() => chain()?.toggleItalic().run()}>
                    <Italic size={16} />
                  </BarButton>
                  <BarButton tip={`Underline (${mod}+U)`} active={is('underline')} onClick={() => chain()?.toggleUnderline().run()}>
                    <Underline size={16} />
                  </BarButton>
                  <BarButton tip="Strikethrough" active={is('strike')} onClick={() => chain()?.toggleStrike().run()}>
                    <Strikethrough size={16} />
                  </BarButton>
                  <BarButton tip="Subscript" active={is('subscript')} onClick={() => chain()?.toggleSubscript().run()}>
                    <Subscript size={16} />
                  </BarButton>
                  <BarButton tip="Superscript" active={is('superscript')} onClick={() => chain()?.toggleSuperscript().run()}>
                    <Superscript size={16} />
                  </BarButton>
                  {textColor}
                  {hlColor}
                  <BarButton tip="Clear formatting" onClick={() => chain()?.unsetAllMarks().clearNodes().run()}>
                    <Eraser size={16} />
                  </BarButton>
                </div>
              </div>
            </Group>
            <Divider />
            <Group label="Paragraph">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-0.5">
                  <BarButton tip="Bullets" active={is('bulletList')} onClick={() => chain()?.toggleBulletList().run()}>
                    <List size={16} />
                  </BarButton>
                  <BarButton tip="Numbering" active={is('orderedList')} onClick={() => chain()?.toggleOrderedList().run()}>
                    <ListOrdered size={16} />
                  </BarButton>
                  <BarButton tip="Decrease indent" onClick={() => cmds?.outdent()}>
                    <IndentDecrease size={16} />
                  </BarButton>
                  <BarButton tip="Increase indent" onClick={() => cmds?.indent()}>
                    <IndentIncrease size={16} />
                  </BarButton>
                  <span className="relative">
                    <BarButton tip="Line spacing" onClick={() => setSpacingOpen((s) => !s)}>
                      <Rows3 size={16} />
                    </BarButton>
                    {spacingOpen && (
                      <span className="absolute left-0 top-full z-30 rounded border border-neutral-300 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
                        {LINE_SPACING.map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              cmds?.setLineHeight(s)
                              setSpacingOpen(false)
                            }}
                            className="block w-full px-4 py-1 text-left text-[12px] hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          >
                            {s}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <BarButton tip="Align left" active={is('paragraph', { textAlign: 'left' })} onClick={() => chain()?.setTextAlign('left').run()}>
                    <AlignLeft size={16} />
                  </BarButton>
                  <BarButton tip="Center" active={is('paragraph', { textAlign: 'center' })} onClick={() => chain()?.setTextAlign('center').run()}>
                    <AlignCenter size={16} />
                  </BarButton>
                  <BarButton tip="Align right" active={is('paragraph', { textAlign: 'right' })} onClick={() => chain()?.setTextAlign('right').run()}>
                    <AlignRight size={16} />
                  </BarButton>
                  <BarButton tip="Justify" active={is('paragraph', { textAlign: 'justify' })} onClick={() => chain()?.setTextAlign('justify').run()}>
                    <AlignJustify size={16} />
                  </BarButton>
                </div>
              </div>
            </Group>
            <Divider />
            <Group label="Styles">
              <div className="flex items-center gap-1">
                {(
                  [
                    ['Normal', () => chain()?.setParagraph().run(), is('paragraph') && !is('heading')],
                    ['Heading 1', () => chain()?.toggleHeading({ level: 1 }).run(), is('heading', { level: 1 })],
                    ['Heading 2', () => chain()?.toggleHeading({ level: 2 }).run(), is('heading', { level: 2 })],
                    ['Heading 3', () => chain()?.toggleHeading({ level: 3 }).run(), is('heading', { level: 3 })],
                    ['Title', () => chain()?.toggleHeading({ level: 1 }).run(), false]
                  ] as [string, () => void, boolean][]
                ).map(([s, fn, on]) => (
                  <button
                    key={s}
                    data-tip={`Apply “${s}” style`}
                    onClick={fn}
                    className={`ribbon-tip rounded border px-2.5 py-1.5 text-[12px] ${
                      on ? 'border-[#2B579A] bg-[#D6E4F7] font-medium text-[#2B579A] dark:border-sky-500 dark:bg-sky-900 dark:text-sky-200'
                        : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700'
                    } ${s.startsWith('Heading') || s === 'Title' ? 'font-bold' : ''}`}
                  >
                    {s}
                  </button>
                ))}
                <BarButton tip="Open Styles pane (create and modify styles)" onClick={A.openStyles}>
                  <SlidersHorizontal size={16} />
                </BarButton>
              </div>
            </Group>
            <Divider />
            <Group label="Editing">
              <div className="flex flex-col justify-center gap-0.5">
                <button data-tip={`Find (${mod}+F)`} onClick={props.onOpenFind} className="ribbon-tip flex items-center gap-2 rounded px-2 py-1 text-[12px] hover:bg-neutral-200 dark:hover:bg-neutral-700">
                  <Search size={14} /> Find
                </button>
                <button data-tip={`Replace (${mod}+H)`} onClick={props.onOpenReplace} className="ribbon-tip flex items-center gap-2 rounded px-2 py-1 text-[12px] hover:bg-neutral-200 dark:hover:bg-neutral-700">
                  <Replace size={14} /> Replace
                </button>
                <button data-tip={`Select All (${mod}+A)`} onClick={() => chain()?.selectAll().run()} className="ribbon-tip flex items-center gap-2 rounded px-2 py-1 text-[12px] hover:bg-neutral-200 dark:hover:bg-neutral-700">
                  <MousePointerSquareDashed size={14} /> Select All
                </button>
              </div>
            </Group>
          </div>
        )}

        {/* ============ FILE ============ */}
        {activeTab === 'File' && (
          <div className="flex items-stretch">
            <Group label="Document">
              <BarButton tip={`New (${mod}+N)`} onClick={() => props.onFileAction('new')}>
                <FilePlus2 size={17} />
              </BarButton>
              <BarButton tip={`Open (${mod}+O)`} onClick={() => props.onFileAction('open')}>
                <FolderOpen size={17} />
              </BarButton>
              <BarButton tip={`Save (${mod}+S)`} onClick={() => props.onFileAction('save')}>
                <Save size={17} />
              </BarButton>
              <BarButton tip="Save As" onClick={() => props.onFileAction('saveAs')}>
                <Save size={17} />
              </BarButton>
              <BarButton tip="Save with password (AES encryption)" onClick={A.onSaveProtected}>
                <Lock size={17} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Manage">
              <BarButton tip="New from template (Resume, Letter, Report…)" onClick={A.openTemplates}>
                <LayoutTemplate size={17} />
              </BarButton>
              <BarButton tip="Version history (auto-snapshots)" onClick={A.openHistory}>
                <History size={17} />
              </BarButton>
              <BarButton tip="Settings (font, autosave, language, theme)" onClick={A.openSettings}>
                <SettingsIcon size={17} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Export">
              <BarButton tip="Export as PDF" onClick={() => props.onFileAction('exportPdf')}>
                <FileDown size={17} />
              </BarButton>
              <BarButton tip="Export as Word (.docx)" onClick={() => props.onFileAction('exportDocx')}>
                <FileText size={17} />
              </BarButton>
              <BarButton tip="Export as plain text" onClick={() => props.onFileAction('exportTxt')}>
                <ListChecks size={17} />
              </BarButton>
              <BarButton tip="Export as HTML" onClick={() => props.onFileAction('exportHtml')}>
                <FileDown size={17} />
              </BarButton>
              <BarButton tip={`Print (${mod}+P)`} onClick={() => props.onFileAction('print')}>
                <Printer size={17} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Recent files">
              <div className="flex max-w-[420px] items-center gap-1 overflow-x-auto">
                {props.recent.length === 0 && <span className="px-2 text-[12px] text-neutral-500">No recent files</span>}
                {props.recent.slice(0, 5).map((r) => (
                  <button
                    key={r}
                    title={r}
                    onClick={() => props.onFileAction('open', r)}
                    className="max-w-[150px] truncate rounded border border-neutral-300 px-2 py-1 text-[11px] hover:bg-neutral-100 dark:border-neutral-600"
                  >
                    {r.split(/[/\\]/).pop()}
                  </button>
                ))}
                {props.recent.length > 0 && (
                  <BarButton tip="Clear recent files" onClick={() => props.onFileAction('clearRecent')}>
                    <Trash2 size={15} />
                  </BarButton>
                )}
              </div>
            </Group>
          </div>
        )}

        {/* ============ INSERT ============ */}
        {activeTab === 'Insert' && (
          <div className="flex items-stretch">
            <Group label="Table">
              <span className="relative">
                <BarButton tip="Insert table (choose rows × columns)" onClick={() => setTableOpen((s) => !s)}>
                  <TableIcon size={17} />
                </BarButton>
                {tableOpen && (
                  <span className="absolute left-0 top-full z-30 rounded border border-neutral-300 bg-white shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
                    <TableGridPicker
                      onPick={(rows, cols) => {
                        chain()?.insertTable({ rows, cols, withHeaderRow: true }).run()
                        setTableOpen(false)
                      }}
                    />
                  </span>
                )}
              </span>
              <BarButton tip="Add row above" onClick={() => chain()?.addRowBefore().run()}>
                <Plus size={16} />
              </BarButton>
              <BarButton tip="Delete row" onClick={() => chain()?.deleteRow().run()}>
                <Minus size={16} />
              </BarButton>
              <BarButton tip="Add column left" onClick={() => chain()?.addColumnBefore().run()}>
                <Plus size={16} />
              </BarButton>
              <BarButton tip="Delete column" onClick={() => chain()?.deleteColumn().run()}>
                <Minus size={16} />
              </BarButton>
              <BarButton tip="Merge cells" onClick={() => chain()?.mergeCells().run()}>
                <Combine size={16} />
              </BarButton>
              <BarButton tip="Split cell" onClick={() => chain()?.splitCell().run()}>
                <Ungroup size={16} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Media & links">
              <BarButton tip="Insert image from file" onClick={props.onPickImage}>
                <ImageIcon size={17} />
              </BarButton>
              <BarButton tip="Insert image from URL, file, or screenshot" onClick={A.openImageUrl}>
                <ImagePlus size={17} />
              </BarButton>
              <BarButton tip="Capture a screenshot and insert it" onClick={A.openScreenshot}>
                <Camera size={17} />
              </BarButton>
              <BarButton tip="Picture Format panel for the selected image" onClick={A.openPictureFormat}>
                <SlidersHorizontal size={17} />
              </BarButton>
              <BarButton tip="Photo grid / collage layouts (2x2, 3x1, …)" onClick={A.openCollage}>
                <LayoutGrid size={17} />
              </BarButton>
              <BarButton tip="Take a photo with the webcam" onClick={A.openWebcam}>
                <Video size={17} />
              </BarButton>
              <BarButton tip="Clip a region of the screen" onClick={A.openClip}>
                <CropIcon size={17} />
              </BarButton>
              <BarButton tip="Save a document picture as PNG, JPG, or WebP" onClick={A.openExportImage}>
                <Download size={17} />
              </BarButton>
              <BarButton tip="Insert hyperlink" onClick={props.onOpenLink}>
                <Link2 size={17} />
              </BarButton>
              <BarButton tip="Insert equation (KaTeX)" onClick={A.openEquation}>
                <Sigma size={17} />
              </BarButton>
              <BarButton tip="Insert shape (rectangle, circle, line, arrow)" onClick={A.openShape}>
                <Shapes size={17} />
              </BarButton>
              <BarButton tip="Insert text box" onClick={A.insertTextbox}>
                <Square size={17} />
              </BarButton>
              <BarButton tip="Horizontal line" onClick={() => chain()?.setHorizontalRule().run()}>
                <HrIcon size={17} />
              </BarButton>
              <BarButton tip="Page break" onClick={() => cmds?.setPageBreak()}>
                <ChevronDown size={17} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Notes">
              <BarButton tip="Insert footnote" onClick={() => A.openFootnote?.('footnote')}>
                <Asterisk size={17} />
              </BarButton>
              <BarButton tip="Insert endnote" onClick={() => A.openFootnote?.('endnote')}>
                <Bookmark size={17} />
              </BarButton>
              <BarButton tip="Comment on selected text" onClick={A.openComments}>
                <MessageSquare size={17} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Text">
              <BarButton tip="Special characters" onClick={props.onOpenSpecial}>
                <Sparkles size={17} />
              </BarButton>
              <BarButton tip="Insert date/time" onClick={() => chain()?.insertContent(new Date().toLocaleString()).run()}>
                <CalendarClock size={17} />
              </BarButton>
            </Group>
          </div>
        )}

        {/* ============ LAYOUT ============ */}
        {activeTab === 'Layout' && (
          <div className="flex items-stretch">
            <Group label="Page setup">
              <div className="flex items-center gap-1.5 px-1">
                <label className="text-[12px]" title="Page size">
                  Size
                  <select
                    value={props.page.size}
                    onChange={(e) => props.onPage({ size: e.target.value as PageSettings['size'] })}
                    className="ml-1 rounded border border-neutral-300 px-1 py-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800"
                  >
                    <option>A4</option>
                    <option>Letter</option>
                    <option>Legal</option>
                  </select>
                </label>
                <button
                  title="Toggle portrait / landscape"
                  onClick={() => props.onPage({ orientation: props.page.orientation === 'portrait' ? 'landscape' : 'portrait' })}
                  className="rounded border border-neutral-300 px-2 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600"
                >
                  {props.page.orientation === 'portrait' ? 'Portrait' : 'Landscape'}
                </button>
                <label className="text-[12px]" title="Margins preset">
                  Margins
                  <select
                    value={props.page.margins}
                    onChange={(e) => props.onPage({ margins: e.target.value as PageSettings['margins'] })}
                    className="ml-1 rounded border border-neutral-300 px-1 py-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800"
                  >
                    <option value="narrow">Narrow</option>
                    <option value="normal">Normal</option>
                    <option value="wide">Wide</option>
                  </select>
                </label>
                <label className="text-[12px]" title="Text columns">
                  Columns
                  <select
                    value={props.page.columns}
                    onChange={(e) => props.onPage({ columns: Number(e.target.value) })}
                    className="ml-1 rounded border border-neutral-300 px-1 py-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
              </div>
            </Group>
            <Divider />
            <Group label="Header & footer">
              <BarButton tip="Toggle header/footer editing" active={props.page.showHeaderFooter} onClick={() => props.onPage({ showHeaderFooter: !props.page.showHeaderFooter })}>
                <FileText size={16} />
              </BarButton>
              <BarButton tip="Toggle page numbers" active={props.page.showPageNumbers} onClick={() => props.onPage({ showPageNumbers: !props.page.showPageNumbers })}>
                <ListOrdered size={16} />
              </BarButton>
              <BarButton tip="Insert page break" onClick={() => cmds?.setPageBreak()}>
                <ChevronDown size={16} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Format">
              <BarButton tip="Toggle drop cap on this paragraph" active={A.dropCapOn} onClick={A.onToggleDropCap}>
                <Type size={16} />
              </BarButton>
              <span className="flex items-center gap-1 px-1" title="Watermark text">
                <input
                  aria-label="Watermark text"
                  value={wmDraft}
                  onChange={(e) => setWmDraft(e.target.value)}
                  onBlur={() => A.onWatermark?.(wmDraft)}
                  onKeyDown={(e) => e.key === 'Enter' && A.onWatermark?.(wmDraft)}
                  placeholder="Watermark"
                  className="h-7 w-24 rounded border border-neutral-300 px-1.5 text-[12px] dark:border-neutral-600 dark:bg-neutral-800"
                />
              </span>
              <label className="flex items-center gap-1 px-1 text-[12px]" title="Page border">
                Border
                <select
                  aria-label="Page border"
                  value={A.pageBorder ?? 'none'}
                  onChange={(e) => A.onPageBorder?.(e.target.value as 'none' | 'single' | 'double')}
                  className="h-7 rounded border border-neutral-300 px-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800"
                >
                  <option value="none">None</option>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                </select>
              </label>
            </Group>
          </div>
        )}

        {/* ============ REFERENCES ============ */}
        {activeTab === 'References' && (
          <div className="flex items-stretch">
            <Group label="Table of Contents">
              <BarButton tip="Insert table of contents at cursor" onClick={A.onTocInsert}>
                <ListTree size={16} />
              </BarButton>
              <BarButton tip="Refresh all TOC blocks from headings" onClick={A.onTocRefresh}>
                <RefreshCw size={16} />
              </BarButton>
              <BarButton tip="Open TOC panel" onClick={A.openToc}>
                <PanelLeft size={16} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Notes">
              <BarButton tip="Insert footnote" onClick={() => A.openFootnote?.('footnote')}>
                <Asterisk size={16} />
              </BarButton>
              <BarButton tip="Insert endnote" onClick={() => A.openFootnote?.('endnote')}>
                <Bookmark size={16} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Merge">
              <BarButton tip="Mail merge: fill {{placeholders}} from CSV" onClick={A.openMerge}>
                <Mail size={16} />
              </BarButton>
              <BarButton tip="Word, character and paragraph count" onClick={props.onOpenWordCount}>
                <ListChecks size={16} />
              </BarButton>
            </Group>
          </div>
        )}

        {/* ============ REVIEW ============ */}
        {activeTab === 'Review' && (
          <div className="flex items-stretch">
            <Group label="Proofing">
              <BarButton tip="Word, character and paragraph count" onClick={props.onOpenWordCount}>
                <ListChecks size={17} />
              </BarButton>
              <BarButton tip="Toggle spellcheck (right-click a word for suggestions)" active={props.spellcheck} onClick={props.onToggleSpell}>
                <SpellCheck size={17} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Comments">
              <BarButton tip="Open comments panel" onClick={A.openComments}>
                <MessageSquare size={17} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Tracking">
              <BarButton tip="Toggle Track Changes (insertions green, deletions red)" active={A.tracking} onClick={A.onToggleTrack}>
                <PenLine size={17} />
              </BarButton>
              <BarButton tip="Open changes panel (accept / reject each change)" onClick={A.openTrack}>
                <ListChecks size={17} />
              </BarButton>
              <BarButton tip="Accept all tracked changes" onClick={A.onAcceptAll}>
                <Check size={17} />
              </BarButton>
              <BarButton tip="Reject all tracked changes" onClick={A.onRejectAll}>
                <X size={17} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Find">
              <BarButton tip={`Find (${mod}+F)`} onClick={props.onOpenFind}>
                <Search size={16} />
              </BarButton>
              <BarButton tip={`Replace (${mod}+H)`} onClick={props.onOpenReplace}>
                <Replace size={16} />
              </BarButton>
            </Group>
          </div>
        )}

        {/* ============ VIEW ============ */}
        {activeTab === 'View' && (
          <div className="flex items-stretch">
            <Group label="Zoom">
              <BarButton tip="Zoom out" onClick={() => props.onZoom(Math.max(10, props.zoom - 10))}>
                <ZoomOut size={16} />
              </BarButton>
              <span className="px-1 text-[12px] tabular-nums">{props.zoom}%</span>
              <BarButton tip="Zoom in" onClick={() => props.onZoom(Math.min(500, props.zoom + 10))}>
                <ZoomIn size={16} />
              </BarButton>
              {[50, 100, 150].map((z) => (
                <button key={z} onClick={() => props.onZoom(z)} title={`Zoom ${z}%`} className="rounded border border-neutral-300 px-2 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600">
                  {z}%
                </button>
              ))}
            </Group>
            <Divider />
            <Group label="Show">
              <BarButton tip="Toggle ruler" active={props.showRuler} onClick={props.onToggleRuler}>
                <RulerIcon size={16} />
              </BarButton>
              <BarButton tip="Toggle navigation pane (headings outline)" onClick={A.openNav}>
                <PanelLeft size={16} />
              </BarButton>
              <BarButton tip="Toggle dark mode" active={props.theme === 'dark'} onClick={props.onToggleTheme}>
                <MoonStar size={16} />
              </BarButton>
              <BarButton tip="Read Mode" onClick={() => props.onTabChange('View')}>
                <BookOpen size={16} />
              </BarButton>
            </Group>
            <Divider />
            <Group label="Window">
              <BarButton tip="Toggle focus mode (hide ribbon and panes, Esc to exit)" active={A.focusMode} onClick={A.onToggleFocus}>
                <Eye size={16} />
              </BarButton>
              <BarButton tip="Toggle full screen" onClick={A.onToggleFullscreen}>
                <Maximize size={16} />
              </BarButton>
              <BarButton tip="Settings" onClick={A.openSettings}>
                <SettingsIcon size={16} />
              </BarButton>
            </Group>
          </div>
        )}
      </div>
    </div>
  )
}
