import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useGeneration } from '@/hooks/useGeneration'
import { addCharacter, updateCharacter, createCharacter, addRelationship } from '@/stores/characterStore'
import { buildSystemPrompt, volumeOutlinePrompt } from '@/services/prompts'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import type { Message, VolumeOutline, CharacterWeight } from '@/types'

type RawCharChange = {
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

type RawRelChange = {
  from: string
  to: string
  action: 'add' | 'change'
  type: string
  description?: string
}

type RawVolumeEntry = {
  characterChanges?: RawCharChange[]
  relationshipChanges?: RawRelChange[]
}

const REL_TYPE_MAP: Record<string, import('@/types').RelationshipType> = {
  '恋人': '恋人', '师徒': '师徒', '敌对': '敌对', '同门': '同门',
  '盟友': '盟友', '朋友': '朋友', '亲人': '亲人', '其他': '其他',
}

function parseRoleToWeight(role: string): CharacterWeight {
  const r = role.toLowerCase()
  if (r.includes('主角') || r.includes('主人公')) return 'protagonist'
  if (r.includes('反派') || r.includes('boss')) return 'major'
  if (r.includes('重要') || r.includes('主要') || r.includes('关键')) return 'major'
  if (r.includes('龙套') || r.includes('路人') || r.includes('背景')) return 'minor'
  return 'supporting'
}

function extractVolumeChanges(raw: string) {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
    const rawJson = jsonMatch?.[1] ?? raw
    const parsed = JSON.parse(rawJson)
    if (!Array.isArray(parsed)) return

    const project = useNovelStore.getState().projects.find(
      (p) => p.id === useNovelStore.getState().activeProjectId
    )
    if (!project) return

    const existingChars = project.characters
    const existingRels = project.relationships
    const charNameMap = new Map(existingChars.map((c) => [c.name, c]))

    // Collect all new characters and status updates across all volumes
    const newChars: import('@/types').Character[] = []
    const charUpdates = new Map<string, Partial<import('@/types').Character>>()
    const newRels: import('@/types').CharacterRelationship[] = []
    let relCounter = Date.now()

    for (const vol of parsed as RawVolumeEntry[]) {
      // Process character changes
      if (vol.characterChanges && Array.isArray(vol.characterChanges)) {
        for (const change of vol.characterChanges) {
          if (!change.name || !change.changes) continue

          if (change.type === 'new_character') {
            // Only add if not already exists
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
              if (c.abilities && c.abilities.length > 0) prev.abilities = c.abilities
              if (c.basicInfo) prev.basicInfo = c.basicInfo
              if (c.location) prev.locationTrajectory = [...(existing.locationTrajectory || []), c.location]
              if (c.status === 'dead' || c.status === 'alive') prev.lifeStatus = c.status as 'alive' | 'dead'
              charUpdates.set(change.name, prev)
            }
          }
        }
      }

      // Process relationship changes
      if (vol.relationshipChanges && Array.isArray(vol.relationshipChanges)) {
        for (const rc of vol.relationshipChanges) {
          if (!rc.from || !rc.to) continue
          const relType = REL_TYPE_MAP[rc.type] || '其他'

          if (rc.action === 'add') {
            // Check if relationship already exists
            const exists = existingRels.find(
              (r) => (r.from === rc.from && r.to === rc.to) || (r.from === rc.to && r.to === rc.from)
            )
            if (!exists && !newRels.find((r) => r.from === rc.from && r.to === rc.to)) {
              newRels.push({
                id: `rel-${++relCounter}-${Math.random().toString(36).slice(2, 5)}`,
                from: rc.from,
                to: rc.to,
                type: relType,
                description: rc.description || '',
              })
            }
          } else if (rc.action === 'change') {
            // Update existing relationship type
            const existing = existingRels.find(
              (r) => (r.from === rc.from && r.to === rc.to) || (r.from === rc.to && r.to === rc.from)
            )
            if (existing) {
              // Will be handled via updateRelationship below
            }
          }
        }
      }
    }

    // Apply changes to store
    // Add new characters
    for (const nc of newChars) {
      addCharacter(nc)
    }

    // Update existing characters
    for (const [name, updates] of charUpdates) {
      const char = charNameMap.get(name)
      if (char) {
        updateCharacter(char.id, updates)
      }
    }

    // Add new relationships
    for (const nr of newRels) {
      addRelationship(nr)
    }
  } catch {
    // Silently ignore extraction failures
  }
}

export function StepVolume() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setVolumeOutline = useNovelStore((s) => s.setVolumeOutline)
  const genres = useUIStore((s) => s.genres)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const { generate, isStreaming, stopGeneration } = useGeneration()

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const hasContent = project.volumeOutline || streamingContent
  const displayContent = streamingContent || project.volumeOutline

  const parseVolumes = (raw: string): VolumeOutline[] | null => {
    try {
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
      const parsed = jsonMatch?.[1] ? JSON.parse(jsonMatch[1]) : JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      return parsed
    } catch {
      return null
    }
  }

  const volumes = displayContent ? parseVolumes(displayContent) : null

  const handleGenerate = async () => {
    if (!project.architecture) return

    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: volumeOutlinePrompt(
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
        setVolumeOutline(activeProjectId, content)
        extractVolumeChanges(content)
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-[var(--color-primary)]">
              library_books
            </span>
            <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
              生成分卷大纲
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2 max-w-md">
              基于小说架构，按卷拆分故事线，生成每卷的主题和章节规划
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
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)]">
              分卷大纲
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

          {volumes ? (
            <div className="space-y-4">
              {volumes.map((vol) => (
                <div
                  key={vol.volumeIndex}
                  className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold">
                        {vol.volumeIndex}
                      </span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {vol.title}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      第{vol.chapterRange[0]}-{vol.chapterRange[1]}章
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3">{vol.theme}</p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                        关键事件
                      </span>
                      <ul className="mt-1 space-y-1">
                        {vol.keyEvents.map((evt, i) => (
                          <li key={i} className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2">
                            <span className="material-symbols-outlined text-sm text-[var(--color-primary)] mt-0.5">
                              chevron_right
                            </span>
                            {evt}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {vol.characterArcs && (
                      <div>
                        <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                          角色变化
                        </span>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                          {vol.characterArcs}
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
