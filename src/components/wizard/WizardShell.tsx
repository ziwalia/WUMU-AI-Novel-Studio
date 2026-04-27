import { useNovelStore } from '@/stores/novelStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useWizardStore } from '@/stores/wizardStore'
import { useUIStore } from '@/stores/uiStore'
import { WIZARD_STEPS, STEP_LABELS } from '@/types'
import type { WizardStep } from '@/types'
import { StepRenderer } from './StepRenderer'
import { Button } from '@/components/shared/Button'
import { ModelSelector } from '@/components/shared/ModelSelector'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

const STEP_REQUIREMENTS: Partial<Record<WizardStep, (project: { architecture: string; novelOutline: string; blueprint: string; chapters: Record<number, string> }, chapterIdx: number) => string | null>> = {
  'architecture': (p) => !p.architecture ? '请先生成小说架构' : null,
  'outline': (p) => !p.novelOutline ? '请先生成小说大纲' : null,
  'blueprint': (p) => !p.blueprint ? '请先生成章节目录' : null,
  'draft': (p, idx) => !p.chapters[idx] ? '请先生成当前章节草稿' : null,
}

function StepMiddleButton({ step, project }: { step: WizardStep; project: { id: string; currentStep: WizardStep; currentChapterIndex: number; chapters: Record<number, string>; chapterStatuses: Record<number, string>; params: { chapterCount: number } } }) {
  const setCurrentStep = useNovelStore((s) => s.setCurrentStep)
  const setCurrentChapter = useNovelStore((s) => s.setCurrentChapter)
  const addToast = useUIStore((s) => s.addToast)
  const isStreaming = useSessionStore((s) => s.isStreaming)

  if (isStreaming) return null

  // Rewrite step: "重新审校" button
  if (step === 'rewrite') {
    const hasRewritten = project.chapterStatuses[project.currentChapterIndex] === 'rewriting'
    if (!hasRewritten) return null
    const handleClick = () => {
      setCurrentStep(project.id, 'review')
      addToast('info', '返回审校步骤')
    }
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#D77656' }}
      >
        <span className="material-symbols-outlined text-base">fact_check</span>
        重新审校
      </button>
    )
  }

  // Finalize step: "跳到未写章节" button
  if (step === 'finalize') {
    const totalChapters = project.params.chapterCount
    const finalizedCount = Object.values(project.chapterStatuses).filter(s => s === 'finalized').length
    const disabled = finalizedCount === totalChapters || finalizedCount === 0

    const handleClick = () => {
      for (let i = 0; i < totalChapters; i++) {
        if (!project.chapters[i]) {
          setCurrentChapter(project.id, i)
          setCurrentStep(project.id, 'draft')
          addToast('info', `跳转到第${i + 1}章草稿`)
          return
        }
      }
      addToast('info', '所有章节已有内容')
    }

    return (
      <button
        onClick={disabled ? undefined : handleClick}
        disabled={disabled}
        className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white rounded-[var(--radius-sm)] transition-opacity ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
        }`}
        style={{ backgroundColor: '#D77656' }}
      >
        <span className="material-symbols-outlined text-base">skip_next</span>
        跳到未写章节
      </button>
    )
  }

  return null
}

export function WizardShell() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setCurrentStep = useNovelStore((s) => s.setCurrentStep)
  const isStreaming = useSessionStore((s) => s.isStreaming)
  const stopGeneration = useSessionStore((s) => s.stopGeneration)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const markStepCompleted = useWizardStore((s) => s.markStepCompleted)
  const addToast = useUIStore((s) => s.addToast)

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const currentStepIndex = WIZARD_STEPS.indexOf(project.currentStep)
  const wordCount = streamingContent.length

  const getCompletedWordCount = (): number | null => {
    if (isStreaming) return null
    switch (project.currentStep) {
      case 'architecture': return project.architecture?.length || null
      case 'outline': return project.novelOutline?.length || null
      case 'blueprint': return project.blueprint?.length || null
      case 'draft': return project.chapters[project.currentChapterIndex]?.length || null
      case 'review': return project.reviewResults[project.currentChapterIndex]?.length || null
      case 'rewrite': return project.chapters[project.currentChapterIndex]?.length || null
      default: return null
    }
  }
  const completedWordCount = getCompletedWordCount()
  const displayWordCount = isStreaming ? wordCount : completedWordCount

  const handlePrev = () => {
    if (isStreaming) {
      addToast('warning', '正在生成中，请等待完成后再切换')
      return
    }
    if (currentStepIndex > 0) {
      useSessionStore.getState().clearContent()
      setCurrentStep(project.id, WIZARD_STEPS[currentStepIndex - 1]!)
    }
  }

  const handleNext = () => {
    if (isStreaming) {
      addToast('warning', '正在生成中，请等待完成后再切换')
      return
    }
    const check = STEP_REQUIREMENTS[project.currentStep]
    if (check) {
      const error = check(project, project.currentChapterIndex)
      if (error) {
        addToast('warning', error)
        return
      }
    }
    markStepCompleted(project.currentStep)
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      useSessionStore.getState().clearContent()
      setCurrentStep(project.id, WIZARD_STEPS[currentStepIndex + 1]!)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Step header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border-separator)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
              步骤 {currentStepIndex + 1}/{WIZARD_STEPS.length}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">·</span>
            <span className="text-sm font-headline font-semibold text-[var(--color-text-primary)]">
              {STEP_LABELS[project.currentStep]}
            </span>
          </div>
          {isStreaming ? (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              正在生成... {wordCount.toLocaleString()} 字
            </p>
          ) : displayWordCount !== null && displayWordCount > 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              已输出 {displayWordCount.toLocaleString()} 字
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <ModelSelector />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <ErrorBoundary>
          <StepRenderer step={project.currentStep} />
        </ErrorBoundary>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--color-border-separator)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            icon={<span className="material-symbols-outlined text-base">arrow_back</span>}
          >
            上一步
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <StepMiddleButton step={project.currentStep} project={project} />
        </div>

        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={stopGeneration}
              icon={<span className="material-symbols-outlined text-base">pause</span>}
            >
              暂停
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              disabled={currentStepIndex === WIZARD_STEPS.length - 1}
              icon={<span className="material-symbols-outlined text-base">arrow_forward</span>}
            >
              下一步
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
