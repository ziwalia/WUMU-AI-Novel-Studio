import { useNovelStore } from '@/stores/novelStore'
import { setCharacters, setRelationships, createCharacter } from '@/stores/characterStore'
import { parseJsonFromLLM } from '@/lib/extractJson'
import type { CharacterWeight, RelationshipType } from '@/types'

type RawCharEntry = { name?: string; role?: string; age?: string; personality?: string; abilities?: string; description?: string }

function parseRoleToWeight(role?: string): CharacterWeight {
  if (!role) return 'supporting'
  const r = role.toLowerCase()
  if (r.includes('主角') || r.includes('主人公')) return 'protagonist'
  if (r.includes('反派') || r.includes('boss') || r.includes('敌人')) return 'major'
  if (r.includes('重要') || r.includes('主要') || r.includes('关键')) return 'major'
  if (r.includes('龙套') || r.includes('路人') || r.includes('背景')) return 'minor'
  return 'supporting'
}

function parseAbilities(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string' && v) return v.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean)
  return []
}

function extractStructuredChars(charsSection: RawCharEntry[]) {
  if (!Array.isArray(charsSection) || charsSection.length === 0) return null
  return charsSection
    .filter((e) => e.name && e.name.trim().length > 0)
    .map((e) => createCharacter({
      name: e.name!.trim(),
      weight: e.role ? parseRoleToWeight(e.role) : 'supporting',
      basicInfo: e.description || '',
      age: e.age || '',
      personality: e.personality || '',
      abilities: parseAbilities(e.abilities),
    }))
}

function extractFreeformChars(charsSection: string) {
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

type RawRelEntry = { from?: string; to?: string; type?: string; description?: string }
let relIdCounter = 0

function extractRels(relSection: unknown, charNames: Set<string>) {
  if (!relSection) return []
  const results: import('@/types').CharacterRelationship[] = []
  const findMatch = (name: string): string | null => {
    const t = name.trim()
    if (charNames.has(t)) return t
    for (const cn of charNames) {
      if (cn.includes(t) || t.includes(cn)) return cn
    }
    return null
  }
  const process = (entries: RawRelEntry[]) => {
    for (const e of entries) {
      if (!e.from || !e.to) continue
      const fromMatch = findMatch(e.from)
      const toMatch = findMatch(e.to)
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

export function extractArchData(raw: string) {
  try {
    const parsed = parseJsonFromLLM<Record<string, unknown>>(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return

    // Extract characters
    let characters: ReturnType<typeof createCharacter>[] | null = null
    const charsSection = parsed.characters

    if (Array.isArray(charsSection)) {
      characters = extractStructuredChars(charsSection as RawCharEntry[])
    } else if (charsSection && typeof charsSection === 'object') {
      const entries = Object.entries(charsSection).map(([k, v]) => ({
        name: k,
        ...(typeof v === 'object' && v !== null ? v as Record<string, unknown> : { description: String(v) }),
      }))
      characters = extractStructuredChars(entries as RawCharEntry[])
    } else if (typeof charsSection === 'string') {
      characters = extractFreeformChars(charsSection)
    }

    if (characters && characters.length > 0) {
      setCharacters(characters)
    }

    // Extract relationships
    const relSection = parsed.relationships
    if (relSection) {
      const parsedNames = characters ? new Set(characters.map((c) => c.name)) : new Set<string>()
      if (parsedNames.size === 0) {
        const existingProject = useNovelStore.getState().projects.find(
          (p) => p.id === useNovelStore.getState().activeProjectId
        )
        existingProject?.characters.forEach((c) => parsedNames.add(c.name))
      }
      const relationships = extractRels(relSection, parsedNames)
      if (relationships.length > 0) {
        setRelationships(relationships)
      }
    }
  } catch {
    // silently ignore
  }
}
