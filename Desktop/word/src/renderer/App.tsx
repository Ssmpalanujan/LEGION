import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TitleBar from './components/TitleBar'
import Ribbon, { type RibbonTab, type AdvActions } from './components/Ribbon'
import Ruler from './components/Ruler'
import EditorView from './components/Editor'
import StatusBar from './components/StatusBar'
import DocTabs from './components/DocTabs'
import FindReplace from './components/FindReplace'
import { WordCountDialog, LinkDialog, SpecialCharsDialog } from './components/Dialogs'
import { FontSize, LineHeight, Indent, PageBreak, SearchHighlight } from './editor/extensions'
import {
  CommentMark,
  InsertionMark,
  DeletionMark,
  FootnoteRef,
  TextBox,
  ShapeNode,
  EquationNode,
  DropCap,
  TocNode,
  acceptAllTracked,
  rejectAllTracked
} from './editor/advanced'
import StylesPane from './components/panes/StylesPane'
import { NavPane, TocPane } from './components/panes/NavTocPane'
import CommentsPane from './components/panes/CommentsPane'
import HistoryPane from './components/panes/HistoryPane'
import TrackPane from './components/panes/TrackPane'
import SettingsModal from './components/SettingsModal'
import TemplatesModal from './components/TemplatesModal'
import { PasswordModal, FootnoteDialog } from './components/PasswordModal'
import EquationDialog from './components/EquationDialog'
import ShapeDialog from './components/ShapeDialog'
import MergeDialog from './components/MergeDialog'
import { AtlasImage, ImageGroup, selectedAtlasImage, setAtlasAttrsAt } from './features/images/imageNode'
import { DEFAULT_ATLAS_ATTRS, type CropBox } from './features/images/types'
import { fileToAtlasSources, dataUrlToAtlasSources } from './features/images/downscale'
import { FormatPanel } from './features/images/FormatPanel'
import { CropOverlay } from './features/images/CropOverlay'
import { InsertImageModal } from './features/images/InsertImageModal'
import { ImageEditorModal } from './features/images/ImageEditorModal'
import { parseEdits, type ImageEdits } from './features/images/editorTypes'
import { SmartToolsModal } from './features/images/SmartToolsModal'
import { CollageModal } from './features/images/CollageModal'
import { ExportImageModal } from './features/images/ExportImageModal'
import { WebcamModal } from './features/images/WebcamModal'
import { renderCroppedBytes } from './features/images/export'
import type { CropShape } from './features/images/types'
import type { DocTab, PageSettings, ViewMode, DocComment, StyleDef, Snapshot, AppSettings } from './types'
import { BUILTIN_STYLES } from './types'
import { base64ToUtf8, utf8ToBase64, extOf, docxToHtml, htmlToDocxBlob, blobToBase64 } from './lib/files'
import { encryptText, decryptText, looksEncrypted } from './lib/crypto'
import type { Template } from './lib/templates'

const STARTER_HTML = `<h1>Welcome to WordPad Pro</h1><p>Start typing here. Every ribbon button is now wired to the Tiptap engine.</p><h2>Try it</h2><ul><li>Select text and press <strong>Bold</strong>, <strong>Italic</strong>, colors and highlight.</li><li>Insert a table, image, link or page break from the <strong>Insert</strong> tab.</li><li>Use <strong>Ctrl+F / Ctrl+H</strong> for find and replace.</li></ul><p><br /></p>`
let nextId = 1
const blankDoc = (n: number): DocTab => ({ id: nextId++, name: `Document${n}`, path: null, html: STARTER_HTML, dirty: false })

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />')
}

type LeftPane = 'nav' | null
type RightPane = 'styles' | 'comments' | 'toc' | 'history' | 'track' | 'images' | null

const DEFAULT_SETTINGS: AppSettings = {
  defaultFont: 'Calibri',
  defaultSize: '11',
  autosaveSec: 30,
  language: 'en-US',
  theme: 'light',
  wordGoal: 500
}

export default function App() {
  const api = typeof window !== 'undefined' ? (window.electron as any | undefined) : undefined
  const isMac = api?.isMac ?? /Mac/.test(navigator.platform ?? '')

  const [tabs, setTabs] = useState<DocTab[]>(() => [blankDoc(1)])
  const [activeId, setActiveId] = useState<number>(1)
  const [activeTab, setActiveTab] = useState<RibbonTab>('Home')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [zoom, setZoom] = useState(100)
  const [viewMode, setViewMode] = useState<ViewMode>('print')
  const [wordCount, setWordCount] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const [page, setPage] = useState<PageSettings>({ size: 'A4', orientation: 'portrait', margins: 'normal', columns: 1, showHeaderFooter: false, showPageNumbers: false, watermark: '', pageBorder: 'none' })
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')
  const [findOpen, setFindOpen] = useState<null | { mode: 'find' | 'replace' }>(null)
  const [wcOpen, setWcOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [specialOpen, setSpecialOpen] = useState(false)
  const [painterArmed, setPainterArmed] = useState(false)
  const [showRuler, setShowRuler] = useState(true)
  const [spellcheck, setSpellcheck] = useState(true)

  // ---- advanced state ----
  const [styles, setStyles] = useState<StyleDef[]>(BUILTIN_STYLES)
  const [commentsByDoc, setCommentsByDoc] = useState<Record<number, DocComment[]>>({})
  const [leftPane, setLeftPane] = useState<LeftPane>(null)
  const [rightPane, setRightPane] = useState<RightPane>(null)
  const [tracking, setTracking] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [pwSaveOpen, setPwSaveOpen] = useState(false)
  const [pendingUnlock, setPendingUnlock] = useState<{ raw: string; name: string; path: string } | null>(null)
  const [equationOpen, setEquationOpen] = useState(false)
  const [shapeOpen, setShapeOpen] = useState(false)
  const [footnoteKind, setFootnoteKind] = useState<null | 'footnote' | 'endnote'>(null)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [cropTarget, setCropTarget] = useState<{ pos: number; src: string } | null>(null)
  const [smartOpen, setSmartOpen] = useState(false)
  const [smartTab, setSmartTab] = useState<'bg' | 'ocr' | 'alt' | 'generate' | 'stock' | 'icons' | undefined>(undefined)
  const [collageOpen, setCollageOpen] = useState(false)
  const [exportPos, setExportPos] = useState<number | null | undefined>(undefined)
  const [webcamOpen, setWebcamOpen] = useState(false)
  const [clipSrc, setClipSrc] = useState<string | null>(null)
  // last image right-clicked (main-process image menu acts on this)
  const imageMenuRef = useRef<{ pos: number; src: string } | null>(null)
  const [editorTarget, setEditorTarget] = useState<{ pos: number; baseSrc: string; initial: ImageEdits } | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [longDoc, setLongDoc] = useState(false)
  const [recovery, setRecovery] = useState<{ name: string; html: string; at: number } | null>(null)

  const activeDoc = useMemo(() => tabs.find((t) => t.id === activeId) ?? tabs[0], [tabs, activeId])
  const activeComments = commentsByDoc[activeId] ?? []
  const switchingRef = useRef(false)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const trackingRef = useRef(false)
  trackingRef.current = tracking
  const painterMarks = useRef<Record<string, unknown> | null>(null)
  const persistTimer = useRef<number | undefined>(undefined)
  const recoveryTimer = useRef<number | undefined>(undefined)

  // ---------- editor ----------
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript,
      LineHeight,
      Indent,
      Link.configure({ openOnClick: false, autolink: true }),
      AtlasImage,
      ImageGroup,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      PageBreak,
      SearchHighlight,
      CommentMark,
      InsertionMark,
      DeletionMark,
      FootnoteRef,
      TextBox,
      ShapeNode,
      EquationNode,
      DropCap,
      TocNode
    ],
    content: STARTER_HTML,
    editorProps: {
      attributes: { class: 'tiptap', spellcheck: 'true' },
      handleTextInput: (view, from, to, text) => {
        if (!trackingRef.current) return false
        const tr = view.state.tr.insertText(text, from, to)
        tr.addMark(from, from + text.length, view.state.schema.marks.insertion.create({ author: 'You', date: new Date().toISOString() }))
        view.dispatch(tr)
        return true
      },
      handleKeyDown: (view, e) => {
        if (!trackingRef.current) return false
        if (e.key !== 'Backspace' && e.key !== 'Delete') return false
        const { state } = view
        const { selection } = state
        const stamp = { author: 'You', date: new Date().toISOString() }
        const delType = state.schema.marks.deletion
        if (!delType) return false
        if (!selection.empty) {
          view.dispatch(state.tr.addMark(selection.from, selection.to, delType.create(stamp)))
          return true
        }
        if (e.key === 'Backspace') {
          if (selection.from <= 1) return false
          view.dispatch(state.tr.addMark(selection.from - 1, selection.from, delType.create(stamp)))
          return true
        }
        if (selection.to >= state.doc.content.size - 1) return false
        view.dispatch(state.tr.addMark(selection.to, selection.to + 1, delType.create(stamp)))
        return true
      },
      handlePaste: (view, e) => {
        const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (files.length > 0) {
          e.preventDefault()
          void (async () => {
            for (const f of files) {
              try {
                const { src, original } = await fileToAtlasSources(f)
                const node = view.state.schema.nodes.atlasImage.create({
                  ...DEFAULT_ATLAS_ATTRS,
                  src: src.dataUrl,
                  originalSrc: original.dataUrl,
                  naturalWidth: src.width,
                  naturalHeight: src.height
                })
                view.dispatch(view.state.tr.replaceSelectionWith(node))
              } catch (err) {
                console.error('image paste failed', err)
              }
            }
          })()
          return true
        }
        if (trackingRef.current) {
          const text = e.clipboardData?.getData('text/plain') ?? ''
          if (text) {
            e.preventDefault()
            const { from, to } = view.state.selection
            const tr = view.state.tr.insertText(text, from, to)
            tr.addMark(from, from + text.length, view.state.schema.marks.insertion.create({ author: 'You', date: new Date().toISOString() }))
            view.dispatch(tr)
            return true
          }
        }
        return false
      },
      handleDrop: (view, e) => {
        const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (files.length === 0) return false
        e.preventDefault()
        const coords = view.posAtCoords({ left: e.clientX, top: e.clientY })
        void (async () => {
          for (const f of files) {
            try {
              const { src, original } = await fileToAtlasSources(f)
              const node = view.state.schema.nodes.atlasImage.create({
                ...DEFAULT_ATLAS_ATTRS,
                src: src.dataUrl,
                originalSrc: original.dataUrl,
                naturalWidth: src.width,
                naturalHeight: src.height
              })
              const tr = view.state.tr.insert(coords?.pos ?? view.state.selection.from, node)
              view.dispatch(tr)
            } catch (err) {
              console.error('image drop failed', err)
            }
          }
        })()
        return true
      }
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      const text = ed.getText()
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
      setWordCount(words)
      setLongDoc(words > 15000)
      if (switchingRef.current) return
      // Large docs: debounce tab persistence to keep typing smooth
      const id = activeIdRef.current
      if (html.length > 400000) {
        window.clearTimeout(persistTimer.current)
        persistTimer.current = window.setTimeout(() => {
          setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, html, dirty: true } : t)))
        }, 800)
      } else {
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, html, dirty: true } : t)))
      }
      // Crash-recovery snapshot (debounced, localStorage guarded)
      window.clearTimeout(recoveryTimer.current)
      recoveryTimer.current = window.setTimeout(() => {
        try {
          const doc = { name: `recovery-${id}`, html, at: Date.now() }
          localStorage.setItem('wpp-recovery', JSON.stringify(doc).slice(0, 4000000))
        } catch {
          /* quota — skip */
        }
      }, 2000)
    }
  })

  // keep spellcheck attr in sync
  useEffect(() => {
    const dom = editor?.view.dom as HTMLElement | undefined
    if (dom) dom.setAttribute('spellcheck', spellcheck ? 'true' : 'false')
  }, [spellcheck, editor])

  // ---------- settings load + crash recovery check ----------
  useEffect(() => {
    api?.getSettings?.().then((s: Record<string, unknown>) => {
      if (!s) return
      if (s.theme === 'dark' || s.theme === 'light') {
        setTheme(s.theme)
        setAppSettings((p) => ({ ...p, theme: s.theme as AppSettings['theme'] }))
      }
      if (typeof s.zoom === 'number') setZoom(Math.min(500, Math.max(10, s.zoom)))
      if (s.pageSize) setPage((p) => ({ ...p, size: s.pageSize as PageSettings['size'] }))
      if (s.orientation) setPage((p) => ({ ...p, orientation: s.orientation as PageSettings['orientation'] }))
      if (s.margins) setPage((p) => ({ ...p, margins: s.margins as PageSettings['margins'] }))
      if (typeof s.columns === 'number') setPage((p) => ({ ...p, columns: s.columns as number }))
      if (typeof s.showRuler === 'boolean') setShowRuler(s.showRuler)
      if (typeof s.spellcheck === 'boolean') setSpellcheck(s.spellcheck)
      if (Array.isArray(s.customStyles) && (s.customStyles as StyleDef[]).length) setStyles(s.customStyles as StyleDef[])
      if (typeof s.autosaveSec === 'number') setAppSettings((p) => ({ ...p, autosaveSec: s.autosaveSec as number }))
      if (typeof s.defaultFont === 'string') setAppSettings((p) => ({ ...p, defaultFont: s.defaultFont as string }))
      if (typeof s.defaultSize === 'string') setAppSettings((p) => ({ ...p, defaultSize: s.defaultSize as string }))
      if (typeof s.language === 'string') setAppSettings((p) => ({ ...p, language: s.language as string }))
      if (typeof s.wordGoal === 'number') setAppSettings((p) => ({ ...p, wordGoal: s.wordGoal as number }))
      if (typeof s.watermark === 'string') setPage((p) => ({ ...p, watermark: s.watermark as string }))
      if (s.pageBorder) setPage((p) => ({ ...p, pageBorder: s.pageBorder as PageSettings['pageBorder'] }))
    })
    api?.getRecent?.().then((r: string[]) => Array.isArray(r) && setRecent(r))
    // Crash recovery: unclean flag means last session didn't shut down cleanly
    try {
      const clean = localStorage.getItem('wpp-clean')
      const raw = localStorage.getItem('wpp-recovery')
      if (raw && clean !== '1') {
        const doc = JSON.parse(raw) as { name: string; html: string; at: number }
        if (doc.html && doc.html !== STARTER_HTML) setRecovery(doc)
      }
      localStorage.setItem('wpp-clean', '0')
      const onBefore = () => {
        try {
          localStorage.setItem('wpp-clean', '1')
        } catch {
          /* noop */
        }
      }
      window.addEventListener('beforeunload', onBefore)
      // restore version snapshots
      try {
        const vs = localStorage.getItem('wpp-versions')
        if (vs) setSnapshots(JSON.parse(vs) as Snapshot[])
      } catch {
        /* noop */
      }
      return () => window.removeEventListener('beforeunload', onBefore)
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    api?.setSetting?.('theme', theme)
  }, [theme])
  useEffect(() => {
    api?.setSetting?.('zoom', zoom)
  }, [zoom])

  const patchPage = useCallback(
    (patch: Partial<PageSettings>) => {
      setPage((p) => {
        const next = { ...p, ...patch }
        api?.setSetting?.('pageSize', next.size)
        api?.setSetting?.('orientation', next.orientation)
        api?.setSetting?.('margins', next.margins)
        api?.setSetting?.('columns', next.columns)
        api?.setSetting?.('watermark', next.watermark ?? '')
        api?.setSetting?.('pageBorder', next.pageBorder ?? 'none')
        return next
      })
    },
    []
  )

  // ---------- tabs ----------
  const openHtmlAsTab = useCallback(
    (html: string, name: string, path: string | null) => {
      if (!editor) return
      setTabs((prev) => prev.map((t) => (t.id === activeIdRef.current ? { ...t, html: editor.getHTML() } : t)))
      const d: DocTab = { id: nextId++, name, path, html, dirty: false }
      setTabs((prev) => [...prev, d])
      switchingRef.current = true
      editor.commands.setContent(html)
      const text = editor.getText().trim()
      setWordCount(text === '' ? 0 : text.split(/\s+/).length)
      setActiveId(d.id)
      requestAnimationFrame(() => {
        switchingRef.current = false
      })
    },
    [editor]
  )

  const switchTab = useCallback(
    (id: number) => {
      if (id === activeId || !editor) return
      setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, html: editor.getHTML(), dirty: t.dirty } : t)))
      const next = tabs.find((t) => t.id === id)
      if (!next) return
      switchingRef.current = true
      editor.commands.setContent(next.html)
      const text = editor.getText().trim()
      setWordCount(text === '' ? 0 : text.split(/\s+/).length)
      setLongDoc(text === '' ? false : text.trim().split(/\s+/).length > 15000)
      setActiveId(id)
      requestAnimationFrame(() => {
        switchingRef.current = false
      })
    },
    [activeId, editor, tabs]
  )

  const applyDefaultFont = useCallback(() => {
    if (!editor) return
    const { defaultFont, defaultSize } = appSettings
    try {
      const c = editor.chain().focus()
      if (defaultFont && defaultFont !== 'Calibri') c.setFontFamily(defaultFont)
      if (defaultSize && defaultSize !== '11') (c as unknown as { setFontSize: (s: string) => unknown }).setFontSize(`${defaultSize}px`)
      c.run()
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, appSettings.defaultFont, appSettings.defaultSize])

  const newDoc = useCallback(() => {
    const d = blankDoc(tabs.length + 1)
    setTabs((prev) => [...prev, d])
    setTimeout(() => {
      if (!editor) {
        setActiveId(d.id)
        return
      }
      setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, html: editor.getHTML() } : t)))
      switchingRef.current = true
      editor.commands.setContent(d.html)
      setActiveId(d.id)
      setWordCount(STARTER_HTML.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length)
      requestAnimationFrame(() => {
        switchingRef.current = false
      })
      applyDefaultFont()
    }, 0)
  }, [activeId, editor, tabs.length, applyDefaultFont])

  const closeTab = useCallback(
    (id: number) => {
      setTabs((prev) => {
        if (prev.length === 1) {
          const d = blankDoc(1)
          switchingRef.current = true
          editor?.commands.setContent(d.html)
          setActiveId(d.id)
          requestAnimationFrame(() => {
            switchingRef.current = false
          })
          return [d]
        }
        const idx = prev.findIndex((t) => t.id === id)
        const next = prev.filter((t) => t.id !== id)
        if (id === activeId) {
          const follow = next[Math.max(0, idx - 1)]
          switchingRef.current = true
          editor?.commands.setContent(follow.html)
          setActiveId(follow.id)
          requestAnimationFrame(() => {
            switchingRef.current = false
          })
        }
        return next
      })
    },
    [activeId, editor]
  )

  // ---------- file ops ----------
  const writeCurrentTo = useCallback(
    async (targetPath: string, format: string) => {
      if (!editor || !api) return false
      try {
        if (format === 'txt') {
          await api.writeFile(targetPath, utf8ToBase64(editor.getText()))
        } else if (format === 'html') {
          await api.writeFile(targetPath, utf8ToBase64(editor.getHTML()))
        } else if (format === 'docx') {
          const blob = await htmlToDocxBlob(editor.getHTML())
          await api.writeFile(targetPath, await blobToBase64(blob))
        } else {
          await api.writeFile(targetPath, utf8ToBase64(editor.getHTML()))
        }
        const name = targetPath.split(/[/\\]/).pop() ?? 'Document'
        setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, path: targetPath, name: name.replace(/\.[^.]+$/, ''), dirty: false } : t)))
        const r = await api.getRecent()
        setRecent(r)
        return true
      } catch (err) {
        console.error('save failed', err)
        return false
      }
    },
    [activeId, api, editor]
  )

  const saveDoc = useCallback(
    async (saveAs = false) => {
      if (!editor || !api) return
      const doc = tabs.find((t) => t.id === activeId)
      const ext = doc?.path ? extOf(doc.path) : 'html'
      const format = ext === 'docx' ? 'docx' : ext === 'txt' ? 'txt' : 'html'
      if (!saveAs && doc?.path) {
        await writeCurrentTo(doc.path, format)
        return
      }
      const res = await api.saveDialog(`${doc?.name ?? 'Document'}.${format === 'html' ? 'html' : format}`, format)
      if (!res.canceled && res.path) await writeCurrentTo(res.path, format)
    },
    [activeId, api, editor, tabs, writeCurrentTo]
  )

  const saveProtected = useCallback(
    async (password: string) => {
      if (!editor || !api) return
      try {
        const envelope = await encryptText(editor.getHTML(), password)
        const doc = tabs.find((t) => t.id === activeId)
        const res = await api.saveDialog(`${doc?.name ?? 'Document'}.wppenc`, 'wppenc')
        if (res.canceled || !res.path) return
        await api.writeFile(res.path, utf8ToBase64(envelope))
        const name = (res.path.split(/[/\\]/).pop() ?? 'Document').replace(/\.[^.]+$/, '')
        setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, path: res.path as string, name, dirty: false } : t)))
        setRecent(await api.getRecent())
        setPwSaveOpen(false)
      } catch (err) {
        console.error('protected save failed', err)
      }
    },
    [activeId, api, editor, tabs]
  )

  const openDoc = useCallback(
    async (existingPath?: string) => {
      if (!editor || !api) return
      try {
        const res = existingPath ? await api.openPath(existingPath) : await api.openDialog()
        if (!res || res.canceled || !res.dataBase64) return
        const filePath = (res as { path: string }).path
        const ext = extOf(filePath)
        if (ext === 'docx') {
          const html = await docxToHtml(res.dataBase64)
          const name = (filePath.split(/[/\\]/).pop() ?? 'Document').replace(/\.[^.]+$/, '')
          openHtmlAsTab(html, name, filePath)
          setRecent(await api.getRecent())
          return
        }
        const raw = base64ToUtf8(res.dataBase64)
        if (looksEncrypted(raw)) {
          const name = (filePath.split(/[/\\]/).pop() ?? 'Document').replace(/\.[^.]+$/, '')
          setPendingUnlock({ raw, name, path: filePath })
          return
        }
        const html = ext === 'txt' ? `<p>${escapeHtml(raw)}</p>` : raw
        const name = (filePath.split(/[/\\]/).pop() ?? 'Document').replace(/\.[^.]+$/, '')
        openHtmlAsTab(html, name, filePath)
        setRecent(await api.getRecent())
      } catch (err) {
        console.error('open failed', err)
      }
    },
    [api, editor, openHtmlAsTab]
  )

  const unlockAndOpen = useCallback(
    async (password: string) => {
      if (!pendingUnlock) return
      try {
        const html = await decryptText(pendingUnlock.raw, password)
        openHtmlAsTab(html, pendingUnlock.name, pendingUnlock.path)
        setRecent(await api.getRecent())
        setPendingUnlock(null)
      } catch {
        alert('Wrong password — could not decrypt this document.')
      }
    },
    [api, openHtmlAsTab, pendingUnlock]
  )

  const exportAs = useCallback(
    async (format: 'pdf' | 'docx' | 'txt' | 'html') => {
      if (!editor || !api) return
      if (format === 'pdf') {
        await api.exportPdf()
        setRecent(await api.getRecent())
        return
      }
      const doc = tabs.find((t) => t.id === activeId)
      const res = await api.saveDialog(`${doc?.name ?? 'Document'}.${format}`, format)
      if (res.canceled || !res.path) return
      await writeCurrentTo(res.path, format)
    },
    [activeId, api, editor, tabs, writeCurrentTo]
  )

  const handleFileAction = useCallback(
    (a: 'new' | 'open' | 'save' | 'saveAs' | 'exportPdf' | 'exportDocx' | 'exportTxt' | 'exportHtml' | 'print' | 'printPreview' | 'clearRecent', payload?: string) => {
      switch (a) {
        case 'new':
          newDoc()
          break
        case 'open':
          openDoc(payload)
          break
        case 'save':
          saveDoc(false)
          break
        case 'saveAs':
          saveDoc(true)
          break
        case 'exportPdf':
          exportAs('pdf')
          break
        case 'exportDocx':
          exportAs('docx')
          break
        case 'exportTxt':
          exportAs('txt')
          break
        case 'exportHtml':
          exportAs('html')
          break
        case 'print':
          api?.print(false)
          break
        case 'printPreview':
          api?.print(true)
          break
        case 'clearRecent':
          api?.clearRecent().then(setRecent)
          break
      }
    },
    [api, exportAs, newDoc, openDoc, saveDoc]
  )

  // auto-save on configurable interval
  useEffect(() => {
    const ms = Math.min(600, Math.max(5, appSettings.autosaveSec)) * 1000
    const id = setInterval(async () => {
      const doc = tabs.find((t) => t.id === activeId)
      if (!doc?.dirty || !doc.path || !editor || !api) return
      const ext = extOf(doc.path)
      if (ext !== 'html' && ext !== 'txt') return
      try {
        const payload = ext === 'txt' ? utf8ToBase64(editor.getText()) : utf8ToBase64(editor.getHTML())
        await api.writeFile(doc.path, payload)
        setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, dirty: false } : t)))
      } catch (err) {
        console.error('auto-save failed', err)
      }
    }, ms)
    return () => clearInterval(id)
  }, [activeId, api, editor, tabs, appSettings.autosaveSec])

  // version snapshots every 5 minutes
  const takeSnapshot = useCallback(
    (label?: string) => {
      if (!editor) return
      const html = editor.getHTML()
      const words = editor.getText().trim().split(/\s+/).filter(Boolean).length
      setSnapshots((prev) => {
        const next = [...prev, { id: `v-${Date.now().toString(36)}`, at: Date.now(), html, label: label ?? `${words} words` }]
        const trimmed = next.slice(-12)
        try {
          localStorage.setItem('wpp-versions', JSON.stringify(trimmed).slice(0, 4000000))
        } catch {
          /* quota — keep in memory only */
        }
        return trimmed
      })
    },
    [editor]
  )

  useEffect(() => {
    const id = setInterval(() => takeSnapshot('auto'), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [takeSnapshot])

  const restoreSnapshot = useCallback(
    (s: Snapshot) => {
      if (!editor) return
      switchingRef.current = true
      editor.commands.setContent(s.html)
      setTabs((prev) => prev.map((t) => (t.id === activeIdRef.current ? { ...t, dirty: true } : t)))
      requestAnimationFrame(() => {
        switchingRef.current = false
      })
    },
    [editor]
  )

  // ---------- format painter ----------
  const armPainter = useCallback(() => {
    if (!editor) return
    const marks: Record<string, unknown> = {}
    const names = ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript', 'highlight', 'link']
    names.forEach((n) => {
      if (editor.isActive(n)) marks[n] = editor.getAttributes(n)
    })
    const ts = editor.getAttributes('textStyle') as Record<string, unknown>
    if (ts && (ts.color || ts.fontFamily || ts.fontSize)) marks.textStyle = ts
    painterMarks.current = marks
    setPainterArmed(true)
  }, [editor])

  useEffect(() => {
    if (!editor || !painterArmed) return
    const apply = () => {
      const marks = painterMarks.current
      if (!marks) return
      const c = editor.chain().focus()
      Object.entries(marks).forEach(([name, attrs]) => {
        if (name === 'textStyle' && attrs && typeof attrs === 'object') {
          const a = attrs as { color?: string; fontFamily?: string; fontSize?: string }
          if (a.color) c.setColor(a.color)
          if (a.fontFamily) c.setFontFamily(a.fontFamily)
          if (a.fontSize) (c as unknown as { setFontSize: (s: string) => unknown }).setFontSize(a.fontSize)
        } else if (name === 'link' && attrs && typeof attrs === 'object' && (attrs as { href?: string }).href) {
          c.setLink({ href: (attrs as { href: string }).href })
        } else if (name === 'highlight') {
          c.toggleHighlight(attrs as never)
        } else {
          const cmd = `toggle${name.charAt(0).toUpperCase()}${name.slice(1)}`
          ;(c as unknown as Record<string, () => unknown>)[cmd]?.()
        }
      })
      c.run()
      painterMarks.current = null
      setPainterArmed(false)
    }
    const once = () => {
      apply()
      editor.off('selectionUpdate', once)
    }
    editor.on('selectionUpdate', once)
    return () => {
      editor.off('selectionUpdate', once)
    }
  }, [editor, painterArmed])

  // ---------- images (Phase 1: atlas image node) ----------
  const insertAtlasFromDataUrl = useCallback(
    async (dataUrl: string, alt = '') => {
      if (!editor) return
      const { src, original } = await dataUrlToAtlasSources(dataUrl)
      editor
        .chain()
        .focus()
        .insertAtlasImage({
          src: src.dataUrl,
          originalSrc: original.dataUrl,
          naturalWidth: src.width,
          naturalHeight: src.height,
          alt
        })
        .run()
    },
    [editor]
  )

  const pickImage = useCallback(async () => {
    if (!editor || !api) return
    const res = await api.pickImage()
    if (res.canceled || !res.dataUrl) return
    try {
      await insertAtlasFromDataUrl(res.dataUrl)
    } catch (err) {
      alert(`Could not insert image: ${err instanceof Error ? err.message : err}`)
    }
  }, [api, editor, insertAtlasFromDataUrl])

  const insertImageFile = useCallback(
    async (f: File) => {
      if (!editor) return
      try {
        const { src, original } = await fileToAtlasSources(f)
        editor
          .chain()
          .focus()
          .insertAtlasImage({
            src: src.dataUrl,
            originalSrc: original.dataUrl,
            naturalWidth: src.width,
            naturalHeight: src.height,
            alt: f.name.replace(/\.[^.]+$/, '')
          })
          .run()
        setImageModalOpen(false)
      } catch (err) {
        alert(`Could not insert image: ${err instanceof Error ? err.message : err}`)
      }
    },
    [editor]
  )

  const insertImageUrl = useCallback(
    async (url: string) => {
      if (!editor) return
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (!blob.type.startsWith('image/')) throw new Error('URL did not return an image')
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result ?? ''))
          r.onerror = () => reject(new Error('Could not read image'))
          r.readAsDataURL(blob)
        })
        await insertAtlasFromDataUrl(dataUrl, url.split('/').pop()?.split('?')[0] ?? '')
        setImageModalOpen(false)
      } catch (err) {
        alert(`Could not fetch image (the server may block cross-origin reads): ${err instanceof Error ? err.message : err}`)
      }
    },
    [editor, insertAtlasFromDataUrl]
  )

  const captureScreenshot = useCallback(async () => {
    if (!editor) return
    if (!api?.captureScreenshot) {
      alert('Screenshots need the desktop app (Electron).')
      return
    }
    const res = await api.captureScreenshot()
    if (res.canceled || !res.dataUrl) {
      if (res.error) alert(`Screenshot failed: ${res.error}`)
      return
    }
    try {
      await insertAtlasFromDataUrl(res.dataUrl, 'Screenshot')
      setImageModalOpen(false)
    } catch (err) {
      alert(`Could not insert screenshot: ${err instanceof Error ? err.message : err}`)
    }
  }, [api, editor, insertAtlasFromDataUrl])

  const openCropForSelection = useCallback(() => {
    if (!editor) return
    const found = selectedAtlasImage(editor)
    if (!found) {
      alert('Select an image first, then open the crop tool.')
      return
    }
    const attrs = found.node.attrs as unknown as { src: string }
    setCropTarget({ pos: found.pos, src: attrs.src })
  }, [editor])

  const applyCrop = useCallback(
    (box: CropBox, shape: 'rect' | 'circle') => {
      if (!editor || !cropTarget) return
      setAtlasAttrsAt(editor, cropTarget.pos, { crop: box, cropShape: shape })
      setCropTarget(null)
    },
    [editor, cropTarget]
  )

  // Screen clipping: region-select on a screenshot, then insert the clip
  const startClip = useCallback(async () => {
    if (!api?.captureScreenshot) {
      alert('Screen clipping needs the desktop app (Electron).')
      return
    }
    const res = await api.captureScreenshot()
    if (res.canceled || !res.dataUrl) {
      if (res.error) alert(`Screenshot failed: ${res.error}`)
      return
    }
    setClipSrc(res.dataUrl)
  }, [api])

  const applyClip = useCallback(
    async (box: CropBox, shape: CropShape) => {
      if (!clipSrc) return
      try {
        const out = await renderCroppedBytes(clipSrc, box, shape, 'image/png')
        let bin = ''
        for (let i = 0; i < out.bytes.length; i += 0x8000) {
          bin += String.fromCharCode(...out.bytes.subarray(i, i + 0x8000))
        }
        await insertAtlasFromDataUrl(`data:image/png;base64,${btoa(bin)}`, 'Screen clipping')
      } catch (err) {
        alert(`Clip failed: ${err instanceof Error ? err.message : err}`)
      } finally {
        setClipSrc(null)
      }
    },
    [clipSrc, insertAtlasFromDataUrl]
  )

  // Track the image under the native context menu (main shows image actions for it)
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement
    const onCtx = (e: MouseEvent) => {
      imageMenuRef.current = null
      const frame = (e.target as HTMLElement).closest?.('.atlas-frame')
      if (!frame || !editor) return
      try {
        const pos = editor.view.posAtDOM(frame, 0)
        const node = editor.state.doc.nodeAt(pos)
        if (node?.type.name === 'atlasImage') {
          imageMenuRef.current = { pos, src: (node.attrs as unknown as { src: string }).src }
        }
      } catch {
        /* noop */
      }
    }
    dom.addEventListener('contextmenu', onCtx)
    return () => dom.removeEventListener('contextmenu', onCtx)
  }, [editor])

  const openSmart = useCallback((tab?: 'bg' | 'ocr' | 'alt' | 'generate' | 'stock' | 'icons') => {
    setSmartTab(tab)
    setSmartOpen(true)
  }, [])

  // Auto-open Picture Format when an image is selected (Word-style contextual tab)
  // + double-click opens the built-in image editor (atlas:edit-image from the NodeView)
  useEffect(() => {
    if (!editor) return
    const onSel = () => {
      if (selectedAtlasImage(editor)) {
        setRightPane((p) => (p === null || p === 'images' ? 'images' : p))
      }
    }
    const onEditRequest = () => {
      const found = selectedAtlasImage(editor)
      if (!found) return
      const attrs = found.node.attrs as unknown as { src: string; originalSrc: string; editsJson: string }
      setEditorTarget({ pos: found.pos, baseSrc: attrs.originalSrc || attrs.src, initial: parseEdits(attrs.editsJson ?? '') })
    }
    editor.on('selectionUpdate', onSel)
    window.addEventListener('atlas:edit-image', onEditRequest)
    return () => {
      editor.off('selectionUpdate', onSel)
      window.removeEventListener('atlas:edit-image', onEditRequest)
    }
  }, [editor])

  const applyEditorResult = useCallback(
    (dataUrl: string, edits: ImageEdits) => {
      if (!editor || !editorTarget) return
      setAtlasAttrsAt(editor, editorTarget.pos, { src: dataUrl, editsJson: JSON.stringify(edits) })
      setEditorTarget(null)
    },
    [editor, editorTarget]
  )

  // ---------- fullscreen ----------
  const toggleFullscreen = useCallback(() => {
    if (api?.setFullscreen) {
      api.setFullscreen()
      return
    }
    try {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen()
    } catch {
      /* noop */
    }
  }, [api])

  // ---------- templates ----------
  const applyTemplate = useCallback(
    (t: Template) => {
      openHtmlAsTab(t.html, t.name, null)
      setTemplatesOpen(false)
    },
    [openHtmlAsTab]
  )

  // ---------- settings ----------
  const saveSettings = useCallback(
    (s: AppSettings) => {
      setAppSettings(s)
      setTheme(s.theme)
      api?.setSetting?.('theme', s.theme)
      api?.setSetting?.('autosaveSec', s.autosaveSec)
      api?.setSetting?.('defaultFont', s.defaultFont)
      api?.setSetting?.('defaultSize', s.defaultSize)
      api?.setSetting?.('language', s.language)
      api?.setSetting?.('wordGoal', s.wordGoal)
      api?.setSetting?.('customStyles', styles)
      api?.setLanguage?.(s.language)
      setSettingsOpen(false)
    },
    [api, styles]
  )

  // ---------- menu actions from main ----------
  useEffect(() => {
    if (!api?.onMenuAction) return
    const off = api.onMenuAction((action: string, payload?: unknown) => {
      if (!editor) return
      const c = editor.chain().focus()
      switch (action) {
        case 'file:new':
          newDoc()
          break
        case 'file:open':
          openDoc()
          break
        case 'file:save':
          saveDoc(false)
          break
        case 'file:saveAs':
          saveDoc(true)
          break
        case 'file:protected':
          setPwSaveOpen(true)
          break
        case 'file:templates':
          setTemplatesOpen(true)
          break
        case 'file:exportPdf':
          exportAs('pdf')
          break
        case 'file:print':
          api.print(false)
          break
        case 'file:printPreview':
          api.print(true)
          break
        case 'edit:undo':
          editor.commands.undo()
          break
        case 'edit:redo':
          editor.commands.redo()
          break
        case 'edit:cut':
          document.execCommand('cut')
          break
        case 'edit:copy':
          document.execCommand('copy')
          break
        case 'edit:paste':
          document.execCommand('paste')
          break
        case 'edit:selectAll':
          c.selectAll().run()
          break
        case 'find:open':
          setFindOpen({ mode: 'find' })
          break
        case 'find:replace':
          setFindOpen({ mode: 'replace' })
          break
        case 'insert:image':
          pickImage()
          break
        case 'image:edit': {
          const t = imageMenuRef.current
          if (!editor || !t) break
          editor.chain().focus().setNodeSelection(t.pos).run()
          window.dispatchEvent(new CustomEvent('atlas:edit-image'))
          break
        }
        case 'image:crop': {
          const t = imageMenuRef.current
          if (!editor || !t) break
          setCropTarget({ pos: t.pos, src: t.src })
          break
        }
        case 'image:rotateL':
        case 'image:rotateR': {
          const t = imageMenuRef.current
          if (!editor || !t) break
          const node = editor.state.doc.nodeAt(t.pos)
          if (node?.type.name !== 'atlasImage') break
          const cur = (node.attrs as unknown as { rotation: 0 | 90 | 180 | 270 }).rotation ?? 0
          const steps = [0, 90, 180, 270] as const
          const next = steps[(steps.indexOf(cur) + (action === 'image:rotateR' ? 1 : 3)) % 4]
          setAtlasAttrsAt(editor, t.pos, { rotation: next })
          break
        }
        case 'image:flipH':
        case 'image:flipV': {
          const t = imageMenuRef.current
          if (!editor || !t) break
          const node = editor.state.doc.nodeAt(t.pos)
          if (node?.type.name !== 'atlasImage') break
          const attrs = node.attrs as unknown as { flipH: boolean; flipV: boolean }
          if (action === 'image:flipH') setAtlasAttrsAt(editor, t.pos, { flipH: !attrs.flipH })
          else setAtlasAttrsAt(editor, t.pos, { flipV: !attrs.flipV })
          break
        }
        case 'image:save': {
          const t = imageMenuRef.current
          setExportPos(t ? t.pos : null)
          break
        }
        case 'image:background': {
          const t = imageMenuRef.current
          if (!editor || !t) break
          try {
            const w = (editor.view.dom as HTMLElement).clientWidth || 640
            setAtlasAttrsAt(editor, t.pos, { wrap: 'behind', posX: 0.5, posY: 0.35, z: 0, align: 'center', width: Math.round(w) })
          } catch {
            /* noop */
          }
          break
        }
        case 'image:bgremove':
          openSmart('bg')
          break
        case 'image:ocr':
          openSmart('ocr')
          break
        case 'insert:link':
          setLinkOpen(true)
          break
        case 'insert:equation':
          setEquationOpen(true)
          break
        case 'insert:shape':
          setShapeOpen(true)
          break
        case 'insert:textbox':
          ;(editor.commands as unknown as { insertTextBox?: () => void }).insertTextBox?.()
          break
        case 'insert:footnote':
          setFootnoteKind('footnote')
          break
        case 'insert:endnote':
          setFootnoteKind('endnote')
          break
        case 'insert:comment':
          setRightPane('comments')
          break
        case 'insert:hr':
          c.setHorizontalRule().run()
          break
        case 'insert:pageBreak':
          ;(editor.commands as unknown as { setPageBreak: () => void }).setPageBreak()
          break
        case 'insert:datetime':
          c.insertContent(new Date().toLocaleString()).run()
          break
        case 'insert:toc':
          ;(editor.commands as unknown as { insertToc?: () => void }).insertToc?.()
          break
        case 'insert:merge':
          setMergeOpen(true)
          break
        case 'view:zoomIn':
          setZoom((z) => Math.min(500, z + 10))
          break
        case 'view:zoomOut':
          setZoom((z) => Math.max(10, z - 10))
          break
        case 'view:theme':
          setTheme((t) => (t === 'light' ? 'dark' : 'light'))
          break
        case 'view:ruler':
          setShowRuler((s) => !s)
          break
        case 'view:focus':
          setFocusMode((f) => !f)
          break
        case 'view:fullscreen':
          toggleFullscreen()
          break
        case 'view:nav':
          setLeftPane((p) => (p === 'nav' ? null : 'nav'))
          break
        case 'view:history':
          setRightPane((p) => (p === 'history' ? null : 'history'))
          break
        case 'review:wordcount':
          setWcOpen(true)
          break
        case 'review:acceptAll':
          acceptAllTracked(editor)
          break
        case 'review:rejectAll':
          rejectAllTracked(editor)
          break
        case 'app:settings':
          setSettingsOpen(true)
          break
        case 'spell:replace':
          c.insertContent(String(payload ?? '')).run()
          break
      }
    })
    return off
  }, [api, editor, exportAs, newDoc, openDoc, pickImage, saveDoc, toggleFullscreen, openSmart])

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const modKey = isMac ? e.metaKey : e.ctrlKey
      if (!modKey) {
        if (e.key === 'Escape') {
          if (focusMode) setFocusMode(false)
          setFindOpen(null)
          setWcOpen(false)
          setLinkOpen(false)
          setSpecialOpen(false)
          setEquationOpen(false)
          setShapeOpen(false)
          setFootnoteKind(null)
          setMergeOpen(false)
          setSettingsOpen(false)
          setTemplatesOpen(false)
          setImageModalOpen(false)
          setCropTarget(null)
          setEditorTarget(null)
          setSmartOpen(false)
          setCollageOpen(false)
          setExportPos(undefined)
          setWebcamOpen(false)
          setClipSrc(null)
        }
        return
      }
      const k = e.key.toLowerCase()
      const needPrevent = ['s', 'o', 'n', 'p', 'f', 'h', 'y'].includes(k) || (k === 'z' && e.shiftKey)
      switch (k) {
        case 's':
          e.preventDefault()
          if (e.shiftKey) saveDoc(true)
          else saveDoc(false)
          break
        case 'o':
          e.preventDefault()
          openDoc()
          break
        case 'n':
          e.preventDefault()
          newDoc()
          break
        case 'p':
          e.preventDefault()
          if (e.shiftKey) api?.print(true)
          else api?.print(false)
          break
        case 'f':
          e.preventDefault()
          setFindOpen({ mode: 'find' })
          break
        case 'h':
          e.preventDefault()
          setFindOpen({ mode: 'replace' })
          break
        case 'y':
          if (!isMac) {
            e.preventDefault()
            editor?.commands.redo()
          }
          break
        default:
          if (needPrevent) e.preventDefault()
          break
      }
      if (k === 'z' && e.shiftKey) {
        e.preventDefault()
        editor?.commands.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [api, editor, focusMode, isMac, newDoc, openDoc, saveDoc])

  const readMode = viewMode === 'read'

  const adv: AdvActions = {
    openStyles: () => setRightPane((p) => (p === 'styles' ? null : 'styles')),
    openEquation: () => setEquationOpen(true),
    openShape: () => setShapeOpen(true),
    insertTextbox: () => (editor?.commands as unknown as { insertTextBox?: () => void }).insertTextBox?.(),
    openFootnote: (kind) => setFootnoteKind(kind),
    openComments: () => setRightPane((p) => (p === 'comments' ? null : 'comments')),
    tracking,
    onToggleTrack: () => setTracking((t) => !t),
    openTrack: () => setRightPane((p) => (p === 'track' ? null : 'track')),
    onAcceptAll: () => editor && acceptAllTracked(editor),
    onRejectAll: () => editor && rejectAllTracked(editor),
    openToc: () => setRightPane((p) => (p === 'toc' ? null : 'toc')),
    onTocInsert: () => (editor?.commands as unknown as { insertToc?: () => void }).insertToc?.(),
    onTocRefresh: () => (editor?.commands as unknown as { refreshToc?: () => boolean }).refreshToc?.(),
    openMerge: () => setMergeOpen(true),
    openImageUrl: () => setImageModalOpen(true),
    openScreenshot: () => void captureScreenshot(),
    openCollage: () => setCollageOpen(true),
    openWebcam: () => setWebcamOpen(true),
    openClip: () => void startClip(),
    openExportImage: () => {
      const found = editor ? selectedAtlasImage(editor) : null
      setExportPos(found ? found.pos : null)
    },
    openPictureFormat: () => setRightPane((p) => (p === 'images' ? null : 'images')),
    openNav: () => setLeftPane((p) => (p === 'nav' ? null : 'nav')),
    openHistory: () => setRightPane((p) => (p === 'history' ? null : 'history')),
    openTemplates: () => setTemplatesOpen(true),
    onSaveProtected: () => setPwSaveOpen(true),
    openSettings: () => setSettingsOpen(true),
    onToggleFocus: () => setFocusMode((f) => !f),
    focusMode,
    onToggleFullscreen: toggleFullscreen,
    onToggleDropCap: () => (editor?.commands as unknown as { toggleDropCap?: () => void }).toggleDropCap?.(),
    dropCapOn: (() => {
      try {
        return (editor?.getAttributes('paragraph') as { dropCap?: boolean } | undefined)?.dropCap ?? false
      } catch {
        return false
      }
    })(),
    watermark: page.watermark ?? '',
    onWatermark: (text) => patchPage({ watermark: text }),
    pageBorder: page.pageBorder ?? 'none',
    onPageBorder: (b) => patchPage({ pageBorder: b })
  }

  return (
    <div className={`flex h-full flex-col bg-white font-segoe text-neutral-900 dark:bg-[#111111] dark:text-neutral-100 ${readMode ? 'read-mode' : ''}`}>
      <TitleBar
        docName={activeDoc?.name ?? 'Document1'}
        dirty={activeDoc?.dirty ?? false}
        isMac={isMac}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onSave={() => saveDoc(false)}
        onUndo={() => editor?.commands.undo()}
        onRedo={() => editor?.commands.redo()}
      />
      {!readMode && !focusMode && (
        <Ribbon
          editor={editor}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isMac={isMac}
          painterArmed={painterArmed}
          onPainter={armPainter}
          onOpenFind={() => setFindOpen({ mode: 'find' })}
          onOpenReplace={() => setFindOpen({ mode: 'replace' })}
          onFileAction={handleFileAction}
          recent={recent}
          page={page}
          onPage={patchPage}
          onOpenWordCount={() => setWcOpen(true)}
          onOpenLink={() => setLinkOpen(true)}
          onOpenSpecial={() => setSpecialOpen(true)}
          onPickImage={pickImage}
          spellcheck={spellcheck}
          onToggleSpell={() => {
            setSpellcheck((s) => {
              api?.setSetting?.('spellcheck', !s)
              return !s
            })
          }}
          showRuler={showRuler}
          onToggleRuler={() => {
            setShowRuler((s) => {
              api?.setSetting?.('showRuler', !s)
              return !s
            })
          }}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          zoom={zoom}
          onZoom={setZoom}
          adv={adv}
        />
      )}
      {focusMode && (
        <div className="flex items-center justify-center gap-2 border-b border-neutral-200 bg-[#F3F3F3] py-1 text-[12px] text-neutral-500 dark:border-neutral-700 dark:bg-[#1e1e1e]">
          Focus mode — press Esc to exit
          <button onClick={() => setFocusMode(false)} className="rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-200 dark:border-neutral-600">
            Exit
          </button>
        </div>
      )}
      {!focusMode && <DocTabs tabs={tabs} activeId={activeId} onSwitch={switchTab} onClose={closeTab} onNew={newDoc} />}

      {recovery && (
        <div role="alert" className="flex items-center justify-center gap-3 bg-amber-100 px-3 py-1.5 text-[12px] text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          <span>
            Recovered unsaved work from {new Date(recovery.at).toLocaleString()}. Restore it?
          </span>
          <button
            onClick={() => {
              openHtmlAsTab(recovery.html, 'Recovered Document', null)
              setRecovery(null)
              try {
                localStorage.removeItem('wpp-recovery')
              } catch {
                /* noop */
              }
            }}
            className="rounded bg-amber-600 px-2.5 py-0.5 font-medium text-white"
          >
            Restore
          </button>
          <button
            onClick={() => {
              setRecovery(null)
              try {
                localStorage.removeItem('wpp-recovery')
              } catch {
                /* noop */
              }
            }}
            className="rounded border border-amber-600 px-2.5 py-0.5"
          >
            Discard
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {leftPane === 'nav' && !focusMode && <NavPane editor={editor} onClose={() => setLeftPane(null)} />}
        <main className="word-scroll relative min-h-0 flex-1 overflow-auto bg-[#E6E6E6] dark:bg-[#0d0d0d]">
          {showRuler && !readMode && <Ruler editor={editor} page={page} zoom={zoom} />}
          {findOpen && (
            <FindReplace editor={editor} mode={findOpen.mode} onClose={() => {
              setFindOpen(null)
              ;(editor?.commands as unknown as { clearSearch?: () => void }).clearSearch?.()
            }} />
          )}
          <EditorView
            editor={editor}
            page={page}
            zoom={zoom}
            header={header}
            footer={footer}
            onHeader={setHeader}
            onFooter={setFooter}
            readMode={readMode}
            longDoc={longDoc}
          />
          {longDoc && (
            <div className="sticky bottom-2 mx-auto w-fit rounded-full bg-[#2B579A] px-3 py-1 text-[11px] text-white shadow" title="Large-document mode: off-screen blocks are virtualized with content-visibility">
              Performance mode on ({wordCount.toLocaleString()} words)
            </div>
          )}
        </main>
        {!focusMode && rightPane === 'styles' && (
          <StylesPane editor={editor} styles={styles} onChange={(s) => { setStyles(s); api?.setSetting?.('customStyles', s) }} onClose={() => setRightPane(null)} />
        )}
        {!focusMode && rightPane === 'comments' && (
          <CommentsPane editor={editor} comments={activeComments} onChange={(c) => setCommentsByDoc((prev) => ({ ...prev, [activeId]: c }))} onClose={() => setRightPane(null)} />
        )}
        {!focusMode && rightPane === 'toc' && <TocPane editor={editor} onClose={() => setRightPane(null)} />}
        {!focusMode && rightPane === 'history' && (
          <HistoryPane snapshots={snapshots} onRestore={restoreSnapshot} onSnapshot={() => takeSnapshot('manual')} onClose={() => setRightPane(null)} />
        )}
        {!focusMode && rightPane === 'track' && (
          <TrackPane editor={editor} tracking={tracking} onToggleTracking={() => setTracking((t) => !t)} onClose={() => setRightPane(null)} />
        )}
        {!focusMode && rightPane === 'images' && (
          <FormatPanel
            editor={editor}
            onClose={() => setRightPane(null)}
            onOpenCrop={openCropForSelection}
            onOpenEditor={() => window.dispatchEvent(new CustomEvent('atlas:edit-image'))}
            onOpenSmart={() => setSmartOpen(true)}
          />
        )}
      </div>

      <StatusBar
        page={1}
        wordCount={wordCount}
        zoom={zoom}
        onZoomChange={setZoom}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenWordCount={() => setWcOpen(true)}
        wordGoal={appSettings.wordGoal}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {wcOpen && <WordCountDialog editor={editor} onClose={() => setWcOpen(false)} />}
      {linkOpen && <LinkDialog editor={editor} onClose={() => setLinkOpen(false)} />}
      {specialOpen && <SpecialCharsDialog editor={editor} onClose={() => setSpecialOpen(false)} />}
      {settingsOpen && <SettingsModal initial={appSettings} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
      {templatesOpen && <TemplatesModal onPick={applyTemplate} onClose={() => setTemplatesOpen(false)} />}
      {pwSaveOpen && <PasswordModal title="Protect document with password" confirm onSubmit={saveProtected} onClose={() => setPwSaveOpen(false)} />}
      {pendingUnlock && (
        <PasswordModal title={`Unlock “${pendingUnlock.name}”`} onSubmit={unlockAndOpen} onClose={() => setPendingUnlock(null)} />
      )}
      {equationOpen && <EquationDialog editor={editor} onClose={() => setEquationOpen(false)} />}
      {shapeOpen && <ShapeDialog editor={editor} onClose={() => setShapeOpen(false)} />}
      {footnoteKind && (
        <FootnoteDialog
          kind={footnoteKind}
          onSubmit={(note) => {
            ;(editor?.commands as unknown as { insertFootnote?: (n: string, k: string) => void }).insertFootnote?.(note, footnoteKind)
            setFootnoteKind(null)
          }}
          onClose={() => setFootnoteKind(null)}
        />
      )}
      {mergeOpen && <MergeDialog editor={editor} onClose={() => setMergeOpen(false)} />}
      {imageModalOpen && (
        <InsertImageModal
          onInsertUrl={insertImageUrl}
          onPickFile={(f) => void insertImageFile(f)}
          onScreenshot={() => void captureScreenshot()}
          screenshotAvailable={!!api?.captureScreenshot}
          onClose={() => setImageModalOpen(false)}
        />
      )}
      {cropTarget && (
        <CropOverlay
          src={cropTarget.src}
          onApply={applyCrop}
          onClose={() => setCropTarget(null)}
        />
      )}
      {editorTarget && (
        <ImageEditorModal
          baseSrc={editorTarget.baseSrc}
          initial={editorTarget.initial}
          onApply={applyEditorResult}
          onClose={() => setEditorTarget(null)}
        />
      )}
      {smartOpen &&
        (() => {
          const found = editor ? selectedAtlasImage(editor) : null
          const attrs = found?.node.attrs as unknown as { src: string } | undefined
          return (
            <SmartToolsModal
              editor={editor}
              initialTab={smartTab}
              imagePos={found ? found.pos : null}
              imageSrc={attrs?.src ?? ''}
              onInsertImage={(u, alt) => void insertAtlasFromDataUrl(u, alt)}
              onClose={() => {
                setSmartOpen(false)
                setSmartTab(undefined)
              }}
            />
          )
        })()}
      {collageOpen && <CollageModal editor={editor} onClose={() => setCollageOpen(false)} />}
      {exportPos !== undefined && (
        <ExportImageModal editor={editor} initialPos={exportPos} onClose={() => setExportPos(undefined)} />
      )}
      {webcamOpen && (
        <WebcamModal
          onCapture={(shot) => {
            setWebcamOpen(false)
            void insertAtlasFromDataUrl(shot, 'Webcam photo')
          }}
          onClose={() => setWebcamOpen(false)}
        />
      )}
      {clipSrc && (
        <CropOverlay
          src={clipSrc}
          onApply={(box, shape) => void applyClip(box, shape)}
          onClose={() => setClipSrc(null)}
        />
      )}
    </div>
  )
}
