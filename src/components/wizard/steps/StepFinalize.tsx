import { useState, useCallback, useEffect } from 'react'
import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { useGeneration } from '@/hooks/useGeneration'
import { Button } from '@/components/shared/Button'
import { ChapterViewDialog } from '@/components/shared/ChapterViewDialog'
import { FullReviewDialog } from '@/components/shared/FullReviewDialog'
import { nextChapterPredictionPrompt, regenerateSummaryPrompt } from '@/services/prompts'
import { updateChapterMeta } from '@/stores/characterStore'
import { buildSystemPrompt } from '@/services/prompts'
import type { Message } from '@/types'

export function StepFinalize() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setChapterStatus = useNovelStore((s) => s.setChapterStatus)
  const setCurrentChapter = useNovelStore((s) => s.setCurrentChapter)
  const setCurrentStep = useNovelStore((s) => s.setCurrentStep)
  const setNextChapterHint = useNovelStore((s) => s.setNextChapterHint)
  const setNextChapterPrediction = useNovelStore((s) => s.setNextChapterPrediction)
  const addToast = useUIStore((s) => s.addToast)
  const autoFullReviewPending = useUIStore((s) => s.autoFullReviewPending)
  const { getConfig } = useGeneration()

  const [expandedChapter, setExpandedChapter] = useState<number | null>(null)
  const [predicting, setPredicting] = useState<number | null>(null)
  const [viewingChapter, setViewingChapter] = useState<number | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  // Auto-trigger full review dialog when autoFullReviewPending is set
  useEffect(() => {
    if (autoFullReviewPending && allFinalized && !reviewOpen) {
      setReviewOpen(true)
    }
  }, [autoFullReviewPending])

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const totalChapters = project.params.chapterCount
  const chapterIdx = project.currentChapterIndex
  const finalizedCount = Object.values(project.chapterStatuses).filter(
    (s) => s === 'finalized'
  ).length
  const draftCount = Object.values(project.chapterStatuses).filter(
    (s) => s === 'draft' || s === 'rewriting'
  ).length
  const progress = totalChapters > 0 ? (finalizedCount / totalChapters) * 100 : 0
  const allFinalized = finalizedCount === totalChapters

  const generatePrediction = useCallback(async (index: number) => {
    if (!activeProjectId || index >= totalChapters - 1) return
    const config = getConfig()
    if (!config) { addToast('warning', '请先配置 AI 模型'); return }

    setPredicting(index)
    try {
      const prompt = nextChapterPredictionPrompt(index, project.blueprint)
      const messages: Message[] = [
        { role: 'system', content: '你是一位网络小说创作助手。用中文回答。' },
        { role: 'user', content: prompt },
      ]
      const { chat } = await import('@/services/llm')
      const result = await chat(config, messages)
      setNextChapterPrediction(activeProjectId, index, result.content.trim())
    } catch { addToast('error', '预测失败') }
    finally { setPredicting(null) }
  }, [activeProjectId, project.blueprint, totalChapters, addToast, setNextChapterPrediction, getConfig])

  const regenerateSummary = async (index: number) => {
    const content = project.chapters[index]
    if (!content || !activeProjectId) return
    const config = getConfig()
    if (!config) return
    try {
      const msgs: Message[] = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: regenerateSummaryPrompt(index, content) },
      ]
      const { chat } = await import('@/services/llm')
      const result = await chat(config, msgs)
      const summary = result.content.trim()
      if (summary) updateChapterMeta(index, { summary })
    } catch {
      // Silently ignore summary regeneration failure
    }
  }

  const ensureRunningSummary = (upToIndex: number) => {
    if (!activeProjectId) return
    const parts: string[] = []
    for (let i = 0; i <= upToIndex; i++) {
      const meta = project.chapterMetas[i]
      if (meta?.summary) parts.push(`第${i + 1}章：${meta.summary}`)
    }
    if (parts.length > 0) {
      const newRunning = parts.join('\n')
      useNovelStore.getState().setRunningSummary(activeProjectId, newRunning)
      updateChapterMeta(upToIndex, { runningSummarySnapshot: newRunning })
    }
  }

  const toggleFinalize = async (index: number) => {
    if (!activeProjectId) return
    const current = project.chapterStatuses[index]
    const willFinalize = current !== 'finalized'
    setChapterStatus(activeProjectId, index, willFinalize ? 'finalized' : 'draft')
    if (willFinalize) {
      // Check meta completeness — if missing summary, regenerate it
      const meta = project.chapterMetas[index]
      if (!meta?.summary) {
        regenerateSummary(index)
      }
      // Ensure runningSummary is up to date
      ensureRunningSummary(index)
      if (index < totalChapters - 1 && !project.nextChapterPredictions?.[index]) {
        await generatePrediction(index)
      }
      // Check unresolved foreshadowings on last chapter or all-finalized
      checkForeshadowingAlerts(index)
    }
  }

  const checkForeshadowingAlerts = (index: number) => {
    const unresolved = project.foreshadowings.filter((f) => f.status === 'planted')
    if (unresolved.length === 0) return

    const isLastChapter = index === totalChapters - 1
    const updatedProject = useNovelStore.getState().projects.find((p) => p.id === activeProjectId)
    const allDone = updatedProject && Object.values(updatedProject.chapterStatuses).filter((s) => s === 'finalized').length === totalChapters

    if (isLastChapter || allDone) {
      const items = unresolved.map((f) => `• 第${f.plantedChapter + 1}章 [${f.type}] ${f.content}`).join('\n')
      addToast('warning', `有 ${unresolved.length} 条伏笔未收束：\n${items}`)
      checkCharacterConsistency()
    }
  }

  const jumpToChapter = (index: number, step: 'draft' | 'review' | 'rewrite') => {
    if (!activeProjectId) return
    setCurrentChapter(activeProjectId, index)
    setCurrentStep(activeProjectId, step)
    addToast('info', `跳转到第${index + 1}章`)
  }

  const finalizeAll = () => {
    if (!activeProjectId) return
    for (let i = 0; i < totalChapters; i++) {
      if (project.chapters[i]) setChapterStatus(activeProjectId, i, 'finalized')
    }
    addToast('success', '全部章节已定稿')
    checkCharacterConsistency()
  }

  const checkCharacterConsistency = () => {
    const deadChars = project.characters.filter((c) => c.lifeStatus === 'dead')
    if (deadChars.length === 0) return
    const issues: string[] = []
    for (const ch of deadChars) {
      const deathChapter = ch.lastAppearance
      if (deathChapter === undefined) continue
      for (let i = deathChapter + 1; i < totalChapters; i++) {
        const meta = project.chapterMetas[i]
        if (meta?.summary && meta.summary.includes(ch.name)) {
          issues.push(`角色"${ch.name}"在第${deathChapter + 1}章已死亡，但在第${i + 1}章 summary 中仍有出场`)
        }
      }
    }
    if (issues.length > 0) {
      addToast('warning', `角色一致性警告：\n${issues.join('\n')}`)
    }
  }

  const toggleExpand = (index: number) => {
    setExpandedChapter(expandedChapter === index ? null : index)
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)]">定稿管理</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">切换开关标记定稿状态，定稿后可展开设置下一章创作建议</p>
        </div>
        <div className="flex items-center gap-2">
          {finalizedCount > 0 && finalizedCount < totalChapters && (
            <Button variant="secondary" size="sm" onClick={finalizeAll}>全部定稿</Button>
          )}
        </div>
      </div>

      {/* Progress overview */}
      <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--color-text-secondary)]">整体进度</span>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {finalizedCount} / {totalChapters} 章已定稿
          </span>
        </div>
        <div className="h-2 bg-[var(--color-surface-variant)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-tertiary)]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />已定稿 {finalizedCount}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />草稿/改写 {draftCount}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)]" />未开始 {totalChapters - finalizedCount - draftCount}</span>
        </div>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {Array.from({ length: totalChapters }, (_, i) => {
          const status = project.chapterStatuses[i]
          const hasContent = !!project.chapters[i]
          const wordCount = project.chapters[i]?.length ?? 0
          const chapterFinalized = status === 'finalized'
          const isCurrent = i === chapterIdx
          const isExpanded = expandedChapter === i
          const canExpand = chapterFinalized && hasContent && i < totalChapters - 1
          const prediction = project.nextChapterPredictions?.[i] || ''
          const hint = project.nextChapterHints?.[i] || ''

          return (
            <div key={i}>
              <div className={`flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] transition-colors ${
                isCurrent ? 'bg-[var(--color-surface-selected)] border border-[var(--color-primary)]/30' : 'hover:bg-[var(--color-surface-hover)]'
              }`}>
                <span className="text-xs font-mono text-[var(--color-text-tertiary)] w-8 text-right">{String(i + 1).padStart(2, '0')}</span>

                <div className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${
                  chapterFinalized ? 'bg-[var(--color-success)]' : hasContent ? 'bg-[var(--color-surface-variant)]' : 'bg-[var(--color-surface-variant)] opacity-40'
                }`} onClick={() => hasContent && toggleFinalize(i)} role="switch" aria-checked={chapterFinalized}>
                  <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${chapterFinalized ? 'left-[18px]' : 'left-0.5'}`} />
                </div>

                <span className="flex-1 text-sm text-[var(--color-text-primary)]">第{i + 1}章</span>
                {canExpand && hint && <span className="text-xs text-[var(--color-primary)]">已设建议</span>}
                {hasContent && <span className="text-xs text-[var(--color-text-tertiary)]">{wordCount.toLocaleString()} 字</span>}
                {canExpand && (
                  <button onClick={() => toggleExpand(i)} className={`p-1 rounded hover:bg-[var(--color-surface-hover)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    <span className="material-symbols-outlined text-sm text-[var(--color-text-tertiary)]">chevron_right</span>
                  </button>
                )}
                {hasContent && (
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => setViewingChapter(i)} className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] rounded hover:bg-[var(--color-surface-hover)]" title="显示本章">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </button>
                    <button onClick={() => jumpToChapter(i, 'draft')} className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] rounded hover:bg-[var(--color-surface-hover)]" title="编辑草稿">
                      <span className="material-symbols-outlined text-sm">edit_note</span>
                    </button>
                    <button onClick={() => jumpToChapter(i, 'review')} className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] rounded hover:bg-[var(--color-surface-hover)]" title="审校">
                      <span className="material-symbols-outlined text-sm">fact_check</span>
                    </button>
                  </div>
                )}
                {!hasContent && <span className="text-xs text-[var(--color-text-tertiary)]">未生成</span>}
              </div>

              {isExpanded && canExpand && (
                <div className="ml-11 mr-3 mt-1 mb-2 p-3 bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[var(--color-text-secondary)]">剧情预测</span>
                      <div className="flex items-center gap-2">
                        {predicting === i && <span className="material-symbols-outlined text-xs animate-spin text-[var(--color-text-tertiary)]">progress_activity</span>}
                        <button onClick={() => generatePrediction(i)} disabled={predicting === i} className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50">
                          {prediction ? '重新预测' : '预测'}
                        </button>
                      </div>
                    </div>
                    {prediction ? <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed bg-[var(--color-surface-container-low)] px-2 py-1.5 rounded">{prediction}</p>
                      : <p className="text-xs text-[var(--color-text-tertiary)] italic">定稿时自动生成，仅供参考</p>}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">创作建议（将注入下一章提示词）</span>
                    <textarea value={hint} onChange={(e) => { if (activeProjectId) setNextChapterHint(activeProjectId, i, e.target.value) }}
                      placeholder="输入你对下一章的剧情建议或走向指引..." rows={3}
                      className="w-full px-3 py-2 text-xs font-mono leading-relaxed bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] resize-y whitespace-pre-wrap" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Full review button */}
      <div className="mt-4 flex items-center justify-center">
        <Button
          variant="primary"
          size="md"
          onClick={() => setReviewOpen(true)}
          disabled={!allFinalized}
          icon={<span className="material-symbols-outlined text-base">rate_review</span>}
        >
          {allFinalized ? (project.fullReview ? '查看/重新审核' : '全文审核') : `全文审核（需全部定稿 ${finalizedCount}/${totalChapters}）`}
        </Button>
      </div>

      <ChapterViewDialog
        open={viewingChapter !== null}
        chapterIndex={viewingChapter ?? 0}
        content={viewingChapter !== null ? (project.chapters[viewingChapter] || '') : ''}
        onClose={() => setViewingChapter(null)}
      />

      <FullReviewDialog
        open={reviewOpen}
        project={project}
        onClose={() => setReviewOpen(false)}
      />
    </div>
  )
}
