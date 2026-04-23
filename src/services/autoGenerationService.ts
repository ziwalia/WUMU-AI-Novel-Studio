import { useNovelStore } from '@/stores/novelStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { useLLMStore } from '@/stores/llmStore'
import { setCharacters, setRelationships, createCharacter, addCharacter, updateCharacter, addRelationship, addForeshadowing, resolveForeshadowing, updateChapterMeta, saveCharacterSnapshot, restoreCharacterSnapshot } from '@/stores/characterStore'
import { chatStream, chat } from '@/services/llm'
import {
  buildSystemPrompt,
  architecturePrompt,
  volumeOutlinePrompt,
  blueprintPrompt,
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

// --- Extract helpers (simplified versions for auto mode) ---

type RawCharEntry = {
  name: string
  role?: string
  age?: string
  personality?: string
  abilities?: string[]
  description?: string
  basicInfo?: string
}

function ensureAbilities(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string' && v) return v.split(/[,、，]/).map((s) => s.trim()).filter(Boolean)
  return []
}

function parseRoleToWeight(role?: string): CharacterWeight {
  if (!role) return 'supporting'
  const r = role.toLowerCase()
  if (r.includes('主角') || r.includes('主人公')) return 'protagonist'
  if (r.includes('女主') || r.includes('男主角')) return 'protagonist'
  if (r.includes('重要') || r.includes('主要') || r.includes('核心')) return 'major'
  return 'supporting'
}

function extractCharactersFromArch(raw: string) {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
    const rawJson = jsonMatch?.[1] ?? raw
    const parsed = JSON.parse(rawJson)
    if (!parsed || typeof parsed !== 'object') return

    const charsSection = parsed.characters
    if (!charsSection) return

    let characters: Character[] = []
    if (Array.isArray(charsSection)) {
      characters = (charsSection as RawCharEntry[]).map((c) =>
        createCharacter({
          name: c.name,
          weight: parseRoleToWeight(c.role),
          age: c.age || '',
          personality: c.personality || '',
          abilities: ensureAbilities(c.abilities),
          basicInfo: c.description || c.basicInfo || '',
        })
      )
    } else if (typeof charsSection === 'object') {
      const entries = Object.entries(charsSection).map(([k, v]) => ({
        name: k,
        ...(typeof v === 'object' && v !== null ? v as Record<string, unknown> : { description: String(v) }),
      }))
      characters = (entries as RawCharEntry[]).map((c) =>
        createCharacter({
          name: c.name,
          weight: parseRoleToWeight(c.role),
          age: c.age || '',
          personality: c.personality || '',
          abilities: ensureAbilities(c.abilities),
          basicInfo: c.description || c.basicInfo || '',
        })
      )
    }

    if (characters.length > 0) setCharacters(characters)

    // Extract relationships
    const relSection = parsed.relationships
    if (relSection && Array.isArray(relSection)) {
      const names = new Set(characters.map((c) => c.name))
      if (names.size === 0) {
        const existing = getProject()
        existing?.characters.forEach((c) => names.add(c.name))
      }
      const relationships: import('@/types').CharacterRelationship[] = []
      for (const rel of relSection as Array<{ from: string; to: string; type: string; description: string }>) {
        if (rel.from && rel.to) {
          relationships.push({
            id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            from: rel.from,
            to: rel.to,
            type: REL_TYPE_MAP[rel.type] || '其他' as RelationshipType,
            description: rel.description || '',
          })
        }
      }
      if (relationships.length > 0) setRelationships(relationships)
    }
  } catch {
    // silently ignore
  }
}

type CharChange = {
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

type RelChange = {
  from: string
  to: string
  action: 'add' | 'change'
  type: string
  description: string
}

const REL_TYPE_MAP: Record<string, RelationshipType> = {
  '师徒': '师徒', '夫妻': '亲人', '情侣': '恋人', '父子': '亲人', '父女': '亲人',
  '母子': '亲人', '母女': '亲人', '兄弟': '亲人', '姐妹': '亲人', '朋友': '朋友',
  '盟友': '盟友', '对手': '敌对', '仇敌': '敌对', '主仆': '其他', '同门': '同门',
}

function extractCharChangesFromContent(raw: string, chapterIndex: number) {
  try {
    const annotationMatch = raw.match(/\[角色变化\]([\s\S]*?)\[\/角色变化\]/)
    if (!annotationMatch) return
    const parsed = JSON.parse(annotationMatch[1]!)
    if (!parsed) return

    const project = getProject()
    if (!project) return

    const existingChars = project.characters
    const existingRels = project.relationships
    const charNameMap = new Map(existingChars.map((c) => [c.name, c]))

    if (parsed.characterChanges && Array.isArray(parsed.characterChanges)) {
      for (const change of parsed.characterChanges as CharChange[]) {
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
            const updates: Partial<Character> = {}
            const c = change.changes
            if (c.age) updates.age = c.age
            if (c.personality) updates.personality = c.personality
            if (c.abilities) {
              const abs = ensureAbilities(c.abilities)
              if (abs.length > 0) updates.abilities = abs
            }
            if (c.basicInfo) updates.basicInfo = c.basicInfo
            if (c.location) updates.locationTrajectory = [...(existing.locationTrajectory || []), c.location]
            if (c.status === 'dead' || c.status === 'alive') updates.lifeStatus = c.status as 'alive' | 'dead'
            updates.lastAppearance = chapterIndex
            if (Object.keys(updates).length > 0) updateCharacter(existing.id, updates)
          }
        }
      }
    }

    if (parsed.relationshipChanges && Array.isArray(parsed.relationshipChanges)) {
      for (const rc of parsed.relationshipChanges as RelChange[]) {
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
    // silently ignore
  }
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
    const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/)
    const rawJson = jsonMatch?.[1] ?? result.content
    const parsed = JSON.parse(rawJson)

    const metaUpdates: Partial<import('@/types').ChapterMeta> = {}
    if (parsed.summary && typeof parsed.summary === 'string') metaUpdates.summary = parsed.summary
    if (parsed.timeline && typeof parsed.timeline === 'string') metaUpdates.timeline = parsed.timeline
    if (Object.keys(metaUpdates).length > 0) updateChapterMeta(chapterIndex, metaUpdates)

    if (Array.isArray(parsed.foreshadowingPlanted)) {
      for (const fs of parsed.foreshadowingPlanted) {
        addForeshadowing({
          id: `fs-auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          type: fs.type || '伏笔',
          content: fs.content || '',
          status: 'planted',
          plantedChapter: chapterIndex,
          resolvedChapter: -1,
          priority: 'medium',
        })
      }
    }
    if (Array.isArray(parsed.foreshadowingResolved)) {
      for (const fs of parsed.foreshadowingResolved) {
        if (fs.id) resolveForeshadowing(fs.id, chapterIndex)
      }
    }
  } catch {
    // silently ignore
  }
}

function extractBulkCharChanges(raw: string) {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
    const rawJson = jsonMatch?.[1] ?? raw
    const parsed = JSON.parse(rawJson)
    if (!Array.isArray(parsed)) return

    const project = getProject()
    if (!project) return

    const existingChars = project.characters
    const existingRels = project.relationships
    const charNameMap = new Map(existingChars.map((c) => [c.name, c]))
    const newChars: Character[] = []
    const charUpdates = new Map<string, Partial<Character>>()
    const newRels: import('@/types').CharacterRelationship[] = []
    let relCounter = Date.now()

    for (const entry of parsed) {
      if (entry.characterChanges && Array.isArray(entry.characterChanges)) {
        for (const change of entry.characterChanges as CharChange[]) {
          if (!change.name || !change.changes) continue
          if (change.type === 'new_character') {
            if (!charNameMap.has(change.name) && !newChars.find((c) => c.name === change.name)) {
              newChars.push(createCharacter({
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
              const prev = charUpdates.get(change.name) || {}
              const c = change.changes
              if (c.age) prev.age = c.age
              if (c.personality) prev.personality = c.personality
              if (c.abilities) {
                const abs = ensureAbilities(c.abilities)
                if (abs.length > 0) prev.abilities = abs
              }
              if (c.basicInfo) prev.basicInfo = c.basicInfo
              if (c.location) prev.locationTrajectory = [...(existing.locationTrajectory || []), c.location]
              if (c.status === 'dead' || c.status === 'alive') prev.lifeStatus = c.status as 'alive' | 'dead'
              charUpdates.set(change.name, prev)
            }
          }
        }
      }

      if (entry.relationshipChanges && Array.isArray(entry.relationshipChanges)) {
        for (const rc of entry.relationshipChanges as RelChange[]) {
          if (!rc.from || !rc.to) continue
          const relType = REL_TYPE_MAP[rc.type] || '其他'
          if (rc.action === 'add') {
            const exists = existingRels.find(
              (r) => (r.from === rc.from && r.to === rc.to) || (r.from === rc.to && r.to === rc.from)
            )
            if (!exists && !newRels.find((r) => r.from === rc.from && r.to === rc.to)) {
              newRels.push({
                id: `rel-${++relCounter}-${Math.random().toString(36).slice(2, 5)}`,
                from: rc.from, to: rc.to, type: relType, description: rc.description || '',
              })
            }
          }
        }
      }
    }

    for (const nc of newChars) addCharacter(nc)
    for (const [name, updates] of charUpdates) {
      const char = charNameMap.get(name)
      if (char) updateCharacter(char.id, updates)
    }
    for (const nr of newRels) addRelationship(nr)
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
  const genres = useUIStore.getState().genres

  // Step 1: Architecture
  checkAbort()
  switchStep('architecture')
  addToast('info', '正在生成小说架构...')
  {
    const project = getProject()!
    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: architecturePrompt(project.params, genres) },
    ]
    const content = await streamGenerate(messages)
    useNovelStore.getState().setArchitecture(activeProjectId, content)
    extractCharactersFromArch(content)
  }

  // Step 2: Volume Outline
  checkAbort()
  switchStep('volume')
  addToast('info', '正在生成分卷大纲...')
  {
    const project = getProject()!
    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: volumeOutlinePrompt(
          project.params,
          project.architecture,
          genres,
          project.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo })),
          project.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description })),
        ),
      },
    ]
    const content = await streamGenerate(messages)
    useNovelStore.getState().setVolumeOutline(activeProjectId, content)
    extractBulkCharChanges(content)
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
          project.volumeOutline,
          genres,
          project.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo })),
          project.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description })),
        ),
      },
    ]
    const content = await streamGenerate(messages)
    useNovelStore.getState().setBlueprint(activeProjectId, content)
    extractBulkCharChanges(content)
    saveCharacterSnapshot(0)
  }

  // Steps 4-7: Per-chapter loop (Draft → Review × N → Rewrite × N → Finalize)
  const project = getProject()!
  const totalChapters = project.params.chapterCount

  for (let chapterIdx = 0; chapterIdx < totalChapters; chapterIdx++) {
    checkAbort()

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

      const recentChars = p.characters.filter(
        (c) => c.weight === 'protagonist' || (c.lastAppearance >= 0 && c.lastAppearance >= chapterIdx - 3)
      )
      if (recentChars.length > 0) {
        draftCtx.activeCharacters = recentChars.map((c) => ({
          name: c.name,
          status: c.lifeStatus === 'alive' ? '存活' : c.lifeStatus === 'dead' ? '已死亡' : '未知',
          location: c.locationTrajectory.length > 0 ? c.locationTrajectory[c.locationTrajectory.length - 1]! : '未知',
          emotion: c.emotionalArc || '正常',
        }))
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
      extractCharChangesFromContent(content, chapterIdx)
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

        const charSummary = p.characters.length > 0
          ? p.characters.map((c) => `${c.name}(${c.weight}): ${c.basicInfo}`).join('\n')
          : p.params.coreCharacters

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
              Object.keys(continuityContext).length > 0 ? continuityContext : undefined),
          },
        ]

        const content = await streamGenerate(messages)
        useNovelStore.getState().setReviewResult(activeProjectId, chapterIdx, content)
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

        const messages: Message[] = [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: rewritePrompt(originalContent, reviewResult, p.params) },
        ]

        const content = await streamGenerate(messages)
        useNovelStore.getState().setChapterContent(activeProjectId, chapterIdx, content)
        useNovelStore.getState().setChapterStatus(activeProjectId, chapterIdx, 'rewriting')
      }
    }

    // Finalize this chapter
    checkAbort()
    switchStep('finalize')
    useNovelStore.getState().setChapterStatus(activeProjectId, chapterIdx, 'finalized')
    addToast('success', `第 ${chapterIdx + 1}/${totalChapters} 章已完成`)
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
}

export function abortAutoGeneration() {
  aborted = true
  useSessionStore.getState().stopGeneration()
}
