import { useNovelStore } from '@/stores/novelStore'
import { addCharacter, updateCharacter, updateRelationship, createCharacter, addRelationship } from '@/stores/characterStore'
import { parseJsonFromLLM } from '@/lib/extractJson'
import type { Character, CharacterWeight, RelationshipType } from '@/types'

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
  description?: string
}

type StageEntry = {
  characterChanges?: CharChange[]
  relationshipChanges?: RelChange[]
}

const REL_TYPE_MAP: Record<string, RelationshipType> = {
  '恋人': '恋人', '师徒': '师徒', '敌对': '敌对', '同门': '同门',
  '盟友': '盟友', '朋友': '朋友', '亲人': '亲人', '其他': '其他',
}

function parseRoleToWeight(role?: string): CharacterWeight {
  if (!role) return 'supporting'
  const r = role.toLowerCase()
  if (r.includes('主角') || r.includes('主人公')) return 'protagonist'
  if (r.includes('反派') || r.includes('boss')) return 'major'
  if (r.includes('重要') || r.includes('主要') || r.includes('关键')) return 'major'
  if (r.includes('龙套') || r.includes('路人') || r.includes('背景')) return 'minor'
  return 'supporting'
}

export function extractOutlineData(raw: string) {
  try {
    const parsed = parseJsonFromLLM<unknown[]>(raw)
    if (!parsed || !Array.isArray(parsed)) return

    const project = useNovelStore.getState().projects.find(
      (p) => p.id === useNovelStore.getState().activeProjectId
    )
    if (!project) return

    const existingChars = project.characters
    const existingRels = project.relationships
    const charNameMap = new Map(existingChars.map((c) => [c.name, c]))

    const newChars: Character[] = []
    const charUpdates = new Map<string, Partial<Character>>()
    const newRels: import('@/types').CharacterRelationship[] = []
    let relCounter = Date.now()

    for (const entry of parsed as StageEntry[]) {
      if (entry.characterChanges && Array.isArray(entry.characterChanges)) {
        for (const change of entry.characterChanges) {
          if (!change.name || !change.changes) continue

          if (change.type === 'new_character') {
            if (!charNameMap.has(change.name) && !newChars.find((c) => c.name === change.name)) {
              newChars.push(createCharacter({
                name: change.name,
                weight: parseRoleToWeight(change.changes.role),
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

      if (entry.relationshipChanges && Array.isArray(entry.relationshipChanges)) {
        for (const rc of entry.relationshipChanges) {
          if (!rc.from || !rc.to) continue
          const relType = REL_TYPE_MAP[rc.type] || '其他' as RelationshipType

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
          } else if (rc.action === 'change') {
            const existing = existingRels.find(
              (r) => (r.from === rc.from && r.to === rc.to) || (r.from === rc.to && r.to === rc.from)
            )
            if (existing) {
              updateRelationship(existing.id, { type: relType, ...(rc.description ? { description: rc.description } : {}) })
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
