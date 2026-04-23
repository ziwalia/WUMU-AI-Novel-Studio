import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'

export function TitleBar() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <header
      className="flex items-center h-[var(--titlebar-height)] px-4 bg-[var(--color-surface)] border-b border-[var(--color-border-separator)] select-none"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span className="material-symbols-outlined text-[var(--color-primary)] text-xl">
          auto_stories
        </span>
        <h1 className="font-headline text-sm font-semibold text-[var(--color-text-primary)]">
          乌木智书-WUMU AI Novel
        </h1>
        <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          v{__APP_VERSION__}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] transition-colors"
          aria-label="设置"
          title="设置"
        >
          <span className="material-symbols-outlined text-base">settings</span>
        </button>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] transition-colors"
          aria-label={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}
          title={theme === 'light' ? '暗色模式' : '亮色模式'}
        >
          <span className="material-symbols-outlined text-base">
            {theme === 'light' ? 'dark_mode' : 'light_mode'}
          </span>
        </button>
      </div>
    </header>
  )
}
