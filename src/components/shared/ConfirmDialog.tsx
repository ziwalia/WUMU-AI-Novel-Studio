import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = '确认', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-[var(--color-surface)] rounded-lg shadow-xl w-[360px] flex flex-col border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-separator)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <button onClick={onCancel} className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border-separator)]">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] rounded"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded hover:opacity-90 ${
              danger
                ? 'text-[var(--color-on-error)] bg-[var(--color-error)]'
                : 'text-[var(--color-on-primary)] bg-[var(--color-primary)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
