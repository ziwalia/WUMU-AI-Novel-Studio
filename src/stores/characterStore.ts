import { useNovelStore } from './novelStore'
import type { Character, CharacterRelationship, Foreshadowing, ChapterMeta } from '@/types'

function generateId(): string {
  return `char-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createCharacter(partial: Partial<Character>): Character {
  return {
    id: generateId(),
    name: partial.name || '未命名角色',
    weight: partial.weight || 'supporting',
    basicInfo: partial.basicInfo || '',
    age: partial.age || '',
    personality: partial.personality || '',
    abilities: partial.abilities || [],
    heldItems: partial.heldItems || [],
    lifeStatus: partial.lifeStatus || 'alive',
    emotionalArc: partial.emotionalArc || '',
    locationTrajectory: partial.locationTrajectory || [],
    dialogueKeywords: partial.dialogueKeywords || [],
    lastAppearance: partial.lastAppearance ?? -1,
    growthArc: partial.growthArc || [],
  }
}

export function useCharacters() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const project = projects.find((p) => p.id === activeProjectId)
  return project?.characters ?? []
}

export function useForeshadowings() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const project = projects.find((p) => p.id === activeProjectId)
  return project?.foreshadowings ?? []
}

// Actions operate directly on novelStore project data
export function addCharacter(character: Character) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? { ...p, characters: [...p.characters, character], updatedAt: new Date().toISOString() }
        : p
    ),
  }))
}

export function updateCharacter(charId: string, updates: Partial<Character>) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? {
            ...p,
            characters: p.characters.map((c) => (c.id === charId ? { ...c, ...updates } : c)),
            updatedAt: new Date().toISOString(),
          }
        : p
    ),
  }))
}

export function removeCharacter(charId: string) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? { ...p, characters: p.characters.filter((c) => c.id !== charId), updatedAt: new Date().toISOString() }
        : p
    ),
  }))
}

export function setCharacters(characters: Character[]) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) => {
      if (p.id !== activeProjectId) return p
      const existing = p.characters
      const nameMap = new Map(existing.map((c) => [c.name, c]))
      const merged = characters.map((nc) => {
        const prev = nameMap.get(nc.name)
        if (!prev) return nc
        nameMap.delete(nc.name)
        return {
          ...prev,
          ...Object.fromEntries(
            Object.entries(nc).filter(([_, v]) => v !== '' && v !== undefined && !(Array.isArray(v) && v.length === 0))
          ),
        } as Character
      })
      // Keep characters not in the new list (manually added)
      for (const [, c] of nameMap) {
        merged.push(c)
      }
      return { ...p, characters: merged, updatedAt: new Date().toISOString() }
    }),
  }))
}

export function addForeshadowing(foreshadowing: Foreshadowing) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? { ...p, foreshadowings: [...p.foreshadowings, foreshadowing], updatedAt: new Date().toISOString() }
        : p
    ),
  }))
}

export function resolveForeshadowing(id: string, chapter: number) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? {
            ...p,
            foreshadowings: p.foreshadowings.map((f) =>
              f.id === id ? { ...f, status: 'resolved' as const, resolvedChapter: chapter } : f
            ),
            updatedAt: new Date().toISOString(),
          }
        : p
    ),
  }))
}

export function updateChapterMeta(chapterIndex: number, meta: Partial<ChapterMeta>) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  const emptyMeta: ChapterMeta = { summary: '', timeline: '', sceneTypes: [], pacingTag: 'transition', emotionIntensity: 'medium', characterUpdates: {}, foreshadowingPlanted: [], foreshadowingResolved: [], itemChanges: [], characterSnapshot: undefined }
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? {
            ...p,
            chapterMetas: {
              ...p.chapterMetas,
              [chapterIndex]: { ...emptyMeta, ...p.chapterMetas[chapterIndex], ...meta },
            },
            updatedAt: new Date().toISOString(),
          }
        : p
    ),
  }))
}

export function useRelationships() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const project = projects.find((p) => p.id === activeProjectId)
  return project?.relationships ?? []
}

export function addRelationship(rel: Omit<CharacterRelationship, 'id'>) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  const newRel: CharacterRelationship = { ...rel, id: generateId() }
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? { ...p, relationships: [...p.relationships, newRel], updatedAt: new Date().toISOString() }
        : p
    ),
  }))
}

export function updateRelationship(relId: string, updates: Partial<CharacterRelationship>) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? {
            ...p,
            relationships: p.relationships.map((r) => (r.id === relId ? { ...r, ...updates } : r)),
            updatedAt: new Date().toISOString(),
          }
        : p
    ),
  }))
}

export function removeRelationship(relId: string) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? { ...p, relationships: p.relationships.filter((r) => r.id !== relId), updatedAt: new Date().toISOString() }
        : p
    ),
  }))
}

export function setRelationships(relationships: CharacterRelationship[]) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) => {
      if (p.id !== activeProjectId) return p
      const existing = p.relationships
      const key = (r: { from: string; to: string }) => [r.from, r.to].sort().join('→')
      const existingMap = new Map(existing.map((r) => [key(r), r]))
      const merged = relationships.map((nr) => {
        const k = key(nr)
        const prev = existingMap.get(k)
        if (!prev) return nr
        existingMap.delete(k)
        return { ...prev, ...nr } as CharacterRelationship
      })
      for (const [, r] of existingMap) {
        merged.push(r)
      }
      return { ...p, relationships: merged, updatedAt: new Date().toISOString() }
    }),
  }))
}

export function saveCharacterSnapshot(chapterIndex: number) {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return
  useNovelStore.setState((state) => ({
    projects: state.projects.map((p) => {
      if (p.id !== activeProjectId) return p
      const emptyMeta: ChapterMeta = { summary: '', timeline: '', sceneTypes: [], pacingTag: 'transition', emotionIntensity: 'medium', characterUpdates: {}, foreshadowingPlanted: [], foreshadowingResolved: [], itemChanges: [], characterSnapshot: undefined }
      const existing = p.chapterMetas[chapterIndex] || emptyMeta
      return {
        ...p,
        chapterMetas: {
          ...p.chapterMetas,
          [chapterIndex]: {
            ...existing,
            characterSnapshot: {
              characters: JSON.parse(JSON.stringify(p.characters)),
              relationships: JSON.parse(JSON.stringify(p.relationships)),
            },
          },
        },
        updatedAt: new Date().toISOString(),
      }
    }),
  }))
}

export function restoreCharacterSnapshot(chapterIndex: number): boolean {
  const { activeProjectId } = useNovelStore.getState()
  if (!activeProjectId) return false
  const state = useNovelStore.getState()
  const project = state.projects.find((p) => p.id === activeProjectId)
  if (!project) return false
  const snapshot = project.chapterMetas[chapterIndex]?.characterSnapshot
  if (!snapshot) return false
  useNovelStore.setState({
    projects: state.projects.map((p) =>
      p.id === activeProjectId
        ? {
            ...p,
            characters: JSON.parse(JSON.stringify(snapshot.characters)),
            relationships: JSON.parse(JSON.stringify(snapshot.relationships)),
            updatedAt: new Date().toISOString(),
          }
        : p
    ),
  })
  return true
}

export function useCharacterSnapshots(): { chapterIndex: number; label: string }[] {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return []
  const snapshots: { chapterIndex: number; label: string }[] = []
  for (const [idx, meta] of Object.entries(project.chapterMetas)) {
    if (meta.characterSnapshot) {
      const i = Number(idx)
      snapshots.push({ chapterIndex: i, label: i === 0 ? '初始快照' : `第${i}章后` })
    }
  }
  return snapshots
}
