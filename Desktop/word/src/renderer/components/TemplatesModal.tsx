import { Modal } from './Dialogs'
import { TEMPLATES, type Template } from '../lib/templates'

export default function TemplatesModal({ onPick, onClose }: { onPick: (t: Template) => void; onClose: () => void }) {
  return (
    <Modal title="New from template" onClose={onClose}>
      <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-auto">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            title={`Create document from ${t.name} template`}
            className="rounded border border-neutral-300 p-3 text-left hover:border-[#2B579A] hover:bg-[#D6E4F7] dark:border-neutral-600 dark:hover:bg-sky-900"
          >
            <div className="text-[13px] font-semibold">{t.name}</div>
            <div className="mt-0.5 text-[12px] text-neutral-500">{t.blurb}</div>
          </button>
        ))}
      </div>
    </Modal>
  )
}
