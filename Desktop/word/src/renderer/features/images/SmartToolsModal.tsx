/** Smart tools dialog: background removal, OCR, AI alt-text/generation, stock, icons/emoji. */

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Modal } from '../../components/Dialogs'
import { removeImageBackground, ocrImage, type OcrLang } from './smart'
import { generateAltText, generateImages, type AiEndpoint } from './ai'
import { searchStock, stockToDataUrl, EMOJI_SETS, BUILTIN_ICONS, svgToDataUrl, type StockPhoto, type StockProvider } from './stock'
import { setAtlasAttrsAt } from './imageNode'

type Tab = 'bg' | 'ocr' | 'alt' | 'generate' | 'stock' | 'icons'

interface SmartToolsModalProps {
  editor: Editor | null
  initialTab?: Tab
  imagePos: number | null
  imageSrc: string
  onInsertImage: (dataUrl: string, alt?: string) => void
  onClose: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = typeof window !== 'undefined' ? ((window as any).electron as any | undefined) : undefined

function KeyField({ service, label, tip }: { service: string; label: string; tip: string }) {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api
      ?.secretGet?.(service)
      .then((r: { ok: boolean; value?: string; persistent?: boolean }) => {
        if (r?.ok && r.value) {
          setKey(r.value)
          setSaved(r.persistent ?? false)
        }
      })
      .catch(() => undefined)
  }, [service])
  const save = async () => {
    if (!api?.secretSet) return
    setBusy(true)
    try {
      const r = await api.secretSet(service, key.trim())
      if (r?.ok) setSaved(r.persistent ?? false)
      else alert(`Could not save key: ${r?.error ?? 'unknown error'}`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div title={tip}>
      <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300" htmlFor={`key-${service}`}>
        {label} {saved !== null && <span className="text-neutral-400">({saved ? 'stored securely on this device' : 'kept for this session only'})</span>}
      </label>
      <div className="flex gap-1.5">
        <input
          id={`key-${service}`}
          type="password"
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            setSaved(null)
          }}
          placeholder="Paste API key…"
          autoComplete="off"
          className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800"
        />
        <button onClick={save} disabled={busy || !key.trim()} title="Save key (OS keychain when available)" className="rounded bg-[#2B579A] px-3 py-1.5 text-[13px] text-white disabled:opacity-40">
          Save
        </button>
      </div>
    </div>
  )
}

export function SmartToolsModal({ editor, initialTab, imagePos, imageSrc, onInsertImage, onClose }: SmartToolsModalProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? (imagePos !== null ? 'bg' : 'generate'))
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState(0)
  const [bgResult, setBgResult] = useState('')
  const [ocrLangs, setOcrLangs] = useState<OcrLang[]>(['eng'])
  const [ocrText, setOcrText] = useState('')
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1')
  const [aiModel, setAiModel] = useState('gpt-4o-mini')
  const [aiKey, setAiKey] = useState('')
  const [altResult, setAltResult] = useState('')
  const [manualAlt, setManualAlt] = useState('')
  const [prompt, setPrompt] = useState('')
  const [genSize, setGenSize] = useState('1024x1024')
  const [genCount, setGenCount] = useState(1)
  const [genResults, setGenResults] = useState<string[]>([])
  const [provider, setProvider] = useState<StockProvider>('unsplash')
  const [query, setQuery] = useState('')
  const [stock, setStock] = useState<StockPhoto[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api?.secretGet?.('ai').then((r: { ok: boolean; value?: string }) => r?.ok && r.value && setAiKey(r.value)).catch(() => undefined)
    api?.getSettings?.().then((s: Record<string, unknown>) => {
      if (!s) return
      if (typeof s.aiEndpoint === 'string') setEndpoint(s.aiEndpoint)
      if (typeof s.aiModel === 'string') setAiModel(s.aiModel)
      if (typeof s.stockProvider === 'string' && (s.stockProvider === 'unsplash' || s.stockProvider === 'pexels')) setProvider(s.stockProvider)
    }).catch(() => undefined)
  }, [])

  const needImage = imagePos === null || !imageSrc
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setError('')
    setProgress(0)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  const aiEp = (): AiEndpoint => ({ baseUrl: endpoint, apiKey: aiKey.trim(), model: aiModel.trim() || 'gpt-4o-mini' })

  const doRemoveBg = () =>
    run('Removing background… (first run downloads the model)', async () => {
      const out = await removeImageBackground(imageSrc, (f) => setProgress(f))
      setBgResult(out)
    })

  const applyBg = () => {
    if (!editor || imagePos === null || !bgResult) return
    setAtlasAttrsAt(editor, imagePos, { src: bgResult })
    onClose()
  }

  const doOcr = () =>
    run('Recognizing text…', async () => {
      const text = await ocrImage(imageSrc, ocrLangs, (f) => setProgress(f))
      setOcrText(text || '(no text recognized)')
    })

  const insertOcrText = () => {
    if (!editor || !ocrText) return
    const paras = ocrText
      .split(/\n\s*\n/)
      .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br />')}</p>`)
      .join('')
    editor.chain().focus().insertContent(paras || '<p></p>').run()
    onClose()
  }

  const doAltText = () =>
    run('Asking the model…', async () => {
      if (!aiKey.trim()) throw new Error('Save an AI API key first (or type alt text manually below).')
      const t = await generateAltText(imageSrc, aiEp())
      setAltResult(t)
    })

  const applyAlt = (text: string) => {
    if (!editor || imagePos === null || !text.trim()) return
    setAtlasAttrsAt(editor, imagePos, { alt: text.trim() })
    onClose()
  }

  const doGenerate = () =>
    run('Generating images…', async () => {
      if (!aiKey.trim()) throw new Error('Save an AI API key first.')
      if (!prompt.trim()) throw new Error('Describe the image to generate.')
      api?.setSetting?.('aiEndpoint', endpoint)
      api?.setSetting?.('aiModel', aiModel)
      setGenResults(await generateImages(prompt.trim(), aiEp(), genCount, genSize))
    })

  const doStock = () =>
    run('Searching stock…', async () => {
      const keyRes = await api?.secretGet?.(`stock-${provider}`)
      const key = keyRes?.value?.trim() ?? ''
      if (!key) throw new Error(`Save a ${provider === 'unsplash' ? 'Unsplash' : 'Pexels'} API key first.`)
      if (!query.trim()) throw new Error('Type a search query first.')
      api?.setSetting?.('stockProvider', provider)
      setStock(await searchStock(provider, key, query.trim()))
    })

  const insertStock = async (p: StockPhoto) => {
    setBusy(`Downloading photo by ${p.author}…`)
    try {
      onInsertImage(await stockToDataUrl(p.full || p.thumb), `${p.alt} (Photo by ${p.author})`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy('')
    }
  }

  const insertEmoji = (e: string) => {
    editor?.chain().focus().insertContent(e).run()
  }

  const TABS: { id: Tab; label: string; tip: string }[] = [
    { id: 'bg', label: 'Remove BG', tip: 'Remove background on-device (offline after first model download)' },
    { id: 'ocr', label: 'OCR', tip: 'Extract text from the image (English + Tamil)' },
    { id: 'alt', label: 'Alt text', tip: 'Suggest alt text with AI, or type it manually' },
    { id: 'generate', label: 'Generate', tip: 'Generate images with your own AI key' },
    { id: 'stock', label: 'Stock', tip: 'Search Unsplash/Pexels with your own key' },
    { id: 'icons', label: 'Icons', tip: 'Emoji + built-in icon picker' }
  ]

  return (
    <Modal title="Smart image tools" onClose={onClose}>
      <div className="mb-2 grid grid-cols-6 gap-1" role="tablist" aria-label="Smart tools">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id)
              setError('')
            }}
            title={t.tip}
            className={`rounded py-1 text-[11px] ${tab === t.id ? 'bg-[#2B579A] text-white' : 'border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {busy && (
        <div className="mb-2" role="status" title="Working…">
          <div className="text-[12px] text-neutral-600 dark:text-neutral-300">{busy}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div className="h-full rounded-full bg-[#2B579A] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mb-2 rounded bg-red-50 p-2 text-[12px] text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      {tab === 'bg' && (
        <div>
          {needImage ? (
            <p className="py-3 text-center text-[13px] text-neutral-500">Select an image in the document first.</p>
          ) : (
            <>
              {!bgResult ? (
                <button onClick={doRemoveBg} disabled={!!busy} title="Run on-device background removal" className="w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white disabled:opacity-50">
                  Remove background
                </button>
              ) : (
                <>
                  <img src={bgResult} alt="Background removal preview" className="mx-auto max-h-56 rounded border border-neutral-300" style={{ background: 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 16px 16px' }} />
                  <div className="mt-2 flex gap-2">
                    <button onClick={applyBg} title="Replace the document image (original kept for Reset)" className="flex-1 rounded bg-[#2B579A] py-1.5 text-[13px] text-white">Apply</button>
                    <button onClick={() => setBgResult('')} title="Discard result" className="rounded border border-neutral-300 px-4 py-1.5 text-[13px]">Retry</button>
                  </div>
                </>
              )}
              <p className="mt-1.5 text-[11px] text-neutral-500">Runs fully on-device. First use downloads the model (~40MB), then works offline.</p>
            </>
          )}
        </div>
      )}

      {tab === 'ocr' && (
        <div>
          {needImage ? (
            <p className="py-3 text-center text-[13px] text-neutral-500">Select an image in the document first.</p>
          ) : (
            <>
              <div className="mb-2 flex gap-3 text-[13px]" role="group" aria-label="OCR languages">
                {(['eng', 'tam'] as OcrLang[]).map((l) => (
                  <label key={l} className="flex items-center gap-1.5" title={l === 'eng' ? 'English' : 'Tamil (தமிழ்)'}>
                    <input
                      type="checkbox"
                      checked={ocrLangs.includes(l)}
                      onChange={(e) => setOcrLangs((p) => (e.target.checked ? [...p, l] : p.filter((x) => x !== l)))}
                    />
                    {l === 'eng' ? 'English' : 'Tamil'}
                  </label>
                ))}
                <button onClick={doOcr} disabled={!!busy} title="Extract text from the selected image" className="ml-auto rounded bg-[#2B579A] px-3 py-1 text-white disabled:opacity-50">
                  Extract
                </button>
              </div>
              <textarea aria-label="Recognized text" value={ocrText} onChange={(e) => setOcrText(e.target.value)} rows={5} placeholder="Recognized text appears here…" className="w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
              <div className="mt-2 flex gap-2">
                <button onClick={insertOcrText} disabled={!ocrText} title="Insert the text into the document at the cursor" className="flex-1 rounded bg-[#2B579A] py-1.5 text-[13px] text-white disabled:opacity-40">
                  Insert as text
                </button>
                <button
                  onClick={() => ocrText && navigator.clipboard?.writeText(ocrText)}
                  disabled={!ocrText}
                  title="Copy to clipboard"
                  className="rounded border border-neutral-300 px-4 py-1.5 text-[13px] disabled:opacity-40"
                >
                  Copy
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'alt' && (
        <div className="space-y-2">
          <KeyField service="ai" label="AI API key (OpenAI-compatible)" tip="Stored in the OS keychain via Electron safeStorage when available" />
          <div className="grid grid-cols-2 gap-1.5">
            <label className="block text-[12px]" title="Base URL of an OpenAI-compatible API">
              <span className="text-neutral-600 dark:text-neutral-300">Endpoint</span>
              <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://api.openai.com/v1" className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
            </label>
            <label className="block text-[12px]" title="Vision-capable model name">
              <span className="text-neutral-600 dark:text-neutral-300">Model</span>
              <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="gpt-4o-mini" className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
            </label>
          </div>
          <button onClick={doAltText} disabled={!!busy || needImage} title="Generate alt text for the selected image" className="w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white disabled:opacity-40">
            Suggest alt text with AI
          </button>
          {altResult && (
            <div className="rounded border border-neutral-300 p-2 text-[13px] dark:border-neutral-600">
              {altResult}
              <button onClick={() => applyAlt(altResult)} disabled={needImage} title="Use this as the image alt text" className="mt-1.5 w-full rounded bg-[#2B579A] py-1 text-white disabled:opacity-40">
                Use as alt text
              </button>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[12px] text-neutral-600 dark:text-neutral-300" htmlFor="manual-alt">
              Or type alt text manually
            </label>
            <div className="flex gap-1.5">
              <input id="manual-alt" value={manualAlt} onChange={(e) => setManualAlt(e.target.value)} placeholder="Describe the image…" className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
              <button onClick={() => applyAlt(manualAlt)} disabled={needImage || !manualAlt.trim()} title="Save typed alt text" className="rounded border border-neutral-300 px-3 py-1.5 text-[13px] disabled:opacity-40">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'generate' && (
        <div className="space-y-2">
          <KeyField service="ai" label="AI API key (OpenAI-compatible)" tip="Stored in the OS keychain via Electron safeStorage when available" />
          <div className="grid grid-cols-2 gap-1.5">
            <label className="block text-[12px]" title="Base URL of an OpenAI-compatible API">
              <span className="text-neutral-600 dark:text-neutral-300">Endpoint</span>
              <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
            </label>
            <label className="block text-[12px]" title="Image model name">
              <span className="text-neutral-600 dark:text-neutral-300">Model</span>
              <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="dall-e-3" className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
            </label>
          </div>
          <label className="block text-[12px]" title="Describe the image to create">
            <span className="text-neutral-600 dark:text-neutral-300">Prompt</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="A watercolor fox in a forest…" className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
          </label>
          <div className="flex gap-1.5">
            <label className="flex items-center gap-1 text-[12px]" title="Output size">
              Size
              <select value={genSize} onChange={(e) => setGenSize(e.target.value)} className="rounded border border-neutral-300 px-1 py-1 dark:border-neutral-600 dark:bg-neutral-800">
                <option>1024x1024</option>
                <option>1792x1024</option>
                <option>1024x1792</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-[12px]" title="How many variants (1-4)">
              Count
              <input type="number" min={1} max={4} value={genCount} onChange={(e) => setGenCount(Number(e.target.value) || 1)} className="w-14 rounded border border-neutral-300 px-1 py-1 dark:border-neutral-600 dark:bg-neutral-800" />
            </label>
            <button onClick={doGenerate} disabled={!!busy} title="Generate images with your key" className="flex-1 rounded bg-[#2B579A] py-1.5 text-[13px] text-white disabled:opacity-50">
              Generate
            </button>
          </div>
          {genResults.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {genResults.map((u, i) => (
                <button key={i} onClick={() => { onInsertImage(u, prompt.slice(0, 120)); onClose() }} title="Insert this image into the document" className="overflow-hidden rounded border border-neutral-300 hover:border-[#2B579A]">
                  <img src={u} alt={`Generated option ${i + 1}`} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'stock' && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <select aria-label="Stock provider" value={provider} onChange={(e) => setProvider(e.target.value as StockProvider)} title="Stock provider" className="rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800">
              <option value="unsplash">Unsplash</option>
              <option value="pexels">Pexels</option>
            </select>
            <input aria-label="Stock search query" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doStock()} placeholder="Search photos…" className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-[13px] dark:border-neutral-600 dark:bg-neutral-800" />
            <button onClick={doStock} disabled={!!busy} title="Search stock photos" className="rounded bg-[#2B579A] px-3 py-1.5 text-[13px] text-white disabled:opacity-50">
              Go
            </button>
          </div>
          <KeyField service={`stock-${provider}`} label={`${provider === 'unsplash' ? 'Unsplash' : 'Pexels'} API key`} tip="Free key from the provider site; stored securely on this device" />
          {stock.length > 0 && (
            <div className="grid max-h-64 grid-cols-3 gap-1.5 overflow-auto">
              {stock.map((p) => (
                <button key={p.id} onClick={() => insertStock(p)} title={`Insert "${p.alt}" (photo by ${p.author})`} className="overflow-hidden rounded border border-neutral-300 hover:border-[#2B579A]">
                  <img src={p.thumb} alt={p.alt} loading="lazy" className="aspect-square w-full object-cover" />
                  <div className="truncate px-1 py-0.5 text-left text-[10px] text-neutral-500">by {p.author}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'icons' && (
        <div className="space-y-3">
          {EMOJI_SETS.map((set) => (
            <div key={set.name}>
              <div className="mb-1 text-[12px] font-medium text-neutral-600 dark:text-neutral-300">{set.name} (click to insert at cursor)</div>
              <div className="grid grid-cols-8 gap-1">
                {set.items.map((e) => (
                  <button key={e} onClick={() => insertEmoji(e)} title={`Insert ${e}`} aria-label={`Insert emoji ${e}`} className="rounded border border-neutral-200 py-1 text-[18px] hover:border-[#2B579A] hover:bg-[#D6E4F7] dark:border-neutral-700">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="mb-1 text-[12px] font-medium text-neutral-600 dark:text-neutral-300">Icons (insert as pictures)</div>
            <div className="grid grid-cols-6 gap-1">
              {BUILTIN_ICONS.map((ic) => (
                <button
                  key={ic.name}
                  onClick={() => {
                    onInsertImage(svgToDataUrl(ic.svg), ic.name)
                    onClose()
                  }}
                  title={`Insert "${ic.name}" icon as a picture`}
                  className="rounded border border-neutral-200 p-1.5 hover:border-[#2B579A] hover:bg-[#D6E4F7] dark:border-neutral-700"
                >
                  <img src={svgToDataUrl(ic.svg)} alt={ic.name} className="h-8 w-8" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
