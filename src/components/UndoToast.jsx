import { Undo2 } from 'lucide-react'

export default function UndoToast({ pending, onUndo }) {
  if (!pending) return null
  return (
    <div className="fixed bottom-5 right-5 z-50 bg-ink text-white rounded-card shadow-xl px-4 py-3 flex items-center gap-4 text-sm">
      <span>Eliminado: <strong className="font-medium">{pending.label}</strong></span>
      <button type="button" onClick={onUndo} className="flex items-center gap-1.5 text-[#8fc8ff] font-medium hover:underline flex-shrink-0">
        <Undo2 className="w-3.5 h-3.5" /> Deshacer
      </button>
    </div>
  )
}
