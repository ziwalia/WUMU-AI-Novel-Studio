import { useState, useCallback, useRef, useEffect } from 'react'
import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { useGeneration } from '@/hooks/useGeneration'
import { Button } from '@/components/shared/Button'
import {
  fullReviewPass1Prompt,
  fullReviewPass2Prompt,
  fullReviewPass3Prompt,
  fullReviewPass4Prompt,
  fullReviewSuggestionPrompt,
  PASS_LABELS,
  type ReviewPass,
} from '@/services/prompts'
import type { Message, NovelProject, FullReviewDimension, FullReviewResult } from '@/types'

type PassStatus = 'pending' | 'running' | 'done' | 'error'

interface PassState {
  status: PassStatus
  dimensions: FullReviewDimension[]
  summary: string
}

interface FullReviewDialogProps {
  open: boolean
  project: NovelProject
  onClose: () => void
}

function normalizeSuggestions(raw: unknown[]): string[] {
  return raw.map((s) =>
    typeof s === 'string' ? s
      : typeof s === 'object' && s !== null ? Object.values(s).filter((v) => typeof v === 'string').join('：')
      : String(s)
  )
}

const parseJsonFromLLM = (raw: string) => {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
    const rawJson = jsonMatch?.[1] ?? raw
    return JSON.parse(rawJson)
  } catch {
    return null
  }
}

export function FullReviewDialog({ open, project, onClose }: FullReviewDialogProps) {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const setFullReview = useNovelStore((s) => s.setFullReview)
  const addToast = useUIStore((s) => s.addToast)
  const autoFullReviewPending = useUIStore((s) => s.autoFullReviewPending)
  const { getConfig } = useGeneration()

  const [passStates, setPassStates] = useState<Record<ReviewPass, PassState>>({
    pass1: { status: 'pending', dimensions: [], summary: '' },
    pass2: { status: 'pending', dimensions: [], summary: '' },
    pass3: { status: 'pending', dimensions: [], summary: '' },
    pass4: { status: 'pending', dimensions: [], summary: '' },
  })
  const [reviewLog, setReviewLog] = useState<string[]>([])
  const [reviewSuggestions, setReviewSuggestions] = useState<string[]>([])
  const [reviewSummary, setReviewSummary] = useState('')
  const [reviewRunning, setReviewRunning] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const appendLog = (...lines: string[]) => {
    setReviewLog((prev) => [...prev, ...lines])
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [reviewLog])

  useEffect(() => {
    if (!open) {
      setPassStates({
        pass1: { status: 'pending', dimensions: [], summary: '' },
        pass2: { status: 'pending', dimensions: [], summary: '' },
        pass3: { status: 'pending', dimensions: [], summary: '' },
        pass4: { status: 'pending', dimensions: [], summary: '' },
      })
      setReviewLog([])
      setReviewSuggestions([])
      setReviewSummary('')
    }
  }, [open])

  const totalChapters = project.params.chapterCount
  const existingReview = project.fullReview

  const runFullReview = useCallback(async () => {
    if (!activeProjectId) return
    const config = getConfig()
    if (!config) { addToast('warning', '请先配置 AI 模型'); return }

    setReviewRunning(true)
    setReviewSuggestions([])
    setReviewSummary('')
    setReviewLog([])
    setPassStates({
      pass1: { status: 'pending', dimensions: [], summary: '' },
      pass2: { status: 'pending', dimensions: [], summary: '' },
      pass3: { status: 'pending', dimensions: [], summary: '' },
      pass4: { status: 'pending', dimensions: [], summary: '' },
    })

    const { chatStream } = await import('@/services/llm')
    const allDimensions: FullReviewDimension[] = []

    const runPass = async (passKey: ReviewPass, messages: Message[]) => {
      const label = PASS_LABELS[passKey]
      setPassStates((prev) => ({ ...prev, [passKey]: { ...prev[passKey], status: 'running' } }))
      appendLog(`▶ 开始${label}审核`)

      let accumulated = ''
      try {
        await chatStream(config, messages, (chunk) => {
          accumulated += chunk
          setReviewLog((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = `▶ ${label} 审核中...\n${accumulated.slice(-200)}`
            return updated
          })
        })

        const parsed = parseJsonFromLLM(accumulated)
        if (!parsed || !Array.isArray(parsed.dimensions)) throw new Error('Invalid response')

        const dims: FullReviewDimension[] = parsed.dimensions.map((d: { name?: string; score?: number; comment?: string }) => ({
          name: d.name || passKey,
          score: typeof d.score === 'number' ? d.score : 0,
          comment: d.comment || '',
        }))

        allDimensions.push(...dims)
        setPassStates((prev) => ({ ...prev, [passKey]: { status: 'done', dimensions: dims, summary: parsed.passSummary || '' } }))

        appendLog(`✓ ${label} 完成：`)
        for (const d of dims) {
          const icon = d.score >= 90 ? '●' : d.score >= 70 ? '◐' : '○'
          appendLog(`  ${icon} ${d.name}：${d.score}分 — ${d.comment}`)
        }
        if (parsed.passSummary) appendLog(`  总评：${parsed.passSummary}`)
        return dims
      } catch {
        setPassStates((prev) => ({ ...prev, [passKey]: { ...prev[passKey], status: 'error' } }))
        appendLog(`✗ ${label} 审核失败`)
        return null
      }
    }

    // Pass 1
    const chapterSummaries: { index: number; summary: string }[] = []
    for (let i = 0; i < totalChapters; i++) {
      const meta = project.chapterMetas[i]
      if (meta?.summary) chapterSummaries.push({ index: i, summary: meta.summary })
    }
    await runPass('pass1', [
      { role: 'system', content: '你是一位资深网络小说编辑，擅长从全局角度评审小说结构。用中文回答。' },
      { role: 'user', content: fullReviewPass1Prompt({
        runningSummary: project.runningSummary || '（暂无）',
        chapterSummaries,
        architecture: project.architecture || '（暂无）',
        characters: project.characters.map((c) => ({ name: c.name, weight: c.weight, basicInfo: c.basicInfo })),
        foreshadowings: project.foreshadowings.map((f) => ({
          type: f.type, content: f.content, status: f.status,
          plantedChapter: f.plantedChapter, resolvedChapter: f.resolvedChapter,
        })),
      })},
    ])

    // Pass 2
    const openingChapters: { index: number; content: string }[] = []
    for (let i = 0; i < Math.min(3, totalChapters); i++) {
      const ch = project.chapters[i]
      if (ch) openingChapters.push({ index: i, content: ch })
    }
    if (openingChapters.length > 0) {
      await runPass('pass2', [
        { role: 'system', content: '你是一位资深网络小说编辑，擅长评审开篇质量。用中文回答。' },
        { role: 'user', content: fullReviewPass2Prompt({
          chapters: openingChapters,
          architecture: project.architecture || '（暂无）',
          characters: project.characters.map((c) => ({ name: c.name, weight: c.weight, basicInfo: c.basicInfo })),
        })},
      ])
    }

    // Pass 3
    const sampleIndices = [
      Math.floor(totalChapters * 0.25),
      Math.floor(totalChapters * 0.5),
      Math.floor(totalChapters * 0.75),
    ].filter((i) => i > 2 && i < totalChapters - 3)

    const sampleChapters = sampleIndices
      .map((i) => project.chapters[i] ? { index: i, content: project.chapters[i]! } : null)
      .filter(Boolean) as { index: number; content: string }[]

    const adjacentSummaries: { index: number; summary: string }[] = []
    for (const si of sampleIndices) {
      if (si > 0 && project.chapterMetas[si - 1]?.summary) adjacentSummaries.push({ index: si - 1, summary: project.chapterMetas[si - 1]!.summary })
      if (project.chapterMetas[si]?.summary) adjacentSummaries.push({ index: si, summary: project.chapterMetas[si]!.summary })
    }
    if (sampleChapters.length > 0) {
      await runPass('pass3', [
        { role: 'system', content: '你是一位资深网络小说编辑，擅长评审小说中段质量。用中文回答。' },
        { role: 'user', content: fullReviewPass3Prompt({ chapters: sampleChapters, adjacentSummaries })},
      ])
    }

    // Pass 4
    const endingChapters: { index: number; content: string }[] = []
    for (let i = Math.max(0, totalChapters - 3); i < totalChapters; i++) {
      const ch = project.chapters[i]
      if (ch) endingChapters.push({ index: i, content: ch })
    }
    if (endingChapters.length > 0) {
      await runPass('pass4', [
        { role: 'system', content: '你是一位资深网络小说编辑，擅长评审小说结局质量。用中文回答。' },
        { role: 'user', content: fullReviewPass4Prompt({
          chapters: endingChapters,
          foreshadowings: project.foreshadowings.map((f) => ({
            type: f.type, content: f.content, status: f.status,
            plantedChapter: f.plantedChapter, resolvedChapter: f.resolvedChapter,
          })),
        })},
      ])
    }

    // Overall & suggestions
    if (allDimensions.length > 0) {
      const overallScore = Math.round(allDimensions.reduce((s, d) => s + d.score, 0) / allDimensions.length)
      appendLog(`\n══ 综合评分：${overallScore} / 100 ══`)

      let finalSummary = ''
      let finalSuggestions: string[] = []
      appendLog('▶ 生成整改建议...')
      try {
        const { chat } = await import('@/services/llm')
        const sugResult = await chat(config, [
          { role: 'system', content: '你是一位资深网络小说编辑。用中文回答。' },
          { role: 'user', content: fullReviewSuggestionPrompt(allDimensions, overallScore) },
        ])
        const sugParsed = parseJsonFromLLM(sugResult.content)
        if (sugParsed) {
          finalSummary = sugParsed.summary || ''
          const rawSugs: unknown[] = Array.isArray(sugParsed.suggestions) ? sugParsed.suggestions : []
          finalSuggestions = normalizeSuggestions(rawSugs)
        }
      } catch { /* fallback */ }

      setReviewSummary(finalSummary)
      setReviewSuggestions(finalSuggestions)

      if (finalSummary) appendLog(`总评：${finalSummary}`)
      for (const s of finalSuggestions) {
        appendLog(`→ 建议：${typeof s === 'string' ? s : JSON.stringify(s)}`)
      }

      const reviewResult: FullReviewResult = {
        reviewedAt: new Date().toISOString(),
        overallScore,
        dimensions: allDimensions,
        summary: finalSummary,
        suggestions: finalSuggestions,
      }
      setFullReview(activeProjectId, reviewResult)
      addToast('success', `全文审核完成，综合评分 ${overallScore}`)
    } else {
      addToast('error', '审核失败，未能获取有效结果')
    }

    setReviewRunning(false)
  }, [activeProjectId, project, totalChapters, getConfig, setFullReview, addToast])

  // Auto-trigger review when in auto-generation mode
  useEffect(() => {
    if (open && autoFullReviewPending && !reviewRunning && !existingReview) {
      runFullReview()
    }
  }, [open, autoFullReviewPending])

  // Display helpers
  const liveDimensions = (['pass1', 'pass2', 'pass3', 'pass4'] as ReviewPass[]).flatMap(
    (k) => passStates[k].dimensions
  )
  const allDisplayDimensions = liveDimensions.length > 0
    ? liveDimensions : existingReview?.dimensions ?? []
  const displayOverall = allDisplayDimensions.length > 0
    ? Math.round(allDisplayDimensions.reduce((s, d) => s + d.score, 0) / allDisplayDimensions.length)
    : 0
  const displaySuggestions = reviewSuggestions.length > 0
    ? reviewSuggestions
    : existingReview?.suggestions ? normalizeSuggestions(existingReview.suggestions as unknown[]) : []
  const displaySummary = reviewSummary || existingReview?.summary || ''

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-lg shadow-xl w-[90vw] max-w-[900px] h-[85vh] flex flex-col border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-separator)]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">rate_review</span>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">全文审核</h2>
            {existingReview && !reviewRunning && (
              <span className="text-xs text-[var(--color-text-tertiary)]">
                上次：{new Date(existingReview.reviewedAt).toLocaleString()} {existingReview.overallScore}分
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={runFullReview} disabled={reviewRunning}
              icon={<span className="material-symbols-outlined text-base">{reviewRunning ? 'hourglass_empty' : 'rate_review'}</span>}>
              {reviewRunning ? '审核中...' : existingReview ? '重新审核' : '开始审核'}
            </Button>
            <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-tertiary)]">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Pass progress */}
          {(reviewRunning || passStates.pass1.status !== 'pending' || existingReview) && (
            <div className="flex items-center gap-3">
              {(['pass1', 'pass2', 'pass3', 'pass4'] as ReviewPass[]).map((pk) => {
                const ps = passStates[pk]
                return (
                  <div key={pk} className={`flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-xs ${
                    ps.status === 'running' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' :
                    ps.status === 'done' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' :
                    ps.status === 'error' ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]' :
                    'text-[var(--color-text-tertiary)]'
                  }`}>
                    <span className={`material-symbols-outlined text-xs ${
                      ps.status === 'done' ? 'text-[var(--color-success)]' :
                      ps.status === 'running' ? 'text-[var(--color-primary)] animate-spin' :
                      ps.status === 'error' ? 'text-[var(--color-error)]' : ''
                    }`}>
                      {ps.status === 'done' ? 'check_circle' : ps.status === 'running' ? 'progress_activity' : ps.status === 'error' ? 'error' : 'radio_button_unchecked'}
                    </span>
                    {PASS_LABELS[pk]}
                  </div>
                )
              })}
            </div>
          )}

          {/* Real-time log */}
          {(reviewRunning || reviewLog.length > 0) && (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-container-low)] border border-[var(--color-border)] overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface-variant)]">
                <span className="material-symbols-outlined text-xs text-[var(--color-text-tertiary)]">terminal</span>
                <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">审核日志</span>
                {reviewRunning && <span className="material-symbols-outlined text-xs text-[var(--color-primary)] animate-spin ml-1">progress_activity</span>}
              </div>
              <div className="h-48 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {reviewLog.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Scores & suggestions */}
          {allDisplayDimensions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">综合评分</span>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${
                    displayOverall >= 90 ? 'text-[var(--color-success)]' : displayOverall >= 70 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'
                  }`}>{displayOverall}</span>
                  <span className="text-sm text-[var(--color-text-tertiary)]">/100</span>
                </div>
              </div>

              <div className="h-3 bg-[var(--color-surface-variant)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${
                  displayOverall >= 90 ? 'bg-[var(--color-success)]' : displayOverall >= 70 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-error)]'
                }`} style={{ width: `${displayOverall}%` }} />
              </div>

              <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
                {allDisplayDimensions.map((dim, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-container-low)]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      dim.score >= 90 ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' :
                      dim.score >= 70 ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' :
                      'bg-[var(--color-error)]/10 text-[var(--color-error)]'
                    }`}>{dim.score}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">{dim.name}</span>
                      <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{dim.comment}</p>
                    </div>
                  </div>
                ))}
              </div>

              {displaySummary && (
                <div className="p-3 bg-[var(--color-surface-container-low)] rounded-[var(--radius-md)]">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)] block mb-1">总评</span>
                  <p className="text-xs text-[var(--color-text-primary)] leading-relaxed">{displaySummary}</p>
                </div>
              )}

              {displaySuggestions.length > 0 && (
                <div className={`p-3 rounded-[var(--radius-md)] ${
                  displayOverall >= 90 ? 'bg-[var(--color-success)]/5 border border-[var(--color-success)]/20'
                    : 'bg-[var(--color-warning)]/5 border border-[var(--color-warning)]/20'
                }`}>
                  <span className={`text-xs font-medium block mb-1 ${
                    displayOverall >= 90 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'
                  }`}>{displayOverall >= 90 ? '优化建议' : '整改建议'}</span>
                  <ul className="space-y-1">
                    {displaySuggestions.map((s, i) => (
                      <li key={i} className="text-xs text-[var(--color-text-secondary)] leading-relaxed flex gap-1.5">
                        <span className="text-[var(--color-text-tertiary)] shrink-0">{i + 1}.</span>
                        <span>{typeof s === 'string' ? s : JSON.stringify(s)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
