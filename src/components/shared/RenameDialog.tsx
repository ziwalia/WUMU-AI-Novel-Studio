import { useState, useEffect, useRef } from 'react'

interface RenameDialogProps {
  open: boolean
  currentName: string
  onConfirm: (newName: string) => void
  onCancel: () => void
}

export function RenameDialog({ open, currentName, onConfirm, onCancel }: RenameDialogProps) {
  const [name, setName] = useState(currentName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(currentName)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [open, currentName])

  if (!open) return null

  const handleConfirm = () => {
    if (!name.trim() || name.trim() === currentName) {
      onCancel()
      return
    }
    onConfirm(name.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-[var(--color-surface)] rounded-lg shadow-xl w-[360px] flex flex-col border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-separator)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">修改名称</h2>
          <button onClick={onCancel} className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="p-4">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">项目名称</label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border-separator)]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] rounded"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] bg-[var(--color-primary)] rounded hover:opacity-90"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
