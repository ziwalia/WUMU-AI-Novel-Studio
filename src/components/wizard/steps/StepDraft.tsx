import { useState } from 'react'
import { useNovelStore } from '@/stores/novelStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { useGeneration } from '@/hooks/useGeneration'
import { addCharacter, updateCharacter, createCharacter, addRelationship, addForeshadowing, resolveForeshadowing, updateChapterMeta, saveCharacterSnapshot, restoreCharacterSnapshot } from '@/stores/characterStore'
import { buildSystemPrompt, draftPrompt, extractChapterMetaPrompt, updateRunningSummaryPrompt, type DraftContext } from '@/services/prompts'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import type { Message, CharacterWeight, Foreshadowing } from '@/types'

type DraftCharChange = {
  name: string
  type: 'status_update' | 'new_character'
  changes: {
    role?: string
    age?: string
    personality?: string
    abilities?: string[]
    description?: string
    basicInfo?: string
    location?: string
    status?: string
  }
}

type DraftRelChange = {
  from: string
  to: string
  action: 'add' | 'change'
  type: string
  description?: string
}

const REL_TYPE_MAP: Record<string, import('@/types').RelationshipType> = {
  '恋人': '恋人', '师徒': '师徒', '敌对': '敌对', '同门': '同门',
  '盟友': '盟友', '朋友': '朋友', '亲人': '亲人', '其他': '其他',
}

const FS_TYPE_MAP: Record<string, import('@/types').ForeshadowingType> = {
  '主线伏笔': 'MF', '动作伏笔': 'AF', '角色伏笔': 'CF',
  '设定伏笔': 'SF', '预言伏笔': 'YF',
}

function generateFsId(): string {
  return `fs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function parseRoleToWeight(role: string): CharacterWeight {
  const r = role.toLowerCase()
  if (r.includes('主角') || r.includes('主人公')) return 'protagonist'
  if (r.includes('反派') || r.includes('boss')) return 'major'
  if (r.includes('重要') || r.includes('主要') || r.includes('关键')) return 'major'
  if (r.includes('龙套') || r.includes('路人') || r.includes('背景')) return 'minor'
  return 'supporting'
}

function extractDraftChanges(raw: string, chapterIndex: number) {
  try {
    // Try to find character change annotations in the draft
    const annotationMatch = raw.match(/\[角色变化\]([\s\S]*?)\[\/角色变化\]/)
    if (!annotationMatch) return
    const parsed = JSON.parse(annotationMatch[1]!)
    if (!parsed) return

    const project = useNovelStore.getState().projects.find(
      (p) => p.id === useNovelStore.getState().activeProjectId
    )
    if (!project) return

    const existingChars = project.characters
    const existingRels = project.relationships
    const charNameMap = new Map(existingChars.map((c) => [c.name, c]))

    // Process character changes
    if (parsed.characterChanges && Array.isArray(parsed.characterChanges)) {
      for (const change of parsed.characterChanges as DraftCharChange[]) {
        if (!change.name || !change.changes) continue
        if (change.type === 'new_character') {
          if (!charNameMap.has(change.name)) {
            addCharacter(createCharacter({
              name: change.name,
              weight: change.changes.role ? parseRoleToWeight(change.changes.role) : 'supporting',
              age: change.changes.age || '',
              personality: change.changes.personality || '',
              abilities: change.changes.abilities || [],
              basicInfo: change.changes.description || '',
            }))
          }
        } else if (change.type === 'status_update') {
          const existing = charNameMap.get(change.name)
          if (existing) {
            const updates: Partial<import('@/types').Character> = {}
            const c = change.changes
            if (c.age) updates.age = c.age
            if (c.personality) updates.personality = c.personality
            if (c.abilities && c.abilities.length > 0) updates.abilities = c.abilities
            if (c.basicInfo) updates.basicInfo = c.basicInfo
            if (c.location) updates.locationTrajectory = [...(existing.locationTrajectory || []), c.location]
            if (c.status === 'dead' || c.status === 'alive') updates.lifeStatus = c.status as 'alive' | 'dead'
            updates.lastAppearance = chapterIndex
            if (Object.keys(updates).length > 0) updateCharacter(existing.id, updates)
          }
        }
      }
    }

    // Process relationship changes
    if (parsed.relationshipChanges && Array.isArray(parsed.relationshipChanges)) {
      for (const rc of parsed.relationshipChanges as DraftRelChange[]) {
        if (!rc.from || !rc.to) continue
        if (rc.action === 'add') {
          const relType = REL_TYPE_MAP[rc.type] || '其他'
          const exists = existingRels.find(
            (r) => (r.from === rc.from && r.to === rc.to) || (r.from === rc.to && r.to === rc.from)
          )
          if (!exists) {
            addRelationship({ from: rc.from, to: rc.to, type: relType, description: rc.description || '' })
          }
        }
      }
    }
  } catch {
    // Silently ignore
  }
}

async function extractChapterMeta(
  chapterIndex: number,
  chapterContent: string,
  getActiveConfig: () => import('@/types').LLMConfig | undefined,
) {
  const config = getActiveConfig()
  if (!config) return

  const project = useNovelStore.getState().projects.find(
    (p) => p.id === useNovelStore.getState().activeProjectId
  )
  if (!project) return

  const existingFs = project.foreshadowings.map((f) => ({
    id: f.id,
    type: f.type,
    content: f.content,
    status: f.status,
  }))

  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: extractChapterMetaPrompt(chapterIndex, chapterContent, existingFs) },
  ]

  try {
    const { chat } = await import('@/services/llm')
    const result = await chat(config, messages)

    const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/)
    const rawJson = jsonMatch?.[1] ?? result.content
    const parsed = JSON.parse(rawJson)

    // Write summary and timeline
    const metaUpdates: Partial<import('@/types').ChapterMeta> = {}
    if (parsed.summary && typeof parsed.summary === 'string') {
      metaUpdates.summary = parsed.summary
    }
    if (parsed.timeline && typeof parsed.timeline === 'string') {
      metaUpdates.timeline = parsed.timeline
    }
    if (Object.keys(metaUpdates).length > 0) {
      updateChapterMeta(chapterIndex, metaUpdates)
    }

    // Add new foreshadowings
    if (Array.isArray(parsed.foreshadowingPlanted)) {
      for (const fs of parsed.foreshadowingPlanted) {
        if (!fs.content) continue
        const fsType = FS_TYPE_MAP[fs.type] || 'SF'
        const newFs: Foreshadowing = {
          id: generateFsId(),
          type: fsType,
          content: fs.content,
          status: 'planted',
          plantedChapter: chapterIndex,
          priority: 'medium',
        }
        addForeshadowing(newFs)
      }
    }

    // Resolve existing foreshadowings
    if (Array.isArray(parsed.foreshadowingResolved)) {
      for (const resolvedContent of parsed.foreshadowingResolved) {
        if (typeof resolvedContent !== 'string') continue
        // Fuzzy match by content similarity
        const match = project.foreshadowings.find(
          (f) => f.status === 'planted' && (
            f.content === resolvedContent ||
            f.content.includes(resolvedContent) ||
            resolvedContent.includes(f.content)
          )
        )
        if (match) {
          resolveForeshadowing(match.id, chapterIndex)
        }
      }
    }

    // Update running summary
    const chapterSummary = parsed.summary && typeof parsed.summary === 'string' ? parsed.summary : ''
    if (chapterSummary) {
      try {
        const { chat } = await import('@/services/llm')
        const currentProject = useNovelStore.getState().projects.find(
          (p) => p.id === useNovelStore.getState().activeProjectId
        )
        const oldSummary = currentProject?.runningSummary || ''
        const summaryMessages: Message[] = [
          { role: 'system', content: '你是一个小说剧情整理助手。请用中文回答。' },
          { role: 'user', content: updateRunningSummaryPrompt(oldSummary, chapterSummary, chapterIndex) },
        ]
        const summaryResult = await chat(config, summaryMessages)
        const newSummary = summaryResult.content.trim()
        if (newSummary) {
          useNovelStore.getState().setRunningSummary(
            useNovelStore.getState().activeProjectId!,
            newSummary,
          )
          // Save snapshot in chapterMeta
          updateChapterMeta(chapterIndex, { runningSummarySnapshot: newSummary })
        }
      } catch {
        // Silently ignore running summary update failures
      }
    }
  } catch {
    // Silently ignore extraction failures
  }
}

export function StepDraft() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setChapterContent = useNovelStore((s) => s.setChapterContent)
  const setChapterStatus = useNovelStore((s) => s.setChapterStatus)
  const setCurrentChapter = useNovelStore((s) => s.setCurrentChapter)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const addToast = useUIStore((s) => s.addToast)
  const genres = useUIStore((s) => s.genres)
  const { generate, isStreaming, stopGeneration, getConfig } = useGeneration()
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const chapterIdx = project.currentChapterIndex
  const savedContent = project.chapters[chapterIdx]
  const displayContent = streamingContent || savedContent
  const wordCount = displayContent?.length ?? 0
  const targetWords = project.params.wordsPerChapter

  const handleGenerate = async (chapterIndex?: number) => {
    const idx = chapterIndex ?? chapterIdx
    if (!project.blueprint || !activeProjectId) return

    // Restore snapshot if rewriting (chapter already has content)
    if (project.chapters[idx]) {
      const snapshotIdx = idx === 0 ? 0 : idx
      const restored = restoreCharacterSnapshot(snapshotIdx)
      // If no snapshot exists, save current state as the snapshot now
      if (!restored) {
        saveCharacterSnapshot(snapshotIdx)
      }
    }

    // Re-read project after potential snapshot restore
    const currentProject = useNovelStore.getState().projects.find((p) => p.id === activeProjectId)!
    const prevChapter = idx > 0 ? currentProject.chapters[idx - 1] : undefined

    // Build context package for continuity
    const draftCtx: DraftContext = {}
    if (idx > 0 && currentProject.chapterMetas?.[idx - 1]) {
      draftCtx.prevChapterSummary = currentProject.chapterMetas[idx - 1]!.summary
    }
    // Running summary — use snapshot from the chapter just before this one
    const runningSnap = idx > 0
      ? currentProject.chapterMetas?.[idx - 1]?.runningSummarySnapshot
      : undefined
    if (runningSnap) {
      draftCtx.runningSummary = runningSnap
    }
    // Recent 10 chapter summaries
    const recentStart = Math.max(0, idx - 10)
    const recent = []
    for (let i = recentStart; i < idx; i++) {
      const meta = currentProject.chapterMetas[i]
      if (meta?.summary) recent.push({ index: i, summary: meta.summary })
    }
    if (recent.length > 0) draftCtx.recentSummaries = recent
    // Previous 2 chapter endings (last 500 chars each)
    const endings = []
    for (let i = Math.max(0, idx - 2); i < idx; i++) {
      const ch = currentProject.chapters[i]
      if (ch && ch.length > 0) endings.push({ index: i, ending: ch.slice(-500) })
    }
    if (endings.length > 0) draftCtx.prevChapterEndings = endings
    // Active characters: appeared in last 3 chapters or protagonist
    const recentChars = currentProject.characters.filter(
      (c) => c.weight === 'protagonist' || (c.lastAppearance >= 0 && c.lastAppearance >= idx - 3)
    )
    if (recentChars.length > 0) {
      draftCtx.activeCharacters = recentChars.map((c) => ({
        name: c.name,
        status: c.lifeStatus === 'alive' ? '存活' : c.lifeStatus === 'dead' ? '已死亡' : '未知',
        location: c.locationTrajectory.length > 0 ? c.locationTrajectory[c.locationTrajectory.length - 1]! : '未知',
        emotion: c.emotionalArc || '正常',
      }))
    }
    // Open foreshadowing
    const openFs = currentProject.foreshadowings.filter((f) => f.status === 'planted')
    if (openFs.length > 0) {
      draftCtx.openForeshadowing = openFs.map((f) => ({ type: f.type, content: f.content }))
    }
    // Timeline
    if (idx > 0 && currentProject.chapterMetas?.[idx - 1]?.timeline) {
      draftCtx.currentTime = currentProject.chapterMetas[idx - 1]!.timeline
    }
    // User hint from previous chapter's finalize
    if (currentProject.nextChapterHints?.[idx - 1]) {
      draftCtx.nextChapterHint = currentProject.nextChapterHints[idx - 1]
    }

    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: draftPrompt(
          currentProject.params,
          currentProject.blueprint,
          idx,
          prevChapter,
          draftCtx,
          genres,
          currentProject.characters.map((c) => ({
            name: c.name,
            weight: c.weight,
            age: c.age,
            personality: c.personality,
            abilities: c.abilities,
            basicInfo: c.basicInfo,
          })),
          currentProject.relationships.map((r) => ({
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
        setChapterContent(activeProjectId, idx, content)
        setChapterStatus(activeProjectId, idx, 'draft')
        // Extract character changes from draft
        extractDraftChanges(content, idx)
        // Save snapshot for the next chapter
        if (idx + 1 < currentProject.params.chapterCount) {
          saveCharacterSnapshot(idx + 1)
        }
        // Extract meta (summary, timeline, foreshadowing) in background
        extractChapterMeta(idx, content, getConfig)
      }
    })
  }

  const handleBatchGenerate = async () => {
    if (!activeProjectId || !project.blueprint) return

    const total = project.params.chapterCount
    addToast('info', `开始批量生成 ${total} 章...`)
    setBatchProgress({ current: 0, total })

    for (let i = 0; i < total; i++) {
      if (!project.chapters[i]) {
        setBatchProgress({ current: i + 1, total })
        setCurrentChapter(activeProjectId, i)

        try {
          await handleGenerate(i)
        } catch {
          addToast('warning', `第 ${i + 1} 章生成失败，已跳过`)
          continue
        }
      }
    }

    setBatchProgress(null)
    addToast('success', '批量生成完成')
    setCurrentChapter(activeProjectId, 0)
  }

  const handlePrevChapter = () => {
    if (!activeProjectId || chapterIdx <= 0) return
    useSessionStore.getState().clearContent()
    setCurrentChapter(activeProjectId, chapterIdx - 1)
  }

  const handleNextChapter = () => {
    if (!activeProjectId || chapterIdx >= project.params.chapterCount - 1) return
    useSessionStore.getState().clearContent()
    setCurrentChapter(activeProjectId, chapterIdx + 1)
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {/* Chapter navigation bar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border-separator)]">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevChapter}
            disabled={chapterIdx === 0 || isStreaming}
            icon={<span className="material-symbols-outlined text-sm">chevron_left</span>}
          >
            上一章
          </Button>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            第 {chapterIdx + 1} / {project.params.chapterCount} 章
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextChapter}
            disabled={chapterIdx >= project.params.chapterCount - 1 || isStreaming}
            icon={<span className="material-symbols-outlined text-sm">chevron_right</span>}
          >
            下一章
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {displayContent && (
            <span className={`text-xs ${wordCount >= targetWords * 0.8 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-tertiary)]'}`}>
              {wordCount.toLocaleString()} / {targetWords.toLocaleString()} 字
            </span>
          )}
          {batchProgress && (
            <span className="text-xs text-[var(--color-primary)]">
              批量: {batchProgress.current}/{batchProgress.total}
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
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleGenerate()}
                disabled={!project.blueprint}
                icon={<span className="material-symbols-outlined text-base">edit_note</span>}
              >
                {savedContent ? '重新生成' : '生成草稿'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBatchGenerate}
                disabled={!project.blueprint}
                icon={<span className="material-symbols-outlined text-base">playlist_add</span>}
              >
                批量生成
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
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
                  正在生成第 {chapterIdx + 1} 章草稿...
                </p>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-[var(--color-text-tertiary)]">
                  edit_note
                </span>
                <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
                  草稿生成
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                  {project.blueprint
                    ? '点击"生成草稿"开始生成章节内容，或"批量生成"一次性生成全部'
                    : '请先完成"章节目录"步骤'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
