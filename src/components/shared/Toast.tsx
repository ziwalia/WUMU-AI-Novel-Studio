import { useUIStore } from '@/stores/uiStore'

const typeStyles: Record<string, string> = {
  success: 'border-l-[var(--color-success)]',
  error: 'border-l-[var(--color-error)]',
  warning: 'border-l-[var(--color-warning)]',
  info: 'border-l-[var(--color-secondary)]',
}

const typeIcons: Record<string, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)
  const removeToast = useUIStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <>
      {toasts.map((toast) => {
        const left = Math.min(toast.x, window.innerWidth - 380)
        const top = Math.max(10, toast.y - 50)
        return (
          <div
            key={toast.id}
            className={`fixed z-50 flex items-center gap-2 max-w-[360px] px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-container-lowest)] shadow-[var(--shadow-dropdown)] border-l-4 ${typeStyles[toast.type]} text-sm text-[var(--color-text-primary)] animate-[slideIn_0.2s_ease-out]`}
            style={{ left, top }}
            onClick={() => removeToast(toast.id)}
            role="alert"
          >
            <span className="material-symbols-outlined text-base">{typeIcons[toast.type]}</span>
            <span className="flex-1">{toast.message}</span>
          </div>
        )
      })}
    </>
  )
}
