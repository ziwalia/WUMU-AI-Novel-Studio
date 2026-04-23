import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useGeneration } from '@/hooks/useGeneration'
import { setCharacters, setRelationships, createCharacter } from '@/stores/characterStore'
import { buildSystemPrompt, architecturePrompt } from '@/services/prompts'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import type { Message, CharacterRelationship, RelationshipType } from '@/types'

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
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
    const rawJson = jsonMatch?.[1] ?? raw
    const parsed = JSON.parse(rawJson)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = flattenValue(value)
    }
    return result
  } catch {
    return null
  }
}

type RawCharEntry = { name?: string; role?: string; age?: string; personality?: string; abilities?: string; description?: string }

function parseRoleToWeight(role: string): import('@/types').CharacterWeight {
  const r = role.toLowerCase()
  if (r.includes('主角') || r.includes('主人公')) return 'protagonist'
  if (r.includes('反派') || r.includes('boss') || r.includes('敌人')) return 'major'
  if (r.includes('重要') || r.includes('主要') || r.includes('关键')) return 'major'
  if (r.includes('龙套') || r.includes('路人') || r.includes('背景')) return 'minor'
  return 'supporting'
}

function extractCharactersFromStructured(charsSection: RawCharEntry[]) {
  if (!Array.isArray(charsSection) || charsSection.length === 0) return null
  return charsSection
    .filter((e) => e.name && e.name.trim().length > 0)
    .map((e) => createCharacter({
      name: e.name!.trim(),
      weight: e.role ? parseRoleToWeight(e.role) : 'supporting',
      basicInfo: e.description || '',
      age: e.age || '',
      personality: e.personality || '',
      abilities: e.abilities ? e.abilities.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean) : [],
    }))
}

function extractCharactersFromFreeform(charsSection: string) {
  const lines = charsSection.split(/\n/).filter((l) => l.trim().length > 0)
  const entries: ReturnType<typeof createCharacter>[] = []
  for (const line of lines) {
    const m = line.match(/^\s*(?:\d+[.、)\s]+)?\s*[\[【]?([^\s：:—\-,，\]】]{1,10})[\]】]?\s*[：:—\-]+\s*(.+)/)
    if (m) {
      const name = m[1]!.trim()
      const desc = m[2]!.trim()
      const isProtagonist = line.includes('主角') || line.includes('主人公')
      const isVillain = line.includes('反派')
      entries.push(createCharacter({
        name,
        basicInfo: desc,
        weight: isProtagonist ? 'protagonist' : isVillain ? 'major' : 'supporting',
      }))
    }
  }
  return entries
}

type RawRelEntry = { from?: string; to?: string; type?: string; description?: string }

const VALID_REL_TYPES = new Set<string>(['恋人', '师徒', '敌对', '同门', '盟友', '朋友', '亲人', '其他'])

function normalizeRelType(t: string): RelationshipType {
  if (VALID_REL_TYPES.has(t)) return t as RelationshipType
  if (t.includes('恋') || t.includes('爱') || t.includes('夫妻')) return '恋人'
  if (t.includes('师') || t.includes('徒')) return '师徒'
  if (t.includes('敌') || t.includes('仇') || t.includes('对')) return '敌对'
  if (t.includes('同门') || t.includes('师兄弟') || t.includes('师姐妹')) return '同门'
  if (t.includes('盟') || t.includes('合作')) return '盟友'
  if (t.includes('友') || t.includes('朋友') || t.includes('兄弟')) return '朋友'
  if (t.includes('亲') || t.includes('父') || t.includes('母') || t.includes('子') || t.includes('女') || t.includes('兄') || t.includes('弟') || t.includes('姐') || t.includes('妹')) return '亲人'
  return '其他'
}

let relIdCounter = 0

function extractRelationships(relSection: unknown, charNames: Set<string>): CharacterRelationship[] {
  if (!relSection) return []
  const results: CharacterRelationship[] = []

  // Fuzzy match: allow partial name matching
  const findBestMatch = (name: string): string | null => {
    const trimmed = name.trim()
    if (charNames.has(trimmed)) return trimmed
    // Try finding a character name that contains this name or is contained by it
    for (const cn of charNames) {
      if (cn.includes(trimmed) || trimmed.includes(cn)) return cn
    }
    return null
  }

  const process = (entries: RawRelEntry[]) => {
    for (const e of entries) {
      if (!e.from || !e.to) continue
      const fromMatch = findBestMatch(e.from)
      const toMatch = findBestMatch(e.to)
      if (!fromMatch && !toMatch) continue
      results.push({
        id: `rel-${++relIdCounter}-${Math.random().toString(36).slice(2, 5)}`,
        from: fromMatch || e.from.trim(),
        to: toMatch || e.to.trim(),
        type: normalizeRelType(e.type || '其他'),
        description: e.description || '',
      })
    }
  }

  if (Array.isArray(relSection)) {
    process(relSection as RawRelEntry[])
  } else if (typeof relSection === 'object' && relSection !== null) {
    process(Object.entries(relSection).map(([k, v]) => {
      const val = v as Record<string, string>
      return { from: k, to: val.to || '', type: val.type || '其他', description: val.description || '' }
    }))
  }

  return results
}

function extractCharactersFromArch(raw: string) {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
    const rawJson = jsonMatch?.[1] ?? raw
    const parsed = JSON.parse(rawJson)
    if (!parsed || typeof parsed !== 'object') return

    // Extract characters
    let characters: ReturnType<typeof createCharacter>[] | null = null
    const charsSection = parsed.characters

    if (Array.isArray(charsSection)) {
      characters = extractCharactersFromStructured(charsSection as RawCharEntry[])
    } else if (charsSection && typeof charsSection === 'object') {
      const entries = Object.entries(charsSection).map(([k, v]) => ({
        name: k,
        ...(typeof v === 'object' && v !== null ? v as Record<string, unknown> : { description: String(v) }),
      }))
      characters = extractCharactersFromStructured(entries as RawCharEntry[])
    } else if (typeof charsSection === 'string') {
      characters = extractCharactersFromFreeform(charsSection)
    }

    if (characters && characters.length > 0) {
      setCharacters(characters)
    }

    // Extract relationships independently (even if characters failed)
    const relSection = parsed.relationships
    if (relSection) {
      // Use character names from parsed data if available, otherwise from existing store
      const parsedNames = characters ? new Set(characters.map((c) => c.name)) : new Set<string>()
      if (parsedNames.size === 0) {
        // Fall back to existing characters in store
        const existingProject = useNovelStore.getState().projects.find(
          (p) => p.id === useNovelStore.getState().activeProjectId
        )
        existingProject?.characters.forEach((c) => parsedNames.add(c.name))
      }
      const relationships = extractRelationships(relSection, parsedNames)
      if (relationships.length > 0) {
        setRelationships(relationships)
      }
    }
  } catch {
    // Silently ignore extraction failures
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
    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: architecturePrompt(project.params, genres) },
    ]

    await generate(messages, undefined, (content) => {
      if (activeProjectId) {
        setArchitecture(activeProjectId, content)
        extractCharactersFromArch(content)
      }
    })

    // Also extract from the final architecture after generation completes
    const finalArch = useNovelStore.getState().projects.find((p) => p.id === activeProjectId)?.architecture
    if (finalArch) {
      extractCharactersFromArch(finalArch)
    }
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
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
