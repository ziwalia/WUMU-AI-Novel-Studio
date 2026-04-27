import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useNovelStore } from '@/stores/novelStore'
import { useWizardStore } from '@/stores/wizardStore'
import { useSessionStore } from '@/stores/sessionStore'

export function NewProjectDialog() {
  const open = useUIStore((s) => s.newProjectOpen)
  const setOpen = useUIStore((s) => s.setNewProjectOpen)
  const addToast = useUIStore((s) => s.addToast)

  const [name, setName] = useState('')

  if (!open) return null

  const handleCreate = () => {
    if (!name.trim()) {
      addToast('warning', '请输入项目名称')
      return
    }

    useNovelStore.getState().createProject(name.trim(), '', {
      topic: '',
      genre: '',
      chapterCount: 10,
      wordsPerChapter: 3000,
      strictWordCount: false,
      storyPremise: '',
      narrativePerspective: '第三人称有限视角（聚焦第一角色）',
      userGuidance: '',
      coreCharacters: '',
      keyItems: '',
      sceneLocation: '',
      timePressure: '',
      writingStyle: '',
    })

    useWizardStore.getState().reset()
    useSessionStore.getState().clearContent()

    addToast('success', `项目 "${name}" 已创建`)
    setOpen(false)
    setName('')
  }

  const handleClose = () => {
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-[var(--color-surface)] rounded-lg shadow-xl w-[360px] flex flex-col border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-separator)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">新建项目</h2>
          <button onClick={handleClose} className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="p-4">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">项目名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入项目名称"
            className="w-full h-10 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border-separator)]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] rounded"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] bg-[var(--color-primary)] rounded hover:opacity-90"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  )
}
