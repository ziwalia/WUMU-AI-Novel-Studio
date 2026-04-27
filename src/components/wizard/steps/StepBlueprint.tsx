import { useState } from 'react'
import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useLLMStore } from '@/stores/llmStore'
import { useGeneration } from '@/hooks/useGeneration'
import { saveCharacterSnapshot, updateChapterMeta } from '@/stores/characterStore'
import { buildSystemPrompt, blueprintPrompt, blueprintDedupPrompt, blueprintDedupRewritePrompt } from '@/services/prompts'
import { extractOutlineData } from '@/services/extractOutlineData'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import { parseJsonFromLLM } from '@/lib/extractJson'
import type { Message, ChapterBlueprint } from '@/types'

export function StepBlueprint() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setBlueprint = useNovelStore((s) => s.setBlueprint)
  const genres = useUIStore((s) => s.genres)
  const dedupStatus = useUIStore((s) => s.dedupStatus)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const { generate, isStreaming, stopGeneration } = useGeneration()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSummary, setEditSummary] = useState<Record<number, string>>({})
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [dedupResult, setDedupResult] = useState<{ duplicateGroups: { chapters: number[]; reason: string; suggestion: string }[]; overallScore: number; summary: string } | null>(null)
  const [showDedup, setShowDedup] = useState(false)
  const [dedupLoading, setDedupLoading] = useState(false)
  const [rewriteLoading, setRewriteLoading] = useState(false)


  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const hasContent = project.blueprint || streamingContent
  const displayContent = streamingContent || project.blueprint

  const parseBlueprint = (raw: string): ChapterBlueprint[] | null => {
    try {
      const parsed = parseJsonFromLLM<ChapterBlueprint[]>(raw)
      if (!parsed || !Array.isArray(parsed)) return null
      const first = parsed[0]
      if (first && first.chapterIndex >= 1 && first.chapterIndex <= 2) {
        return parsed.map((ch: ChapterBlueprint, i: number) => ({
          ...ch,
          chapterIndex: i,
        }))
      }
      return parsed
    } catch {
      return null
    }
  }

  const chapters = displayContent ? parseBlueprint(displayContent) : null

  const getSummaryForChapter = (ch: ChapterBlueprint): string => {
    const meta = project.chapterMetas[ch.chapterIndex]
    if (meta?.summary) return meta.summary
    if (editSummary[ch.chapterIndex] !== undefined) return editSummary[ch.chapterIndex] ?? ''
    return ch.summary || ''
  }

  const handleSummaryChange = (chapterIndex: number, value: string) => {
    setEditSummary((prev) => ({ ...prev, [chapterIndex]: value }))
  }

  const handleSummaryBlur = (chapterIndex: number) => {
    const newSummary = editSummary[chapterIndex]
    if (newSummary === undefined || !activeProjectId) return
    const meta = project.chapterMetas[chapterIndex]
    if (meta?.summary && meta.summary === newSummary) return
    updateChapterMeta(chapterIndex, { summary: newSummary })
  }

  const handleGenerate = async () => {
    if (!project.novelOutline) return

    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: blueprintPrompt(
          project.params,
          project.novelOutline,
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
        setBlueprint(activeProjectId, content)
        extractOutlineData(content)
        saveCharacterSnapshot(0)
        // Auto-run dedup check after blueprint generation
        runDedupCheck(content)
      }
    })
  }

  const runDedupCheck = async (blueprintContent?: string) => {
    const raw = blueprintContent || project.blueprint
    const parsed = raw ? parseBlueprint(raw) : null
    if (!parsed || parsed.length < 2 || !activeProjectId) return

    setDedupLoading(true)
    try {
      const config = useLLMStore.getState().getActiveConfig()
      if (!config) { setDedupLoading(false); return }
      const { chat } = await import('@/services/llm')
      const msgs: Message[] = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: blueprintDedupPrompt(parsed) },
      ]
      const result = await chat(config, msgs)
      const dedup = parseJsonFromLLM<{ duplicateGroups: { chapters: number[]; reason: string; suggestion: string }[]; overallScore: number; summary: string }>(result.content)
      if (!dedup) return
      setDedupResult(dedup)
      setShowDedup(true)
    } catch {
      // Silently ignore dedup failures
    } finally {
      setDedupLoading(false)
    }
  }

  const handleRewriteDuplicates = async () => {
    if (!dedupResult || !chapters || !activeProjectId) return
    if (dedupResult.duplicateGroups.length === 0) return

    setRewriteLoading(true)
    try {
      const config = useLLMStore.getState().getActiveConfig()
      if (!config) return
      const { chat } = await import('@/services/llm')

      // Compute explicit rewrite targets: keep first chapter per group, rewrite the rest
      const chapterMap = new Map(chapters.map((c) => [c.chapterIndex, c]))
      const targets: { chapterIndex: number; currentTitle: string; currentSummary: string; reason: string; suggestion: string }[] = []
      for (const group of dedupResult.duplicateGroups) {
        const sorted = [...group.chapters].sort((a, b) => a - b)
        for (let gi = 1; gi < sorted.length; gi++) {
          const chNum = sorted[gi]!
          const idx = chNum - 1 // dedup returns 1-based
          const existing = chapterMap.get(idx)
          if (existing) {
            targets.push({
              chapterIndex: idx,
              currentTitle: existing.title,
              currentSummary: existing.summary,
              reason: group.reason,
              suggestion: group.suggestion,
            })
          }
        }
      }
      if (targets.length === 0) return

      const msgs: Message[] = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: blueprintDedupRewritePrompt(chapters, targets) },
      ]
      const result = await chat(config, msgs)
      const rewrites = parseJsonFromLLM<{ chapterIndex: number; title: string; summary: string }[]>(result.content)
      if (!rewrites || !Array.isArray(rewrites) || rewrites.length === 0) return

      const rewriteMap = new Map<number, { chapterIndex: number; title: string; summary: string }>()
      for (const r of rewrites) {
        rewriteMap.set(r.chapterIndex, r)
        if (r.chapterIndex >= 1) rewriteMap.set(r.chapterIndex - 1, r)
      }

      const raw = project.blueprint
      const parsed = parseJsonFromLLM<ChapterBlueprint[]>(raw)
      if (!parsed || !Array.isArray(parsed)) return

      // Only rewrite specific targets, reject duplicate titles
      const existingTitles = new Set(parsed.map((c) => c.title))
      let modified = false
      for (const target of targets) {
        const rw = rewriteMap.get(target.chapterIndex)
        if (!rw?.title || !rw.summary) continue
        if (existingTitles.has(rw.title) && rw.title !== target.currentTitle) continue
        const ch = parsed.find((c) => c.chapterIndex === target.chapterIndex)
        if (ch) {
          existingTitles.delete(ch.title)
          ch.title = rw.title
          ch.summary = rw.summary
          existingTitles.add(rw.title)
          modified = true
        }
      }

      if (modified) {
        const newBlueprint = JSON.stringify(parsed, null, 2)
        setBlueprint(activeProjectId, newBlueprint)
        extractOutlineData(newBlueprint)
        // Re-run dedup check to update score
        setDedupResult(null)
        runDedupCheck(newBlueprint)
      }
    } catch {
      // Silently ignore
    } finally {
      setRewriteLoading(false)
    }
  }

  const handleEditSave = (_index: number) => {
    setEditingIndex(null)
  }

  const isChapterFinalized = (idx: number) => project.chapterStatuses[idx] === 'finalized'
  const isDedupFlagged = (idx: number) => dedupResult?.duplicateGroups?.some((g) => g.chapters.includes(idx + 1)) || false

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {isStreaming ? (
              <>
                <Spinner size="lg" />
                <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
                  正在生成章节目录...
                </h3>
                <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
                  AI 正在思考，请稍候
                </p>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-[var(--color-primary)]">
                  list_alt
                </span>
                <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
                  生成章节目录
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2 max-w-md">
                  基于小说大纲生成详细的章节目录，可调整顺序和编辑标题
                </p>
                {!project.novelOutline ? (
                  <p className="text-xs text-[var(--color-error)] mt-2">请先完成"小说大纲"步骤</p>
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
              章节目录
              {chapters && (
                <span className="text-sm font-normal text-[var(--color-text-tertiary)] ml-2">
                  共 {chapters.length} 章
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {isStreaming && (
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <Spinner size="sm" />
                  <span>正在生成...</span>
                </div>
              )}
              {chapters && !isStreaming && !dedupResult && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runDedupCheck()}
                  disabled={dedupLoading}
                  icon={
                    <span className="material-symbols-outlined text-base">
                      {dedupLoading ? 'hourglass_empty' : 'content_copy'}
                    </span>
                  }
                >
                  {dedupLoading ? '检测中...' : '去重检测'}
                </Button>
              )}
              {dedupResult && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDedup(!showDedup)}
                  icon={
                    <span className="material-symbols-outlined text-base">
                      {showDedup ? 'expand_less' : 'content_copy'}
                    </span>
                  }
                >
                  去重结果 {dedupResult.overallScore < 9 ? `(${dedupResult.overallScore}/10)` : ''}
                </Button>
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

          {/* Dedup result panel */}
          {showDedup && dedupResult && (
            <div className={`mb-4 p-3 rounded-[var(--radius-lg)] border ${
              dedupResult.overallScore >= 9 ? 'bg-green-500/10 border-green-500/30' :
              dedupResult.overallScore >= 7 ? 'bg-yellow-500/10 border-yellow-500/30' :
              'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  去重检测结果：{dedupResult.overallScore}/10
                </span>
                <button onClick={() => setShowDedup(false)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">{dedupResult.summary}</p>
              {dedupResult.duplicateGroups.length > 0 && (
                <div className="space-y-2">
                  {dedupResult.duplicateGroups.map((g, i) => (
                    <div key={i} className="text-xs bg-[var(--color-surface-container-lowest)] rounded p-2">
                      <div className="font-medium text-[var(--color-text-primary)]">
                        雷同章节：第{g.chapters.join('、')}章
                      </div>
                      <div className="text-[var(--color-text-secondary)]">原因：{g.reason}</div>
                      <div className="text-[var(--color-primary)]">建议：{g.suggestion}</div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleRewriteDuplicates}
                      disabled={rewriteLoading}
                      icon={
                        <span className="material-symbols-outlined text-base">
                          {rewriteLoading ? 'hourglass_empty' : 'auto_fix_high'}
                        </span>
                      }
                    >
                      {rewriteLoading ? '正在重写...' : '一键重写雷同章节'}
                    </Button>
                  </div>
                </div>
              )}
              {dedupResult.duplicateGroups.length === 0 && (
                <p className="text-xs text-green-600">未检测到明显的章节结构重复</p>
              )}
            </div>
          )}

          {dedupStatus && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-sm text-[var(--color-primary)]">
              <span className="material-symbols-outlined text-base animate-spin">sync</span>
              <span>{dedupStatus}</span>
            </div>
          )}

          {chapters ? (
            <div className="space-y-2">
              {chapters.map((ch) => {
                const finalized = isChapterFinalized(ch.chapterIndex)
                const flagged = isDedupFlagged(ch.chapterIndex)
                const expanded = expandedIndex === ch.chapterIndex
                const summary = getSummaryForChapter(ch)

                return (
                  <div
                    key={ch.chapterIndex}
                    className={`rounded-[var(--radius-md)] border transition-colors ${
                      flagged
                        ? 'border-yellow-500/50 bg-yellow-500/5'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-container-lowest)]'
                    }`}
                  >
                    {/* Title row */}
                    <div
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--color-surface-hover)] rounded-[var(--radius-md)]"
                      onClick={() => setExpandedIndex(expanded ? null : ch.chapterIndex)}
                    >
                      <span className="text-xs font-mono text-[var(--color-text-tertiary)] w-8 text-right shrink-0">
                        {String(ch.chapterIndex + 1).padStart(2, '0')}
                      </span>
                      <span className={`material-symbols-outlined text-lg ${finalized ? 'text-[var(--color-success)]' : 'text-red-500'}`}>
                        {finalized ? 'check_circle' : 'cancel'}
                      </span>
                      {editingIndex === ch.chapterIndex ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleEditSave(ch.chapterIndex)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(ch.chapterIndex)
                            if (e.key === 'Escape') setEditingIndex(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 text-sm bg-transparent border-b border-[var(--color-primary)] text-[var(--color-text-primary)] focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="flex-1 text-sm text-[var(--color-text-primary)] font-medium">
                          {ch.title}
                        </span>
                      )}
                      <span className="text-xs text-[var(--color-text-tertiary)] max-w-xs truncate">
                        {summary.slice(0, 40)}{summary.length > 40 ? '...' : ''}
                      </span>
                      <span className="material-symbols-outlined text-sm text-[var(--color-text-tertiary)]">
                        {expanded ? 'expand_less' : 'expand_more'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingIndex(ch.chapterIndex)
                          setEditTitle(ch.title)
                        }}
                        className="p-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </div>

                    {/* Expanded summary textarea */}
                    {expanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border-separator)]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                            章节摘要
                          </span>
                          {finalized && (
                            <span className="text-xs text-[var(--color-success)] font-medium">
                              (已定稿)
                            </span>
                          )}
                        </div>
                        <textarea
                          value={summary}
                          onChange={(e) => handleSummaryChange(ch.chapterIndex, e.target.value)}
                          onBlur={() => handleSummaryBlur(ch.chapterIndex)}
                          rows={3}
                          className="w-full px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] resize-y"
                          placeholder="输入本章摘要..."
                        />
                      </div>
                    )}
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
