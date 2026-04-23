interface ChapterViewDialogProps {
  open: boolean
  chapterIndex: number
  content: string
  onClose: () => void
}

export function ChapterViewDialog({ open, chapterIndex, content, onClose }: ChapterViewDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-lg shadow-xl w-[680px] max-h-[80vh] flex flex-col border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-separator)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            第{chapterIndex + 1}章
            <span className="ml-2 text-sm font-normal text-[var(--color-text-tertiary)]">
              {content.length.toLocaleString()} 字
            </span>
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed"
            style={{ fontFamily: 'var(--font-content)', fontSize: 'var(--font-content-size)', lineHeight: 'var(--font-content-lh)' }}
          >
            {content}
          </div>
        </div>
        <div className="flex items-center justify-center px-4 py-3 border-t border-[var(--color-border-separator)]">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-[var(--color-on-primary)] bg-[var(--color-primary)] rounded hover:opacity-90"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
