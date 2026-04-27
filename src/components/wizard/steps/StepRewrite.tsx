import { useNovelStore } from '@/stores/novelStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useLLMStore } from '@/stores/llmStore'
import { useGeneration } from '@/hooks/useGeneration'
import { buildSystemPrompt, rewritePrompt } from '@/services/prompts'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import { parseJsonFromLLM } from '@/lib/extractJson'
import type { Message } from '@/types'

async function reExtractMeta(chapterIdx: number, getContent: () => string | undefined, getConfig: () => import('@/types').LLMConfig | undefined) {
  const config = getConfig()
  if (!config) return
  const content = getContent()
  if (!content) return

  const project = useNovelStore.getState().projects.find(
    (p) => p.id === useNovelStore.getState().activeProjectId,
  )
  if (!project) return

  try {
    const { buildSystemPrompt: bsp, extractChapterMetaPrompt } = await import('@/services/prompts')
    const { chat } = await import('@/services/llm')
    const { updateChapterMeta, addForeshadowing, resolveForeshadowing, addCharacter, updateCharacter, createCharacter, addRelationship, updateRelationship } = await import('@/stores/characterStore')
    const existingFs = project.foreshadowings.map((f) => ({ id: f.id, type: f.type, content: f.content, status: f.status }))

    const msgs: Message[] = [
      { role: 'system', content: bsp() },
      { role: 'user', content: extractChapterMetaPrompt(chapterIdx, content, existingFs) },
    ]
    const result = await chat(config, msgs)
    const parsed = parseJsonFromLLM<Record<string, unknown>>(result.content)
    if (!parsed) return

    const metaUpdates: Partial<import('@/types').ChapterMeta> = {}
    if (parsed.summary && typeof parsed.summary === 'string') metaUpdates.summary = parsed.summary
    if (parsed.timeline && typeof parsed.timeline === 'string') metaUpdates.timeline = parsed.timeline
    if (Array.isArray(parsed.sceneTypes)) metaUpdates.sceneTypes = parsed.sceneTypes
    if (parsed.pacingTag && ['tension', 'calm', 'transition'].includes(parsed.pacingTag as string)) {
      metaUpdates.pacingTag = parsed.pacingTag as 'tension' | 'calm' | 'transition'
    }
    if (parsed.emotionIntensity && ['high', 'medium', 'low'].includes(parsed.emotionIntensity as string)) {
      metaUpdates.emotionIntensity = parsed.emotionIntensity as 'high' | 'medium' | 'low'
    }
    if (Object.keys(metaUpdates).length > 0) updateChapterMeta(chapterIdx, metaUpdates)

    // Apply character/relationship changes
    if (Array.isArray(parsed.characterChanges) || Array.isArray(parsed.relationshipChanges)) {
      const charNameMap = new Map(project.characters.map((c) => [c.name, c]))
      const REL_MAP: Record<string, import('@/types').RelationshipType> = {
        '恋人': '恋人', '师徒': '师徒', '敌对': '敌对', '同门': '同门',
        '盟友': '盟友', '朋友': '朋友', '亲人': '亲人', '其他': '其他',
      }
      for (const change of (Array.isArray(parsed.characterChanges) ? parsed.characterChanges : []) as { name: string; type: string; changes: Record<string, unknown> }[]) {
        if (!change.name || !change.changes) continue
        if (change.type === 'new_character' && !charNameMap.has(change.name)) {
          const nc = createCharacter({
            name: change.name,
            weight: ((role: string) => { const r = role.toLowerCase(); return r.includes('主角') ? 'protagonist' as const : r.includes('反派') ? 'major' as const : 'supporting' as const })(change.changes.role as string || ''),
            age: (change.changes.age as string) || '',
            personality: (change.changes.personality as string) || '',
            abilities: Array.isArray(change.changes.abilities) ? change.changes.abilities.map(String) : [],
            basicInfo: (change.changes.description as string) || '',
          })
          addCharacter(nc)
          charNameMap.set(change.name, nc)
        } else if (change.type === 'status_update') {
          const existing = charNameMap.get(change.name)
          if (existing) {
            const u: Partial<import('@/types').Character> = { lastAppearance: chapterIdx }
            const c = change.changes
            if (c.personality) u.personality = c.personality as string
            if (Array.isArray(c.abilities) && c.abilities.length > 0) u.abilities = c.abilities.map(String)
            if (c.location) u.locationTrajectory = [...(existing.locationTrajectory || []), c.location as string]
            if (c.status === 'dead' || c.status === 'alive') u.lifeStatus = c.status as 'alive' | 'dead'
            if (Object.keys(u).length > 1) updateCharacter(existing.id, u)
          }
        }
      }
      for (const rc of (Array.isArray(parsed.relationshipChanges) ? parsed.relationshipChanges : []) as { from: string; to: string; action: string; type: string; description?: string }[]) {
        if (!rc.from || !rc.to) continue
        const rt = REL_MAP[rc.type] || '其他'
        if (rc.action === 'add') {
          const exists = project.relationships.find((r) => (r.from === rc.from && r.to === rc.to) || (r.from === rc.to && r.to === rc.from))
          if (!exists) addRelationship({ from: rc.from, to: rc.to, type: rt, description: rc.description || '' })
        } else if (rc.action === 'change') {
          const existing = project.relationships.find((r) => (r.from === rc.from && r.to === rc.to) || (r.from === rc.to && r.to === rc.from))
          if (existing) updateRelationship(existing.id, { type: rt, ...(rc.description ? { description: rc.description } : {}) })
        }
      }
    }

    // Foreshadowing
    if (Array.isArray(parsed.foreshadowingPlanted)) {
      for (const fs of parsed.foreshadowingPlanted as { type?: string; content?: string }[]) {
        if (!fs.content) continue
        addForeshadowing({ id: `fs-rw-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, type: (fs.type as import('@/types').ForeshadowingType) || 'SF', content: fs.content, status: 'planted', plantedChapter: chapterIdx, resolvedChapter: -1, priority: 'medium' })
      }
    }
    if (Array.isArray(parsed.foreshadowingResolved)) {
      for (const rc of parsed.foreshadowingResolved) {
        if (typeof rc !== 'string') continue
        const match = project.foreshadowings.find((f) => f.status === 'planted' && (f.content === rc || f.content.includes(rc) || rc.includes(f.content)))
        if (match) resolveForeshadowing(match.id, chapterIdx)
      }
    }
  } catch { /* silently ignore */ }
}

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

    // Build character context
    const charSummary = project.characters.length > 0
      ? project.characters.map((c) => {
          const status = c.lifeStatus === 'dead' ? '【已死亡】' : c.lifeStatus === 'alive' ? '【存活】' : ''
          const loc = c.locationTrajectory.length > 0 ? `当前位置：${c.locationTrajectory[c.locationTrajectory.length - 1]}` : ''
          return `- ${c.name}（${c.weight}）${status}：性格：${c.personality || '未知'}，能力：${c.abilities.join('、') || '无'}${loc ? '，' + loc : ''}`
        }).join('\n')
      : undefined

    const relSummary = project.relationships.length > 0
      ? project.relationships.map((r) => `- ${r.from} ←${r.type}→ ${r.to}${r.description ? `：${r.description}` : ''}`).join('\n')
      : undefined

    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: rewritePrompt(originalContent, reviewResult, project.params, { characters: charSummary, relationships: relSummary }) },
    ]

    await generate(messages, undefined, (content) => {
      if (activeProjectId) {
        setChapterContent(activeProjectId, chapterIdx, content)
        setChapterStatus(activeProjectId, chapterIdx, 'rewriting')
      }
    })

    // Re-extract meta from rewritten content in background
    reExtractMeta(
      chapterIdx,
      () => useNovelStore.getState().projects.find((p) => p.id === activeProjectId)?.chapters[chapterIdx],
      () => useLLMStore.getState().getActiveConfig(),
    )
  }

  const hasRewritten = project.chapterStatuses[chapterIdx] === 'rewriting'
  const hasHistory = (project.chapterHistory?.[chapterIdx]?.length ?? 0) > 0

  const handleRestore = () => {
    if (!activeProjectId || !hasHistory) return
    const history = project.chapterHistory?.[chapterIdx]
    if (!history || history.length === 0) return
    const previous = history[history.length - 1]
    if (previous) {
      setChapterContent(activeProjectId, chapterIdx, previous)
      setChapterStatus(activeProjectId, chapterIdx, 'draft')
    }
  }

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
          {hasRewritten && hasHistory && !isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestore}
              icon={<span className="material-symbols-outlined text-base">undo</span>}
            >
              恢复原文
            </Button>
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
