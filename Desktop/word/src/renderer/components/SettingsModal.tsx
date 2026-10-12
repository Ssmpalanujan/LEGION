import { useState } from 'react'
import { Modal } from './Dialogs'
import type { AppSettings } from '../types'

const LANGS = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' }
]
const FONTS = ['Calibri', 'Arial', 'Times New Roman', 'Georgia', 'Segoe UI', 'Courier New', 'Verdana']

export default function SettingsModal({ initial, onSave, onClose }: { initial: AppSettings; onSave: (s: AppSettings) => void; onClose: () => void }) {
  const [s, setS] = useState<AppSettings>({ ...initial })
  const set = (p: Partial<AppSettings>) => setS((prev) => ({ ...prev, ...p }))
  const row = 'flex items-center justify-between gap-3 py-1.5 text-[13px]'
  const input = 'rounded border border-neutral-300 px-1.5 py-1 text-[12px] dark:border-neutral-600 dark:bg-neutral-800'
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className={row}>
        <label htmlFor="set-theme">Theme</label>
        <select id="set-theme" value={s.theme} onChange={(e) => set({ theme: e.target.value as AppSettings['theme'] })} className={input}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className={row}>
        <label htmlFor="set-font">Default font</label>
        <select id="set-font" value={s.defaultFont} onChange={(e) => set({ defaultFont: e.target.value })} className={input}>
          {FONTS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className={row}>
        <label htmlFor="set-size">Default font size</label>
        <select id="set-size" value={s.defaultSize} onChange={(e) => set({ defaultSize: e.target.value })} className={input}>
          {['9', '10', '11', '12', '14', '16', '18'].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className={row}>
        <label htmlFor="set-autosave">Autosave interval (seconds)</label>
        <input id="set-autosave" type="number" min={5} max={600} value={s.autosaveSec} onChange={(e) => set({ autosaveSec: Math.min(600, Math.max(5, Number(e.target.value) || 30)) })} className={`${input} w-20`} />
      </div>
      <div className={row}>
        <label htmlFor="set-lang">Language (spellcheck)</label>
        <select id="set-lang" value={s.language} onChange={(e) => set({ language: e.target.value })} className={input}>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className={row}>
        <label htmlFor="set-goal">Daily word-count goal</label>
        <input id="set-goal" type="number" min={0} max={100000} value={s.wordGoal} onChange={(e) => set({ wordGoal: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-24`} />
      </div>
      <button onClick={() => onSave(s)} className="mt-3 w-full rounded bg-[#2B579A] py-1.5 text-[13px] text-white hover:bg-[#1F3F70]">
        Save settings
      </button>
    </Modal>
  )
}
