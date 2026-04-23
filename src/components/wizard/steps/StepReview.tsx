import { useNovelStore } from '@/stores/novelStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useGeneration } from '@/hooks/useGeneration'
import { buildSystemPrompt, reviewPrompt } from '@/services/prompts'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import type { Message } from '@/types'

interface ReviewIssue {
  type: string
  severity: string
  location: string
  description: string
  suggestion: string
}

interface ReviewResult {
  issues: ReviewIssue[]
  overallScore: number
  summary: string
}

function parseReview(raw: string): ReviewResult | null {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch?.[1]) {
      return JSON.parse(jsonMatch[1])
    }
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const severityColors: Record<string, string> = {
  high: 'text-[var(--color-error)] bg-red-50 dark:bg-red-950/30',
  medium: 'text-[var(--color-warning)] bg-amber-50 dark:bg-amber-950/30',
  low: 'text-[var(--color-text-tertiary)] bg-[var(--color-surface-variant)]',
}

const severityLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const typeLabels: Record<string, string> = {
  title: '标题',
  opening: '开头',
  character: '角色',
  plot: '情节',
  timeline: '时间线',
  foreshadowing: '伏笔',
  style: '文笔',
  continuity: '连贯',
}

export function StepReview() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setReviewResult = useNovelStore((s) => s.setReviewResult)
  const incrementReviewRound = useNovelStore((s) => s.incrementReviewRound)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const { generate, isStreaming, stopGeneration } = useGeneration()

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const chapterIdx = project.currentChapterIndex
  const chapterContent = project.chapters[chapterIdx]
  const savedReview = project.reviewResults[chapterIdx]
  const displayContent = streamingContent || savedReview

  const parsed = displayContent ? parseReview(displayContent) : null

  const handleReview = async () => {
    if (!chapterContent || !activeProjectId) return

    // Increment round counter immediately
    incrementReviewRound(activeProjectId, chapterIdx)

    // Build foreshadowing list for context
    const openFs = project.foreshadowings
      .filter((f) => f.status === 'planted')
      .map((f) => `[${f.type}] 第${f.plantedChapter + 1}章埋: ${f.content}`)
      .join('\n')

    // Build character summary from structured characters
    const charSummary = project.characters.length > 0
      ? project.characters.map((c) => `${c.name}(${c.weight}): ${c.basicInfo}`).join('\n')
      : project.params.coreCharacters

    // Build continuity context for review — use snapshot before this chapter
    const continuityContext: Parameters<typeof reviewPrompt>[3] = {}
    const reviewSnap = chapterIdx > 0
      ? project.chapterMetas?.[chapterIdx - 1]?.runningSummarySnapshot
      : undefined
    if (reviewSnap) {
      continuityContext.runningSummary = reviewSnap
    }
    const recentStart = Math.max(0, chapterIdx - 10)
    const recent = []
    for (let i = recentStart; i < chapterIdx; i++) {
      const meta = project.chapterMetas[i]
      if (meta?.summary) recent.push({ index: i, summary: meta.summary })
    }
    if (recent.length > 0) continuityContext.recentSummaries = recent

    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: reviewPrompt(chapterContent, charSummary, openFs || undefined,
          Object.keys(continuityContext).length > 0 ? continuityContext : undefined),
      },
    ]

    await generate(messages, undefined, (content) => {
      if (activeProjectId) {
        setReviewResult(activeProjectId, chapterIdx, content)
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border-separator)]">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          审校第 {chapterIdx + 1} 章
          {project.reviewRounds?.[chapterIdx] ? (
            <span className="text-xs text-[var(--color-text-tertiary)] ml-2">
              第{project.reviewRounds![chapterIdx]}次审校
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <Spinner size="sm" />
              <span>审校中...</span>
            </div>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={isStreaming ? stopGeneration : handleReview}
            disabled={!chapterContent}
            icon={
              <span className="material-symbols-outlined text-base">
                {isStreaming ? 'stop' : 'fact_check'}
              </span>
            }
          >
            {isStreaming ? '停止' : savedReview ? '重新审校' : '开始审校'}
          </Button>
        </div>
      </div>

      {!displayContent ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-[var(--color-text-tertiary)]">
              fact_check
            </span>
            <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
              一致性审校
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2">
              {chapterContent
                ? '检查角色一致性、伏笔连贯性、情节逻辑'
                : '请先生成本章草稿'}
            </p>
          </div>
        </div>
      ) : parsed ? (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Score badge */}
          <div className="flex items-center gap-4 bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-primary)]/10">
              <span className="text-xl font-bold text-[var(--color-primary)]">
                {parsed.overallScore}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">综合评分</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{parsed.summary}</p>
            </div>
          </div>

          {/* Issues list */}
          {parsed.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                发现 {parsed.issues.length} 个问题
              </h4>
              {parsed.issues.map((issue, i) => (
                <div
                  key={i}
                  className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${severityColors[issue.severity] ?? ''}`}>
                      {severityLabels[issue.severity] ?? issue.severity}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-variant)] text-[var(--color-text-secondary)]">
                      {typeLabels[issue.type] ?? issue.type}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">{issue.location}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-primary)]">{issue.description}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                    建议：{issue.suggestion}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <pre className="text-[var(--color-text-primary)] whitespace-pre-wrap"
            style={{ fontFamily: 'var(--font-content)', fontSize: 'var(--font-content-size)', lineHeight: 'var(--font-content-lh)' }}
          >
            {displayContent}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-[var(--color-primary)] animate-pulse ml-0.5 align-text-bottom" />
            )}
          </pre>
        </div>
      )}
    </div>
  )
}
