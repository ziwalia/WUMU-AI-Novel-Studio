import { useNovelStore } from '@/stores/novelStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useGeneration } from '@/hooks/useGeneration'
import { buildSystemPrompt, rewritePrompt } from '@/services/prompts'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import type { Message } from '@/types'

export function StepRewrite() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setChapterContent = useNovelStore((s) => s.setChapterContent)
  const setChapterStatus = useNovelStore((s) => s.setChapterStatus)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const { generate, isStreaming, stopGeneration } = useGeneration()

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const chapterIdx = project.currentChapterIndex
  const originalContent = project.chapters[chapterIdx]
  const reviewResult = project.reviewResults[chapterIdx]
  const displayContent = streamingContent || originalContent
  const wordCount = displayContent?.length ?? 0
  const reviewRound = project.reviewRounds?.[chapterIdx] || 0

  const handleRewrite = async () => {
    if (!originalContent || !reviewResult) return

    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: rewritePrompt(originalContent, reviewResult, project.params) },
    ]

    await generate(messages, undefined, (content) => {
      if (activeProjectId) {
        setChapterContent(activeProjectId, chapterIdx, content)
        setChapterStatus(activeProjectId, chapterIdx, 'rewriting')
      }
    })
  }

  const hasRewritten = project.chapterStatuses[chapterIdx] === 'rewriting'

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border-separator)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            改写第 {chapterIdx + 1} 章
          </span>
          {reviewRound > 0 && (
            <span className="text-xs text-[var(--color-text-tertiary)]">
              已审校{reviewRound}次
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {displayContent && (
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {wordCount.toLocaleString()} 字
            </span>
          )}
          {isStreaming ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={stopGeneration}
              icon={<span className="material-symbols-outlined text-base">stop</span>}
            >
              停止
            </Button>
          ) : (
            !hasRewritten ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRewrite}
                disabled={!originalContent || !reviewResult}
                icon={<span className="material-symbols-outlined text-base">rate_review</span>}
              >
                开始改写
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRewrite}
                disabled={!originalContent || !reviewResult}
                icon={<span className="material-symbols-outlined text-base">refresh</span>}
              >
                重新改写
              </Button>
            )
          )}
        </div>
      </div>

      {displayContent ? (
        <div className="flex-1 overflow-y-auto">
          <div className="text-[var(--color-text-primary)] whitespace-pre-wrap"
            style={{ fontFamily: 'var(--font-content)', fontSize: 'var(--font-content-size)', lineHeight: 'var(--font-content-lh)' }}
          >
            {displayContent}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-[var(--color-primary)] animate-pulse ml-0.5 align-text-bottom" />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {isStreaming ? (
              <>
                <Spinner size="lg" />
                <p className="text-sm text-[var(--color-text-secondary)] mt-4">
                  正在改写第 {chapterIdx + 1} 章...
                </p>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-[var(--color-text-tertiary)]">
                  rate_review
                </span>
                <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
                  改写
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2 max-w-md">
                  {!originalContent
                    ? '请先在"草稿生成"步骤生成本章内容'
                    : !reviewResult
                      ? '请先在"一致性审校"步骤完成审校'
                      : '基于审校建议改写章节内容，修复发现的问题'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
