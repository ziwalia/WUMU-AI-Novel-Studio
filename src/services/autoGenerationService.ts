import { useNovelStore } from '@/stores/novelStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { useLLMStore } from '@/stores/llmStore'
import { createCharacter, addCharacter, updateCharacter, addRelationship, updateRelationship, addForeshadowing, resolveForeshadowing, updateChapterMeta, saveCharacterSnapshot, restoreCharacterSnapshot } from '@/stores/characterStore'
import { parseJsonFromLLM } from '@/lib/extractJson'
import { chatStream, chat } from '@/services/llm'
import { extractArchData } from '@/services/extractArchData'
import { extractOutlineData } from '@/services/extractOutlineData'
import {
  buildSystemPrompt,
  architecturePrompt,
  novelOutlinePrompt,
  blueprintPrompt,
  blueprintDedupPrompt,
  blueprintDedupRewritePrompt,
  draftPrompt,
  reviewPrompt,
  rewritePrompt,
  extractChapterMetaPrompt,
  type DraftContext,
} from '@/services/prompts'
import type { Message, Character, CharacterWeight, RelationshipType, LLMConfig } from '@/types'

export interface AutoGenConfig {
  reviewRounds: number
}

let aborted = false

export function isAutoAborted() {
  return aborted
}

export function resetAutoAbort() {
  aborted = false
}

function getProject() {
  const { activeProjectId, projects } = useNovelStore.getState()
  if (!activeProjectId) return null
  return projects.find((p) => p.id === activeProjectId) ?? null
}

function getConfig(): LLMConfig | undefined {
  const store = useLLMStore.getState()
  let config = store.getActiveConfig()
  if (!config && store.configs.length > 0) {
    config = store.configs[0]!
    store.setActiveConfig(config.id)
  }
  return config
}

async function streamGenerate(messages: Message[], onChunk?: (text: string) => void): Promise<string> {
  const config = getConfig()
  if (!config) throw new Error('请先配置 AI 模型')

  const controller = new AbortController()
  const session = useSessionStore.getState()
  session.startGeneration()
  useUIStore.getState().addToast('info', '正在生成...')

  let accumulated = ''
  try {
    const result = await chatStream(
      config,
      messages,
      (chunk) => {
        accumulated += chunk
        session.appendContent(chunk)
        onChunk?.(chunk)
      },
      controller.signal,
    )
    session.setStreaming(false)
    session.setTokenUsage(result.usage.inputTokens, result.usage.outputTokens)
    return result.content
  } catch (err: unknown) {
    session.setStreaming(false)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return accumulated
    }
    throw err
  }
}

function checkAbort() {
  if (aborted) throw new Error('AUTO_ABORTED')
}

function switchStep(step: string) {
  const { activeProjectId } = useNovelStore.getState()
  if (activeProjectId) {
    useSessionStore.getState().clearContent()
    useNovelStore.getState().setCurrentStep(activeProjectId, step as Message['role'] as never)
  }
}

// --- Extract helpers for per-chapter character changes ---

function ensureAbilities(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string' && v) return v.split(/[,、，]/).map((s) => s.trim()).filter(Boolean)
  return []
}

function parseRoleToWeight(role?: string): CharacterWeight {
  if (!role) return 'supporting'
  const r = role.toLowerCase()
  if (r.includes('主角') || r.includes('主人公') || r.includes('女主') || r.includes('男主角')) return 'protagonist'
  if (r.includes('重要') || r.includes('主要') || r.includes('核心')) return 'major'
  return 'supporting'
}

const REL_TYPE_MAP: Record<string, RelationshipType> = {
  '师徒': '师徒', '夫妻': '亲人', '情侣': '恋人', '父子': '亲人', '父女': '亲人',
  '母子': '亲人', '母女': '亲人', '兄弟': '亲人', '姐妹': '亲人', '朋友': '朋友',
  '盟友': '盟友', '对手': '敌对', '仇敌': '敌对', '主仆': '其他', '同门': '同门',
}

async function extractChapterMeta(chapterIndex: number, chapterContent: string) {
  const config = getConfig()
  if (!config) return
  const project = getProject()
  if (!project) return

  const existingFs = project.foreshadowings.map((f) => ({
    id: f.id, type: f.type, content: f.content, status: f.status,
  }))

  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: extractChapterMetaPrompt(chapterIndex, chapterContent, existingFs) },
  ]

  try {
    const result = await chat(config, messages)
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
    if (Object.keys(metaUpdates).length > 0) updateChapterMeta(chapterIndex, metaUpdates)

    // Apply character and relationship changes
    if (Array.isArray(parsed.characterChanges) || Array.isArray(parsed.relationshipChanges)) {
      const charNameMap = new Map(project.characters.map((c) => [c.name, c]))
      for (const change of (Array.isArray(parsed.characterChanges) ? parsed.characterChanges : []) as { name: string; type: string; changes: Record<string, unknown> }[]) {
        if (!change.name || !change.changes) continue
        if (change.type === 'new_character') {
          if (!charNameMap.has(change.name)) {
            const nc = createCharacter({
              name: change.name,
              weight: parseRoleToWeight(change.changes.role as string),
              age: (change.changes.age as string) || '',
              personality: (change.changes.personality as string) || '',
              abilities: ensureAbilities(change.changes.abilities),
              basicInfo: (change.changes.description as string) || '',
            })
            addCharacter(nc)
            charNameMap.set(change.name, nc)
          }
        } else if (change.type === 'status_update') {
          const existing = charNameMap.get(change.name)
          if (existing) {
            const updates: Partial<Character> = { lastAppearance: chapterIndex }
            const c = change.changes
            if (c.age) updates.age = c.age as string
            if (c.personality) updates.personality = c.personality as string
            if (c.abilities) { const abs = ensureAbilities(c.abilities); if (abs.length > 0) updates.abilities = abs }
            if (c.basicInfo) updates.basicInfo = c.basicInfo as string
            if (c.location) updates.locationTrajectory = [...(existing.locationTrajectory || []), c.location as string]
            if (c.status === 'dead' || c.status === 'alive') updates.lifeStatus = c.status as 'alive' | 'dead'
            if (Object.keys(updates).length > 1) updateCharacter(existing.id, updates)
          }
        }
      }
      for (const rc of (Array.isArray(parsed.relationshipChanges) ? parsed.relationshipChanges : []) as { from: string; to: string; action: string; type: string; description?: string }[]) {
        if (!rc.from || !rc.to) continue
        const relType = REL_TYPE_MAP[rc.type] || ('其他' as RelationshipType)
        if (rc.action === 'add') {
          const exists = project.relationships.find(
            (r) => (r.from === rc.from && r.to === rc.to) || (r.from === rc.to && r.to === rc.from),
          )
          if (!exists) addRelationship({ from: rc.from, to: rc.to, type: relType, description: rc.description || '' })
        } else if (rc.action === 'change') {
          const existing = project.relationships.find(
            (r) => (r.from === rc.from && r.to === rc.to) || (r.from === rc.to && r.to === rc.from),
          )
          if (existing) updateRelationship(existing.id, { type: relType, ...(rc.description ? { description: rc.description } : {}) })
        }
      }
    }

    if (Array.isArray(parsed.foreshadowingPlanted)) {
      for (const fs of parsed.foreshadowingPlanted as { type?: string; content?: string }[]) {
        if (!fs.content) continue
        addForeshadowing({
          id: `fs-auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          type: (fs.type as import('@/types').ForeshadowingType) || 'SF',
          content: fs.content,
          status: 'planted',
          plantedChapter: chapterIndex,
          resolvedChapter: -1,
          priority: 'medium',
        })
      }
    }
    if (Array.isArray(parsed.foreshadowingResolved)) {
      for (const resolvedContent of parsed.foreshadowingResolved) {
        if (typeof resolvedContent !== 'string') continue
        const match = project.foreshadowings.find(
          (f) => f.status === 'planted' && (
            f.content === resolvedContent ||
            f.content.includes(resolvedContent) ||
            resolvedContent.includes(f.content)
          ),
        )
        if (match) resolveForeshadowing(match.id, chapterIndex)
      }
    }

    // Auto-update runningSummary: concatenate all chapter summaries up to this point
    if (parsed.summary && typeof parsed.summary === 'string') {
      const p = getProject()
      const aid = useNovelStore.getState().activeProjectId
      if (p && aid) {
        const parts: string[] = []
        for (let i = 0; i <= chapterIndex; i++) {
          const meta = i === chapterIndex
            ? { ...p.chapterMetas[i], summary: parsed.summary as string }
            : p.chapterMetas[i]
          if (meta?.summary) parts.push(`第${i + 1}章：${meta.summary}`)
        }
        const newRunning = parts.join('\n')
        useNovelStore.getState().setRunningSummary(aid, newRunning)
        updateChapterMeta(chapterIndex, { runningSummarySnapshot: newRunning })
      }
    }
  } catch {
    // silently ignore
  }
}


// --- Full review is handled by UI (FullReviewDialog) via autoFullReviewPending flag ---

// --- Main auto-generation orchestrator ---

export async function runAutoGeneration(autoConfig: AutoGenConfig): Promise<void> {
  aborted = false
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) throw new Error('没有活跃项目')

  const addToast = useUIStore.getState().addToast
  const setDedupStatus = useUIStore.getState().setDedupStatus
  const genres = useUIStore.getState().genres

  // Step 1: Architecture
  checkAbort()
  switchStep('architecture')
  addToast('info', '正在生成小说架构...')
  {
    const project = getProject()!
    const chars = project.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo }))
    const rels = project.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description }))
    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: architecturePrompt(project.params, genres, chars.length > 0 ? chars : undefined, rels.length > 0 ? rels : undefined) },
    ]
    const content = await streamGenerate(messages)
    useNovelStore.getState().setArchitecture(activeProjectId, content)
    extractArchData(content)
  }

  // Step 2: Novel Outline
  checkAbort()
  switchStep('outline')
  addToast('info', '正在生成小说大纲...')
  {
    const project = getProject()!
    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: novelOutlinePrompt(
          project.params,
          project.architecture,
          genres,
          project.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo })),
          project.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description })),
        ),
      },
    ]
    const content = await streamGenerate(messages)
    useNovelStore.getState().setNovelOutline(activeProjectId, content)
    extractOutlineData(content)
  }

  // Step 3: Blueprint
  checkAbort()
  switchStep('blueprint')
  addToast('info', '正在生成章节目录...')
  {
    const project = getProject()!
    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: blueprintPrompt(
          project.params,
          project.novelOutline,
          genres,
          project.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo })),
          project.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description })),
        ),
      },
    ]
    const content = await streamGenerate(messages)
    // Normalize blueprint: extract clean JSON before storing
    const bpClean = parseJsonFromLLM<{ chapterIndex: number; title: string; summary: string }[]>(content)
    const blueprintToStore = bpClean ? JSON.stringify(bpClean, null, 2) : content
    useNovelStore.getState().setBlueprint(activeProjectId, blueprintToStore)
    extractOutlineData(blueprintToStore)
    saveCharacterSnapshot(0)

    // Auto dedup check + rewrite loop (max 5 rounds)
    const MAX_DEDUP_ROUNDS = 5
    for (let round = 0; round < MAX_DEDUP_ROUNDS; round++) {
      checkAbort()
      const bpProject = getProject()!
      const bpRaw = bpProject.blueprint
      const bpParsed = parseJsonFromLLM<{ chapterIndex: number; title: string; summary: string }[]>(bpRaw)
      console.log(`[AutoGen] Dedup round ${round + 1}, bpRaw length: ${bpRaw.length}, bpParsed:`, bpParsed ? `ok (${bpParsed.length} chapters)` : 'null')
      if (!bpParsed || bpParsed.length < 2) {
        console.warn('[AutoGen] Blueprint parse failed or too few chapters, skipping dedup loop. Raw preview:', bpRaw.slice(0, 200))
        break
      }

      addToast('info', `去重检测中（第${round + 1}轮）...`)
      setDedupStatus(`🔍 第${round + 1}轮检测中...`)
      const config = useLLMStore.getState().getActiveConfig()
      if (!config) break

      // Run dedup check
      const dedupMsgs: Message[] = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: blueprintDedupPrompt(bpParsed) },
      ]
      const dedupResult = await chat(config, dedupMsgs)
      const dedup = parseJsonFromLLM<{ duplicateGroups: { chapters: number[]; reason: string; suggestion: string }[]; overallScore: number; summary: string }>(dedupResult.content)
      if (!dedup || dedup.overallScore >= 9 || dedup.duplicateGroups.length === 0) {
        if (dedup && dedup.overallScore >= 9) {
          addToast('success', `去重检测通过（${dedup.overallScore}/10）`)
          setDedupStatus(`✅ 检测通过（${dedup.overallScore}/10）`)
        }
        break
      }

      addToast('info', `去重评分 ${dedup.overallScore}/10，自动重写雷同章节中...`)
      setDedupStatus(`⚠️ 评分 ${dedup.overallScore}/10，正在重写...`)

      // Compute explicit rewrite targets: keep first chapter per group, rewrite the rest
      const bpChapterMap = new Map(bpParsed.map((c) => [c.chapterIndex, c]))
      const bpTargets: { chapterIndex: number; currentTitle: string; currentSummary: string; reason: string; suggestion: string }[] = []
      for (const group of dedup.duplicateGroups) {
        const sorted = [...group.chapters].sort((a, b) => a - b)
        for (let gi = 1; gi < sorted.length; gi++) {
          const chNum = sorted[gi]!
          const idx = chNum - 1
          const existing = bpChapterMap.get(idx)
          if (existing) {
            bpTargets.push({
              chapterIndex: idx,
              currentTitle: existing.title,
              currentSummary: existing.summary,
              reason: group.reason,
              suggestion: group.suggestion,
            })
          }
        }
      }
      if (bpTargets.length === 0) break

      // Rewrite duplicates
      const rewriteMsgs: Message[] = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: blueprintDedupRewritePrompt(bpParsed, bpTargets) },
      ]
      const rewriteResult = await chat(config, rewriteMsgs)
      const rewrites = parseJsonFromLLM<{ chapterIndex: number; title: string; summary: string }[]>(rewriteResult.content)
      if (!rewrites || !Array.isArray(rewrites) || rewrites.length === 0) break

      // Apply rewrites only to target chapters, reject duplicate titles
      const rewriteMap = new Map(rewrites.map((r) => [r.chapterIndex, r]))
      const existingTitles = new Set(bpParsed.map((c) => c.title))
      for (const target of bpTargets) {
        const rw = rewriteMap.get(target.chapterIndex) || rewriteMap.get(target.chapterIndex + 1)
        if (!rw?.title || !rw.summary) continue
        if (existingTitles.has(rw.title) && rw.title !== target.currentTitle) continue
        const ch = bpParsed.find((c) => c.chapterIndex === target.chapterIndex)
        if (ch) {
          existingTitles.delete(ch.title)
          ch.title = rw.title
          ch.summary = rw.summary
          existingTitles.add(rw.title)
        }
      }

      const newBlueprint = JSON.stringify(bpParsed, null, 2)
      useNovelStore.getState().setBlueprint(activeProjectId, newBlueprint)
      extractOutlineData(newBlueprint)

      // Final check on last round
      if (round === MAX_DEDUP_ROUNDS - 1) {
        addToast('warning', `去重重写已达${MAX_DEDUP_ROUNDS}轮上限，继续生成`)
        setDedupStatus(`⚠️ 已达${MAX_DEDUP_ROUNDS}轮上限，继续生成`)
      }
    }
  }

  // Steps 4-7: Per-chapter loop (Draft → Review × N → Rewrite × N → Finalize)
  setDedupStatus(null)
  const project = getProject()!
  const totalChapters = project.params.chapterCount

  // Resume from checkpoint: skip already-finalized chapters
  const savedProgress = useUIStore.getState().autoProgress
  let startChapter = 0
  if (savedProgress && savedProgress.chapterIdx > 0) {
    const latestProject = getProject()!
    // Check if earlier chapters are already finalized
    let canResume = true
    for (let i = 0; i < savedProgress.chapterIdx; i++) {
      if (!latestProject.chapters[i] || latestProject.chapterStatuses[i] !== 'finalized') {
        canResume = false
        break
      }
    }
    if (canResume) {
      startChapter = savedProgress.chapterIdx
      addToast('info', `从第 ${startChapter + 1} 章断点续传...`)
    } else {
      addToast('info', '前置章节不完整，从头开始生成')
    }
    useUIStore.getState().setAutoProgress(null)
  }

  for (let chapterIdx = startChapter; chapterIdx < totalChapters; chapterIdx++) {
    checkAbort()

    // Save checkpoint before each chapter
    useUIStore.getState().setAutoProgress({ chapterIdx, phase: 'draft' })

    // Switch to chapter
    useNovelStore.getState().setCurrentChapter(activeProjectId, chapterIdx)
    switchStep('draft')
    addToast('info', `正在生成第 ${chapterIdx + 1}/${totalChapters} 章草稿...`)

    // Restore snapshot if rewriting
    const currentProj = getProject()!
    if (currentProj.chapters[chapterIdx]) {
      const restored = restoreCharacterSnapshot(chapterIdx)
      if (!restored) saveCharacterSnapshot(chapterIdx)
    }

    // Generate draft
    {
      const p = getProject()!
      const prevChapter = chapterIdx > 0 ? p.chapters[chapterIdx - 1] : undefined

      const draftCtx: DraftContext = {}
      if (chapterIdx > 0 && p.chapterMetas?.[chapterIdx - 1]) {
        draftCtx.prevChapterSummary = p.chapterMetas[chapterIdx - 1]!.summary
      }
      const runningSnap = chapterIdx > 0 ? p.chapterMetas?.[chapterIdx - 1]?.runningSummarySnapshot : undefined
      if (runningSnap) draftCtx.runningSummary = runningSnap

      const recentStart = Math.max(0, chapterIdx - 10)
      const recent = []
      for (let i = recentStart; i < chapterIdx; i++) {
        const meta = p.chapterMetas[i]
        if (meta?.summary) recent.push({ index: i, summary: meta.summary })
      }
      if (recent.length > 0) draftCtx.recentSummaries = recent

      const endings = []
      for (let i = Math.max(0, chapterIdx - 2); i < chapterIdx; i++) {
        const ch = p.chapters[i]
        if (ch && ch.length > 0) endings.push({ index: i, ending: ch.slice(-500) })
      }
      if (endings.length > 0) draftCtx.prevChapterEndings = endings

      // Full text of previous 2 chapters
      if (chapterIdx > 0 && p.chapters[chapterIdx - 1]) {
        draftCtx.prevFullChapter = p.chapters[chapterIdx - 1]
      }
      if (chapterIdx > 1 && p.chapters[chapterIdx - 2]) {
        draftCtx.prevPrevFullChapter = p.chapters[chapterIdx - 2]
      }

      // Recent scene types (last 5 chapters, skip for first chapter)
      if (chapterIdx > 0) {
        const sceneInfo = []
        for (let i = Math.max(0, chapterIdx - 5); i < chapterIdx; i++) {
          const meta = p.chapterMetas[i]
          if (meta?.sceneTypes && meta.sceneTypes.length > 0) {
            sceneInfo.push({
              chapterIndex: i,
              sceneTypes: meta.sceneTypes,
              pacingTag: meta.pacingTag || 'transition',
              emotionIntensity: meta.emotionIntensity || 'medium',
            })
          }
        }
        if (sceneInfo.length > 0) draftCtx.recentSceneTypes = sceneInfo
      }

      const recentChars = p.characters.filter(
        (c) => c.weight === 'protagonist' || (c.lastAppearance >= 0 && c.lastAppearance >= chapterIdx - 3)
      )
      if (recentChars.length > 0) {
        draftCtx.activeCharacters = recentChars.map((c) => {
          const loc = (c.locationTrajectory || [])
          return {
            name: c.name,
            status: c.lifeStatus === 'alive' ? '存活' : c.lifeStatus === 'dead' ? '已死亡' : '未知',
            location: loc.length > 0 ? loc[loc.length - 1]! : '未知',
            emotion: c.emotionalArc || '正常',
          }
        })
      }

      const openFs = p.foreshadowings.filter((f) => f.status === 'planted')
      if (openFs.length > 0) {
        draftCtx.openForeshadowing = openFs.map((f) => ({ type: f.type, content: f.content }))
      }

      if (chapterIdx > 0 && p.chapterMetas?.[chapterIdx - 1]?.timeline) {
        draftCtx.currentTime = p.chapterMetas[chapterIdx - 1]!.timeline
      }

      if (p.nextChapterHints?.[chapterIdx - 1]) {
        draftCtx.nextChapterHint = p.nextChapterHints[chapterIdx - 1]
      }

      const messages: Message[] = [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: draftPrompt(
            p.params,
            p.blueprint,
            chapterIdx,
            prevChapter,
            draftCtx,
            genres,
            p.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo })),
            p.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description })),
          ),
        },
      ]

      const content = await streamGenerate(messages)
      useNovelStore.getState().setChapterContent(activeProjectId, chapterIdx, content)
      useNovelStore.getState().setChapterStatus(activeProjectId, chapterIdx, 'draft')
      saveCharacterSnapshot(chapterIdx)
      if (chapterIdx + 1 < totalChapters) saveCharacterSnapshot(chapterIdx + 1)
      // Background meta extraction (don't await to speed up)
      extractChapterMeta(chapterIdx, content)
    }

    // Review + Rewrite loops
    for (let round = 0; round < autoConfig.reviewRounds; round++) {
      checkAbort()

      // Review
      switchStep('review')
      addToast('info', `第 ${chapterIdx + 1} 章第 ${round + 1} 次审校...`)
      {
        const p = getProject()!
        const chapterContent = p.chapters[chapterIdx]
        if (!chapterContent) break

        useNovelStore.getState().incrementReviewRound(activeProjectId, chapterIdx)

        const openFs = p.foreshadowings
          .filter((f) => f.status === 'planted')
          .map((f) => `[${f.type}] 第${f.plantedChapter + 1}章埋: ${f.content}`)
          .join('\n')

        // Full character data with status and location
        const charSummary = p.characters.length > 0
          ? p.characters.map((c) => {
              const status = c.lifeStatus === 'dead' ? '【已死亡】' : c.lifeStatus === 'alive' ? '【存活】' : ''
              const cLoc = (c.locationTrajectory || [])
              const loc = cLoc.length > 0 ? `当前位置：${cLoc[cLoc.length - 1]}` : ''
              return `- ${c.name}（${c.weight}）${status}：年龄${c.age || '未知'}，性格：${c.personality || '未知'}，能力：${(c.abilities || []).join('、') || '无'}。${c.basicInfo || ''}${loc ? '，' + loc : ''}`
            }).join('\n')
          : p.params.coreCharacters

        const relSummary = p.relationships.length > 0
          ? p.relationships.map((r) => `- ${r.from} ←${r.type}→ ${r.to}${r.description ? `：${r.description}` : ''}`).join('\n')
          : undefined

        // Blueprint chapter for plan-checking
        let blueprintChapter: { title: string; summary: string } | undefined
        if (p.blueprint) {
          try {
            const bp = JSON.parse(p.blueprint)
            if (Array.isArray(bp)) {
              const ch = bp.find((c: Record<string, unknown>) => c.chapterIndex === chapterIdx)
              if (ch) blueprintChapter = { title: String(ch.title), summary: String(ch.summary) }
            }
          } catch { /* ignore */ }
        }

        const continuityContext: Parameters<typeof reviewPrompt>[3] = {}
        const reviewSnap = chapterIdx > 0 ? p.chapterMetas?.[chapterIdx - 1]?.runningSummarySnapshot : undefined
        if (reviewSnap) continuityContext.runningSummary = reviewSnap
        const recentStart = Math.max(0, chapterIdx - 10)
        const recent = []
        for (let i = recentStart; i < chapterIdx; i++) {
          const meta = p.chapterMetas[i]
          if (meta?.summary) recent.push({ index: i, summary: meta.summary })
        }
        if (recent.length > 0) continuityContext.recentSummaries = recent

        const messages: Message[] = [
          { role: 'system', content: buildSystemPrompt() },
          {
            role: 'user',
            content: reviewPrompt(chapterContent, charSummary, openFs || undefined,
              Object.keys(continuityContext).length > 0 ? continuityContext : undefined,
              { blueprintChapter, relationships: relSummary }),
          },
        ]

        const content = await streamGenerate(messages)
        useNovelStore.getState().setReviewResult(activeProjectId, chapterIdx, content)

        // Quality gate: parse review score
        const reviewParsed = parseJsonFromLLM<{ overallScore: number; summary: string }>(content)
        const score = reviewParsed?.overallScore ?? 0
        if (score >= 90) {
          addToast('success', `第 ${chapterIdx + 1} 章审校评分 ${score}/100，质量优秀，跳过改写`)
          break // Skip rewrite, go to finalize
        }
        if (score >= 80) {
          addToast('info', `第 ${chapterIdx + 1} 章审校评分 ${score}/100，存在可改进之处，执行改写`)
        } else {
          addToast('warning', `第 ${chapterIdx + 1} 章审校评分 ${score}/100，质量问题较多，执行改写`)
        }
      }

      checkAbort()

      // Rewrite
      switchStep('rewrite')
      addToast('info', `第 ${chapterIdx + 1} 章第 ${round + 1} 次改写...`)
      {
        const p = getProject()!
        const originalContent = p.chapters[chapterIdx]
        const reviewResult = p.reviewResults[chapterIdx]
        if (!originalContent || !reviewResult) break

        // Build character/relationship context for rewrite
        const rewriteCharSummary = p.characters.length > 0
          ? p.characters.map((c) => {
              const status = c.lifeStatus === 'dead' ? '【已死亡】' : c.lifeStatus === 'alive' ? '【存活】' : ''
              const rLoc = (c.locationTrajectory || [])
              const loc = rLoc.length > 0 ? `当前位置：${rLoc[rLoc.length - 1]}` : ''
              return `- ${c.name}（${c.weight}）${status}：性格：${c.personality || '未知'}，能力：${(c.abilities || []).join('、') || '无'}${loc ? '，' + loc : ''}`
            }).join('\n')
          : undefined
        const rewriteRelSummary = p.relationships.length > 0
          ? p.relationships.map((r) => `- ${r.from} ←${r.type}→ ${r.to}${r.description ? `：${r.description}` : ''}`).join('\n')
          : undefined

        const messages: Message[] = [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: rewritePrompt(originalContent, reviewResult, p.params, { characters: rewriteCharSummary, relationships: rewriteRelSummary }) },
        ]

        const content = await streamGenerate(messages)
        useNovelStore.getState().setChapterContent(activeProjectId, chapterIdx, content)
        useNovelStore.getState().setChapterStatus(activeProjectId, chapterIdx, 'rewriting')
        // Re-extract meta from rewritten content (must await to ensure next chapter gets fresh data)
        await extractChapterMeta(chapterIdx, content)
      }
    }

    // Finalize this chapter
    checkAbort()
    switchStep('finalize')
    useNovelStore.getState().setChapterStatus(activeProjectId, chapterIdx, 'finalized')
    addToast('success', `第 ${chapterIdx + 1}/${totalChapters} 章已完成`)

    // Update checkpoint to next chapter
    if (chapterIdx + 1 < totalChapters) {
      useUIStore.getState().setAutoProgress({ chapterIdx: chapterIdx + 1, phase: 'draft' })
    }

    // Check unresolved foreshadowings on last chapter
    if (chapterIdx === totalChapters - 1) {
      const unresolved = getProject()?.foreshadowings.filter((f) => f.status === 'planted') ?? []
      if (unresolved.length > 0) {
        addToast('warning', `⚠ 有 ${unresolved.length} 条伏笔未收束`)
      }
    }
  }

  // Full review: trigger UI to open FullReviewDialog, then wait for it to finish
  checkAbort()
  addToast('info', '正在执行全文审核...')
  {
    // Ensure all chapters are finalized
    const p = getProject()!
    for (let i = 0; i < totalChapters; i++) {
      if (p.chapters[i]) useNovelStore.getState().setChapterStatus(activeProjectId, i, 'finalized')
    }
    switchStep('finalize')

    // Set flag to trigger FullReviewDialog to auto-open and run
    useUIStore.getState().setAutoFullReviewPending(true)

    // Poll until fullReview is written
    await new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        if (aborted) {
          clearInterval(interval)
          reject(new Error('AUTO_ABORTED'))
          return
        }
        const proj = getProject()
        if (proj?.fullReview) {
          clearInterval(interval)
          useUIStore.getState().setAutoFullReviewPending(false)
          resolve()
        }
      }, 1000)
      // Timeout after 30 minutes
      setTimeout(() => {
        clearInterval(interval)
        useUIStore.getState().setAutoFullReviewPending(false)
        reject(new Error('全文审核超时'))
      }, 30 * 60 * 1000)
    })
  }

  addToast('success', '全自动生成完成！')
  useUIStore.getState().setAutoProgress(null)
}

export function abortAutoGeneration() {
  aborted = true
  useSessionStore.getState().stopGeneration()
}
