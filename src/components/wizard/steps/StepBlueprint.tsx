import { useState } from 'react'
import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useGeneration } from '@/hooks/useGeneration'
import { addCharacter, updateCharacter, createCharacter, addRelationship, saveCharacterSnapshot } from '@/stores/characterStore'
import { buildSystemPrompt, blueprintPrompt } from '@/services/prompts'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import type { Message, ChapterBlueprint, CharacterWeight } from '@/types'

type BlueprintCharChange = {
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

type BlueprintRelChange = {
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

function parseRoleToWeight(role: string): CharacterWeight {
  const r = role.toLowerCase()
  if (r.includes('主角') || r.includes('主人公')) return 'protagonist'
  if (r.includes('反派') || r.includes('boss')) return 'major'
  if (r.includes('重要') || r.includes('主要') || r.includes('关键')) return 'major'
  if (r.includes('龙套') || r.includes('路人') || r.includes('背景')) return 'minor'
  return 'supporting'
}

function extractBlueprintChanges(raw: string) {
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
    const newChars: import('@/types').Character[] = []
    const charUpdates = new Map<string, Partial<import('@/types').Character>>()
    const newRels: import('@/types').CharacterRelationship[] = []
    let relCounter = Date.now()

    for (const ch of parsed) {
      // Process character changes
      if (ch.characterChanges && Array.isArray(ch.characterChanges)) {
        for (const change of ch.characterChanges as BlueprintCharChange[]) {
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
      if (ch.relationshipChanges && Array.isArray(ch.relationshipChanges)) {
        for (const rc of ch.relationshipChanges as BlueprintRelChange[]) {
          if (!rc.from || !rc.to) continue
          const relType = REL_TYPE_MAP[rc.type] || '其他'
          if (rc.action === 'add') {
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
    // Silently ignore
  }
}

export function StepBlueprint() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setBlueprint = useNovelStore((s) => s.setBlueprint)
  const genres = useUIStore((s) => s.genres)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const { generate, isStreaming, stopGeneration } = useGeneration()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const hasContent = project.blueprint || streamingContent
  const displayContent = streamingContent || project.blueprint

  const parseBlueprint = (raw: string): ChapterBlueprint[] | null => {
    try {
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
      const parsed = jsonMatch?.[1] ? JSON.parse(jsonMatch[1]) : JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      // Normalize to 0-based index if LLM returns 1-based
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

  const handleGenerate = async () => {
    if (!project.volumeOutline) return

    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: blueprintPrompt(
          project.params,
          project.volumeOutline,
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
        extractBlueprintChanges(content)
        // Save initial snapshot at chapter 0 for draft step
        saveCharacterSnapshot(0)
      }
    })
  }

  const handleEditSave = (_index: number) => {
    setEditingIndex(null)
    // The blueprint is a JSON string; editing individual chapters
    // would require re-serializing the whole array
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-[var(--color-primary)]">
              list_alt
            </span>
            <h3 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
              生成章节目录
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2 max-w-md">
              基于分卷大纲生成详细的章节目录，可调整顺序和编辑标题
            </p>
            {!project.volumeOutline ? (
              <p className="text-xs text-[var(--color-error)] mt-2">请先完成"分卷大纲"步骤</p>
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

          {chapters ? (
            <div className="space-y-1">
              {chapters.map((ch) => {
                const chapterStatus = project.chapterStatuses[ch.chapterIndex]
                const statusColor = chapterStatus === 'finalized'
                  ? 'text-[var(--color-success)]'
                  : chapterStatus === 'draft'
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-text-tertiary)]'
                const statusIcon = chapterStatus === 'finalized'
                  ? 'check_circle'
                  : chapterStatus === 'draft'
                    ? 'edit_note'
                    : 'radio_button_unchecked'

                return (
                  <div
                    key={ch.chapterIndex}
                    className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] group transition-colors"
                  >
                    <span className="text-xs font-mono text-[var(--color-text-tertiary)] w-8 text-right shrink-0">
                      {String(ch.chapterIndex + 1).padStart(2, '0')}
                    </span>
                    <span className={`material-symbols-outlined text-base ${statusColor}`}>
                      {statusIcon}
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
                        className="flex-1 text-sm bg-transparent border-b border-[var(--color-primary)] text-[var(--color-text-primary)] focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm text-[var(--color-text-primary)] cursor-pointer"
                        onDoubleClick={() => {
                          setEditingIndex(ch.chapterIndex)
                          setEditTitle(ch.title)
                        }}
                      >
                        {ch.title}
                      </span>
                    )}
                    <span className="text-xs text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity max-w-xs truncate">
                      {ch.summary}
                    </span>
                    <button
                      onClick={() => {
                        setEditingIndex(ch.chapterIndex)
                        setEditTitle(ch.title)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
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
