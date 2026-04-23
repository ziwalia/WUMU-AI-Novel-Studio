import { useState } from 'react'
import { useNovelStore } from '@/stores/novelStore'
import { useWizardStore } from '@/stores/wizardStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RenameDialog } from '@/components/shared/RenameDialog'
import { WIZARD_STEPS, STEP_LABELS } from '@/types'
import type { NovelProject, WizardStep } from '@/types'
import { exportProjectToJson, importProjectFromJson, downloadFile, readFileAsText } from '@/services/storage/projectIO'

type StepStatus = 'completed' | 'partial' | 'failed' | 'active' | 'pending'

function getStepStatusFromData(step: WizardStep, project: NovelProject): StepStatus {
  const total = project.params.chapterCount

  const checkStatus = (): StepStatus | null => {
    switch (step) {
      case 'project-info': return !!project.params.topic ? 'completed' : null
      case 'architecture': return !!project.architecture ? 'completed' : null
      case 'volume': return !!project.volumeOutline ? 'completed' : null
      case 'blueprint': return !!project.blueprint ? 'completed' : null
      case 'draft': {
        const count = Object.keys(project.chapters).length
        if (count === 0) return null
        return count >= total ? 'completed' : 'partial'
      }
      case 'review': {
        const count = Object.keys(project.reviewResults).length
        if (count === 0) return null
        return count >= total ? 'completed' : 'partial'
      }
      case 'rewrite': {
        const count = Object.values(project.chapterStatuses)
          .filter(s => s === 'rewriting' || s === 'finalized').length
        if (count === 0) return null
        return count >= total ? 'completed' : 'partial'
      }
      case 'finalize': {
        const finalizedCount = Object.values(project.chapterStatuses)
          .filter(s => s === 'finalized').length
        if (finalizedCount === 0) return null
        if (finalizedCount < total) return 'partial'
        if (!project.fullReview) return 'partial'
        return project.fullReview.overallScore >= 90 ? 'completed' : 'failed'
      }
      case 'export': return null
      default: return null
    }
  }

  const result = checkStatus()
  if (result) return result
  if (step === project.currentStep) return 'active'
  return 'pending'
}

function getStepProgressInfo(step: WizardStep, project: NovelProject): { text: string; className: string } | null {
  const total = project.params.chapterCount
  switch (step) {
    case 'draft': {
      const count = Object.keys(project.chapters).length
      if (count > 0 && count < total) return { text: `${count}/${total}章`, className: 'text-red-500' }
      return null
    }
    case 'review': {
      const count = Object.keys(project.reviewResults).length
      if (count > 0 && count < total) return { text: `${count}/${total}章`, className: 'text-red-500' }
      return null
    }
    case 'rewrite': {
      const count = Object.values(project.chapterStatuses)
        .filter(s => s === 'rewriting' || s === 'finalized').length
      if (count > 0 && count < total) return { text: `${count}/${total}章`, className: 'text-red-500' }
      return null
    }
    case 'finalize': {
      const finalizedCount = Object.values(project.chapterStatuses)
        .filter(s => s === 'finalized').length
      if (finalizedCount === 0) return null
      if (finalizedCount < total) return { text: `${finalizedCount}/${total}章 已定稿`, className: 'text-red-500' }
      if (!project.fullReview) return { text: '已定稿 未审核', className: 'text-amber-500' }
      if (project.fullReview.overallScore >= 90) return { text: '审核通过', className: 'text-[var(--color-success)]' }
      return { text: `审核不通过 ${project.fullReview.overallScore}分`, className: 'text-[var(--color-error)]' }
    }
    default: return null
  }
}

function canNavigateFromData(step: WizardStep, project: NovelProject): boolean {
  const idx = WIZARD_STEPS.indexOf(step)
  if (idx === 0) return true
  const status = getStepStatusFromData(step, project)
  if (status === 'completed' || status === 'partial' || status === 'failed' || status === 'active') return true
  const prev = WIZARD_STEPS[idx - 1]
  if (!prev) return false
  const prevStatus = getStepStatusFromData(prev, project)
  return prevStatus === 'completed' || prevStatus === 'partial'
}

const stepStatusIcons: Record<string, string> = {
  completed: 'check_circle',
  partial: 'check_circle',
  failed: 'check_circle',
  active: 'radio_button_checked',
  pending: 'radio_button_unchecked',
}

const stepStatusColors: Record<string, string> = {
  completed: 'text-[var(--color-success)]',
  partial: 'text-amber-500',
  failed: 'text-[var(--color-error)]',
  active: 'text-[var(--color-primary)]',
  pending: 'text-[var(--color-on-surface-variant)]',
}

export function Sidebar() {
  const projects = useNovelStore((s) => s.projects)
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const setActiveProject = useNovelStore((s) => s.setActiveProject)
  const setCurrentStep = useNovelStore((s) => s.setCurrentStep)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const addToast = useUIStore((s) => s.addToast)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const isStreaming = useSessionStore((s) => s.isStreaming)

  const activeProject = projects.find((p) => p.id === activeProjectId)

  const handleImport = async () => {
    try {
      const json = await readFileAsText()
      const project = importProjectFromJson(json)
      useWizardStore.getState().reset()
      useSessionStore.getState().clearContent()
      useNovelStore.setState((state) => ({
        projects: [...state.projects, project],
        activeProjectId: project.id,
      }))
      addToast('success', `已导入项目: ${project.name}`)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : '导入失败')
    }
  }

  const handleExport = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const json = exportProjectToJson(project)
    const filename = `${project.params.topic || project.name}.abook.json`
    downloadFile(json, filename)
    addToast('success', '项目已导出')
  }

  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pendingClear, setPendingClear] = useState<string | null>(null)

  const handleDeleteClick = (projectId: string) => setPendingDelete(projectId)

  const handleDeleteConfirm = () => {
    if (!pendingDelete) return
    useNovelStore.getState().deleteProject(pendingDelete)
    useWizardStore.getState().reset()
    useSessionStore.getState().clearContent()
    addToast('info', '项目已删除')
    setPendingDelete(null)
  }

  const handleClearClick = (projectId: string) => setPendingClear(projectId)

  const handleClearConfirm = () => {
    if (!pendingClear) return
    useNovelStore.getState().clearProject(pendingClear)
    useWizardStore.getState().reset()
    useSessionStore.getState().clearContent()
    addToast('info', '项目已清空')
    setPendingClear(null)
  }

  const handleNewProject = () => {
    useUIStore.getState().setNewProjectOpen(true)
  }

  const [pendingRename, setPendingRename] = useState<{ id: string; name: string } | null>(null)

  const handleRenameConfirm = (newName: string) => {
    if (!pendingRename) return
    useNovelStore.setState((state) => ({
      projects: state.projects.map((p) =>
        p.id === pendingRename.id ? { ...p, name: newName, updatedAt: new Date().toISOString() } : p
      ),
    }))
    addToast('success', `项目已更名为 "${newName}"`)
    setPendingRename(null)
  }

  return (
    <aside
      className={`flex flex-col h-full bg-[var(--color-surface-sidebar)] border-r border-[var(--color-border-separator)] transition-all duration-200 ${
        collapsed ? 'w-[60px]' : 'w-full'
      }`}
      style={{ fontWeight: 600 }}
      role="navigation"
      aria-label="侧边栏导航"
    >
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between h-10 px-3 border-b border-[var(--color-border-separator)]">
        {!collapsed && (
          <span className="text-sm font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
            我的项目
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <span className="material-symbols-outlined text-base">
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`group flex items-center gap-2 px-3 py-2 text-base transition-colors ${
                project.id === activeProjectId
                  ? 'bg-[var(--color-surface-selected)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <button
                onClick={() => {
                  useWizardStore.getState().reset()
                  useSessionStore.getState().clearContent()
                  setActiveProject(project.id)
                }}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className="material-symbols-outlined text-base text-[var(--color-primary)] shrink-0">
                  menu_book
                </span>
                {!collapsed && (
                  <span className="truncate flex-1">{project.name}</span>
                )}
              </button>
              {!collapsed && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setPendingRename({ id: project.id, name: project.name })}
                    className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
                    title="修改名称"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={() => handleExport(project.id)}
                    className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
                    title="导出项目"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                  </button>
                  <button
                    onClick={() => handleClearClick(project.id)}
                    className="p-1 rounded hover:bg-orange-50 text-[var(--color-text-tertiary)] hover:text-orange-500"
                    title="清空项目"
                  >
                    <span className="material-symbols-outlined text-sm">restart_alt</span>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(project.id)}
                    className="p-1 rounded hover:bg-red-50 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
                    title="删除项目"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Action buttons */}
          <div className="flex items-center gap-1 px-3 pt-1">
            <button
              onClick={handleNewProject}
              className="flex-1 flex items-center gap-2 py-2 text-left text-base text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors rounded-[var(--radius-sm)] px-1"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {!collapsed && <span>新建项目</span>}
            </button>
            {!collapsed && (
              <>
                <button
                  onClick={handleImport}
                  className="p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors rounded-[var(--radius-sm)]"
                  title="导入项目"
                >
                  <span className="material-symbols-outlined text-base">upload</span>
                </button>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-colors rounded-[var(--radius-sm)]"
                  title="设置"
                >
                  <span className="material-symbols-outlined text-base">settings</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Wizard steps (only when a project is active) */}
        {activeProject && (
          <div className="border-t border-[var(--color-border-separator)] py-2">
            {!collapsed && (
              <span className="block px-3 pb-1 text-sm font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                向导步骤
              </span>
            )}
            {WIZARD_STEPS.map((step, index) => {
              const status = getStepStatusFromData(step, activeProject)
              const canNavigate = canNavigateFromData(step, activeProject)
              const progressInfo = getStepProgressInfo(step, activeProject)
              const handleClick = () => {
                if (isStreaming) {
                  addToast('warning', '正在生成中，请等待完成后再切换步骤')
                  return
                }
                if (!canNavigate || !activeProjectId) return
                useSessionStore.getState().clearContent()
                setCurrentStep(activeProjectId, step)
              }
              return (
                <button
                  key={step}
                  onClick={handleClick}
                  disabled={!canNavigate}
                  className={`w-full flex items-center gap-2 px-3 h-9 text-left text-base transition-colors ${
                    !canNavigate
                      ? 'text-[var(--color-text-tertiary)] opacity-50 cursor-not-allowed'
                      : status === 'active'
                        ? 'bg-[var(--color-surface-selected)] text-[var(--color-text-primary)] font-medium cursor-pointer'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer'
                  }`}
                  aria-current={status === 'active' ? 'step' : undefined}
                  title={!canNavigate ? '请先完成前序步骤' : STEP_LABELS[step]}
                >
                  <span className={`material-symbols-outlined text-base ${stepStatusColors[status]}`}>
                    {stepStatusIcons[status]}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="text-sm text-[var(--color-text-tertiary)] w-5">{index + 1}</span>
                      <span className="truncate flex-1">{STEP_LABELS[step]}</span>
                      {progressInfo && (
                        <span className={`text-xs whitespace-nowrap ${progressInfo.className}`}>
                          {progressInfo.text}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Chapter progress (only during step 5-8) */}
        {activeProject && ['draft', 'review', 'rewrite', 'finalize'].includes(activeProject.currentStep) && (
          <div className="border-t border-[var(--color-border-separator)] py-2 px-3">
            {!collapsed && (
              <>
                <span className="block pb-1 text-sm font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  章节进度
                </span>
                <div className="text-sm text-[var(--color-text-secondary)] mb-1">
                  第{activeProject.currentChapterIndex + 1}/{activeProject.params.chapterCount}章
                </div>
                <div className="h-1.5 bg-[var(--color-surface-variant)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300"
                    style={{
                      width: `${((activeProject.currentChapterIndex + 1) / activeProject.params.chapterCount) * 100}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-sm text-[var(--color-text-tertiary)]">
                  {activeProject.chapterStatuses[activeProject.currentChapterIndex] ?? '草稿'}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="删除项目"
        message={`确定要删除「${projects.find((p) => p.id === pendingDelete)?.name || ''}」吗？此操作不可恢复，项目所有数据将被永久删除。`}
        confirmLabel="删除"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={!!pendingClear}
        title="清空项目"
        message={`确定要清空「${projects.find((p) => p.id === pendingClear)?.name || ''}」的所有数据吗？项目名称和基本参数将保留，其余数据全部重置。`}
        confirmLabel="清空"
        danger
        onConfirm={handleClearConfirm}
        onCancel={() => setPendingClear(null)}
      />
      <RenameDialog
        open={!!pendingRename}
        currentName={pendingRename?.name || ''}
        onConfirm={handleRenameConfirm}
        onCancel={() => setPendingRename(null)}
      />
    </aside>
  )
}
