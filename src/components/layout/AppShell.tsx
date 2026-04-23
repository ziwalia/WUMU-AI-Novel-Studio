import { useEffect, useCallback } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { RightPanel } from './RightPanel'
import { StatusBar } from './StatusBar'
import { SettingsDialog } from '@/components/shared/SettingsDialog'
import { NewProjectDialog } from '@/components/shared/NewProjectDialog'
import { WizardShell } from '@/components/wizard/WizardShell'
import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'

export function AppShell() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const fontGlobal = useUIStore((s) => s.fontGlobal)
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth)
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth)
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth)
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const rightPanelCollapsed = useUIStore((s) => s.rightPanelCollapsed)

  // Apply font settings via CSS variables for content areas
  useEffect(() => {
    const el = document.documentElement
    el.style.setProperty('--font-content', fontGlobal.fontFamily)
    el.style.setProperty('--font-content-size', `${fontGlobal.fontSize}px`)
    el.style.setProperty('--font-content-lh', String(fontGlobal.lineHeight))
  }, [fontGlobal])

  // Track mouse position for toast placement
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      ;(window as unknown as Record<string, number>).__lastMouseX = e.clientX
      ;(window as unknown as Record<string, number>).__lastMouseY = e.clientY
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  const handleSidebarDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: MouseEvent) => setSidebarWidth(startW + ev.clientX - startX)
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth, setSidebarWidth])

  const handleRightDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = rightPanelWidth
    const onMove = (ev: MouseEvent) => setRightPanelWidth(startW - ev.clientX + startX)
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [rightPanelWidth, setRightPanelWidth])

  return (
    <div className="flex flex-col h-screen bg-[var(--color-background)]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: sidebarCollapsed ? 60 : sidebarWidth, flexShrink: 0 }}>
          <Sidebar />
        </div>
        {/* Sidebar resize handle */}
        {!sidebarCollapsed && (
          <div
            className="w-1 cursor-col-resize hover:bg-[var(--color-primary)]/20 active:bg-[var(--color-primary)]/30 transition-colors flex-shrink-0"
            onMouseDown={handleSidebarDrag}
          />
        )}
        <main className="flex-1 flex flex-col overflow-hidden" role="main">
          {activeProjectId ? (
            <WizardShell />
          ) : (
            <WelcomeScreen />
          )}
        </main>
        {/* Right panel resize handle */}
        {!rightPanelCollapsed && (
          <div
            className="w-1 cursor-col-resize hover:bg-[var(--color-primary)]/20 active:bg-[var(--color-primary)]/30 transition-colors flex-shrink-0"
            onMouseDown={handleRightDrag}
          />
        )}
        <div style={{ width: rightPanelCollapsed ? 40 : rightPanelWidth, flexShrink: 0 }}>
          <RightPanel />
        </div>
      </div>
      <StatusBar />
      <SettingsDialog />
      <NewProjectDialog />
    </div>
  )
}

function WelcomeScreen() {
  const createProject = useNovelStore((s) => s.createProject)

  const handleCreate = () => {
    createProject('新小说', '', {
      topic: '',
      genre: '',
      volumeCount: 1,
      chapterCount: 10,
      wordsPerChapter: 3000,
      strictWordCount: false,
      userGuidance: '',
      coreCharacters: '',
      keyItems: '',
      sceneLocation: '',
      timePressure: '',
      writingStyle: '',
    })
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <span className="material-symbols-outlined text-6xl text-[var(--color-primary)] mb-4 block">
          auto_stories
        </span>
        <h2 className="font-headline text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          开始你的第一部小说
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          AI 辅助长篇小说创作工具，从架构到定稿的完整流水线
        </p>
        <button
          onClick={handleCreate}
          className="h-12 px-8 text-sm font-medium text-[var(--color-on-primary)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-container)] rounded-[var(--radius-lg)] shadow-[var(--shadow-button-primary)] hover:shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
        >
          开始创作
        </button>
      </div>
    </div>
  )
}
