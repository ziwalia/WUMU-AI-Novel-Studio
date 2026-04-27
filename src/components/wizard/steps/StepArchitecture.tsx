import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useGeneration } from '@/hooks/useGeneration'
import { buildSystemPrompt, architecturePrompt } from '@/services/prompts'
import { extractArchData } from '@/services/extractArchData'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import { parseJsonFromLLM } from '@/lib/extractJson'
import type { Message } from '@/types'

interface ArchSection {
  key: string
  title: string
  icon: string
}

const ARCH_SECTIONS: ArchSection[] = [
  { key: 'mission', title: '核心使命', icon: 'flag' },
  { key: 'worldbuilding', title: '世界观设定', icon: 'public' },
  { key: 'plotOutline', title: '主线情节', icon: 'timeline' },
  { key: 'characters', title: '角色体系', icon: 'group' },
  { key: 'relationships', title: '角色关系', icon: 'diversity_3' },
  { key: 'narrativeStyle', title: '叙事风格', icon: 'brush' },
]

function flattenValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map((item) => flattenValue(item)).join('\n\n')
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        const content = flattenValue(v)
        return content.includes('\n') ? `${label}:\n${content}` : `${label}: ${content}`
      })
      .join('\n\n')
  }
  return String(value)
}

function parseArchitecture(raw: string): Record<string, string> | null {
  try {
    const parsed = parseJsonFromLLM<Record<string, unknown>>(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = flattenValue(value)
    }
    return result
  } catch {
    return null
  }
}

export function StepArchitecture() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setArchitecture = useNovelStore((s) => s.setArchitecture)
  const genres = useUIStore((s) => s.genres)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const { generate, isStreaming, stopGeneration } = useGeneration()

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const hasContent = project.architecture || streamingContent
  const displayContent = streamingContent || project.architecture
  const parsed = displayContent ? parseArchitecture(displayContent) : null

  const handleGenerate = async () => {
    const chars = project.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo }))
    const rels = project.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description }))
    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: architecturePrompt(project.params, genres, chars.length > 0 ? chars : undefined, rels.length > 0 ? rels : undefined) },
    ]

    await generate(messages, undefined, (content) => {
      if (activeProjectId) {
        setArchitecture(activeProjectId, content)
        extractArchData(content)
      }
    })

    const finalArch = useNovelStore.getState().projects.find((p) => p.id === activeProjectId)?.architecture
    if (finalArch) {
      extractArchData(finalArch)
    }
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
                  正在生成小说架构...
                </h3>
                <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
                  AI 正在思考，请稍候
                </p>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-[var(--color-primary)]">
                  account_tree
                </span>
                <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
                  生成小说架构
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2 max-w-md">
                  AI 将基于你的参数生成完整的小说架构方案，包含使命、世界观、情节、角色、叙事风格五个子模块
                </p>
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
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)]">
              小说架构方案
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

          {parsed ? (
            <div className="space-y-4">
              {ARCH_SECTIONS.map((section) => {
                const content = parsed[section.key]
                if (!content) return null
                return (
                  <div
                    key={section.key}
                    className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">
                        {section.icon}
                      </span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {section.title}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                      {content}
                    </div>
                  </div>
                )
              })}
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
