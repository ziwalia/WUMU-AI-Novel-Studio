import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useGeneration } from '@/hooks/useGeneration'
import { buildSystemPrompt, novelOutlinePrompt } from '@/services/prompts'
import { extractOutlineData } from '@/services/extractOutlineData'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import { parseJsonFromLLM } from '@/lib/extractJson'
import type { Message, OutlineStage } from '@/types'

export function StepOutline() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setNovelOutline = useNovelStore((s) => s.setNovelOutline)
  const genres = useUIStore((s) => s.genres)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const { generate, isStreaming, stopGeneration } = useGeneration()

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const hasContent = project.novelOutline || streamingContent
  const displayContent = streamingContent || project.novelOutline

  const parseStages = (raw: string): OutlineStage[] | null => {
    try {
      const parsed = parseJsonFromLLM<OutlineStage[]>(raw)
      if (!parsed || !Array.isArray(parsed)) return null
      return parsed
    } catch {
      return null
    }
  }

  const stages = displayContent ? parseStages(displayContent) : null

  const handleGenerate = async () => {
    if (!project.architecture) return

    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: novelOutlinePrompt(
          project.params,
          project.architecture,
          genres,
          project.characters.map((c) => ({
            name: c.name,
            weight: c.weight,
            age: c.age,
            personality: c.personality,
            abilities: c.abilities,
            basicInfo: c.basicInfo,
          })),
          project.relationships.map((r) => ({
            from: r.from,
            to: r.to,
            type: r.type,
            description: r.description,
          })),
        ),
      },
    ]

    await generate(messages, undefined, (content) => {
      if (activeProjectId) {
        setNovelOutline(activeProjectId, content)
        extractOutlineData(content)
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {isStreaming ? (
              <>
                <Spinner size="lg" />
                <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
                  正在生成小说大纲...
                </h3>
                <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
                  AI 正在思考，请稍候
                </p>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-[var(--color-primary)]">
                  library_books
                </span>
                <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
                  生成小说大纲
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2 max-w-md">
                  基于小说架构，规划全书的故事阶段和章节安排
                </p>
                {!project.architecture ? (
                  <p className="text-xs text-[var(--color-error)] mt-2">请先完成"小说架构"步骤</p>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    className="mt-6"
                    onClick={handleGenerate}
                    disabled={isStreaming}
                    icon={
                      <span className="material-symbols-outlined text-base">
                        auto_awesome
                      </span>
                    }
                  >
                    开始生成
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)]">
              小说大纲
            </h3>
            <div className="flex items-center gap-2">
              {isStreaming && (
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <Spinner size="sm" />
                  <span>正在生成...</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={isStreaming ? stopGeneration : handleGenerate}
                icon={
                  <span className="material-symbols-outlined text-base">
                    {isStreaming ? 'stop' : 'refresh'}
                  </span>
                }
              >
                {isStreaming ? '停止' : '重新生成'}
              </Button>
            </div>
          </div>

          {stages ? (
            <div className="space-y-4">
              {stages.map((stage) => (
                <div
                  key={stage.stageIndex}
                  className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold">
                        {stage.stageIndex}
                      </span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {stage.title}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      第{stage.chapterRange?.[0] ?? '?'}-{stage.chapterRange?.[1] ?? '?'}章
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">{stage.theme}</p>
                  {stage.emotionalTone && (
                    <p className="text-xs text-[var(--color-primary)] mb-2 font-medium">
                      情感基调：{stage.emotionalTone}
                    </p>
                  )}
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                        关键事件
                      </span>
                      <ul className="mt-1 space-y-1">
                        {stage.keyEvents.map((evt, i) => (
                          <li key={i} className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2">
                            <span className="material-symbols-outlined text-sm text-[var(--color-primary)] mt-0.5">
                              chevron_right
                            </span>
                            {evt}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {stage.characterArcs && (
                      <div>
                        <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                          角色变化
                        </span>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                          {stage.characterArcs}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6">
              <pre className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed font-mono">
                {displayContent}
                {isStreaming && (
                  <span className="inline-block w-0.5 h-4 bg-[var(--color-primary)] animate-pulse ml-0.5 align-text-bottom" />
                )}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
