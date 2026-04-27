import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { NovelProject, NovelParams, WizardStep, ChapterStatus, FullReviewResult } from '@/types'

/** Remove AI preamble before the actual chapter content (e.g. "好的，...", "以下是改写后的...") */
function cleanChapterContent(raw: string): string {
  if (!raw) return raw

  // Try to find the first markdown heading or chapter title pattern
  const patterns = [
    /^#{1,3}\s*第\d+章/m,          // "# 第X章 ..." or "## 第X章 ..."
    /^第\d+章[^\n]*/m,              // "第X章 标题" without #
    /^#{1,3}\s*/m,                   // any markdown heading as fallback
  ]

  for (const pat of patterns) {
    const match = pat.exec(raw)
    if (match && match.index > 0) {
      return raw.slice(match.index).trim()
    }
  }

  // If content starts directly with chapter title, no cleanup needed
  return raw
}

/** Ensure all character array fields are at least empty arrays (defensive against old persisted data) */
function normalizeCharacter(c: Record<string, unknown>): Record<string, unknown> {
  return {
    ...c,
    abilities: Array.isArray(c.abilities) ? c.abilities : [],
    heldItems: Array.isArray(c.heldItems) ? c.heldItems : [],
    locationTrajectory: Array.isArray(c.locationTrajectory) ? c.locationTrajectory : [],
    dialogueKeywords: Array.isArray(c.dialogueKeywords) ? c.dialogueKeywords : [],
    growthArc: Array.isArray(c.growthArc) ? c.growthArc : [],
    lifeStatus: c.lifeStatus || 'alive',
    emotionalArc: c.emotionalArc || '',
    lastAppearance: typeof c.lastAppearance === 'number' ? c.lastAppearance : -1,
  }
}

interface NovelState {
  projects: NovelProject[]
  activeProjectId: string | null

  createProject: (name: string, path: string, params: NovelParams) => string
  setActiveProject: (id: string) => void
  updateProjectParams: (id: string, params: Partial<NovelParams>) => void
  setCurrentStep: (id: string, step: WizardStep) => void
  setChapterStatus: (id: string, chapterIndex: number, status: ChapterStatus) => void
  setCurrentChapter: (id: string, index: number) => void
  setArchitecture: (id: string, content: string) => void
  setNovelOutline: (id: string, content: string) => void
  setBlueprint: (id: string, content: string) => void
  setChapterContent: (id: string, chapterIndex: number, content: string) => void
  setReviewResult: (id: string, chapterIndex: number, content: string) => void
  incrementReviewRound: (id: string, chapterIndex: number) => void
  setNextChapterHint: (id: string, chapterIndex: number, hint: string) => void
  setNextChapterPrediction: (id: string, chapterIndex: number, prediction: string) => void
  setRunningSummary: (id: string, summary: string) => void
  setFullReview: (id: string, review: FullReviewResult | null) => void
  clearProject: (id: string) => void
  deleteProject: (id: string) => void
}

export const useNovelStore = create<NovelState>()(
  persist(
    (set) => ({
      projects: [],
      activeProjectId: null,

      createProject: (name, path, params) => {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const project: NovelProject = {
          id,
          name,
          path,
          createdAt: now,
          updatedAt: now,
          currentStep: 'project-info',
          currentChapterIndex: 0,
          chapterStatuses: {},
          params,
          architecture: '',
          novelOutline: '',
          blueprint: '',
          chapters: {},
          reviewResults: {},
          reviewRounds: {},
          chapterHistory: {},
          characters: [],
          relationships: [],
          foreshadowings: [],
          chapterMetas: {},
          runningSummary: '',
          nextChapterPredictions: {},
          nextChapterHints: {},
          fullReview: null,
        }
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: id,
        }))
        return id
      },

      setActiveProject: (id) => set({ activeProjectId: id }),

      updateProjectParams: (id, params) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, params: { ...p.params, ...params }, updatedAt: new Date().toISOString() } : p
          ),
        })),

      setCurrentStep: (id, step) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, currentStep: step, updatedAt: new Date().toISOString() } : p
          ),
        })),

      setChapterStatus: (id, chapterIndex, status) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  chapterStatuses: { ...p.chapterStatuses, [chapterIndex]: status },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        })),

      setCurrentChapter: (id, index) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, currentChapterIndex: index, updatedAt: new Date().toISOString() } : p
          ),
        })),

      setArchitecture: (id, content) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, architecture: content, updatedAt: new Date().toISOString() } : p
          ),
        })),

      setNovelOutline: (id, content) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, novelOutline: content, updatedAt: new Date().toISOString() } : p
          ),
        })),

      setBlueprint: (id, content) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, blueprint: content, updatedAt: new Date().toISOString() } : p
          ),
        })),

      setChapterContent: (id, chapterIndex, content) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  chapters: { ...p.chapters, [chapterIndex]: cleanChapterContent(content) },
                  chapterHistory: {
                    ...(p.chapterHistory || {}),
                    [chapterIndex]: [
                      ...((p.chapterHistory || {})[chapterIndex] || []),
                      ...(p.chapters[chapterIndex] ? [p.chapters[chapterIndex]] : []),
                    ].slice(-5),
                  },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        })),

      setReviewResult: (id, chapterIndex, content) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  reviewResults: { ...p.reviewResults, [chapterIndex]: content },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        })),

      incrementReviewRound: (id, chapterIndex) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  reviewRounds: { ...p.reviewRounds, [chapterIndex]: (p.reviewRounds?.[chapterIndex] || 0) + 1 },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        })),

      setNextChapterHint: (id, chapterIndex, hint) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  nextChapterHints: { ...p.nextChapterHints, [chapterIndex]: hint },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        })),

      setNextChapterPrediction: (id, chapterIndex, prediction) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  nextChapterPredictions: { ...p.nextChapterPredictions, [chapterIndex]: prediction },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        })),

      setRunningSummary: (id, summary) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? { ...p, runningSummary: summary, updatedAt: new Date().toISOString() }
              : p
          ),
        })),

      setFullReview: (id, review) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? { ...p, fullReview: review, updatedAt: new Date().toISOString() }
              : p
          ),
        })),

      clearProject: (id) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  currentStep: 'project-info' as const,
                  currentChapterIndex: 0,
                  chapterStatuses: {},
                  architecture: '',
                  novelOutline: '',
                  volumeOutline: '',
                  blueprint: '',
                  chapters: {},
                  reviewResults: {},
                  reviewRounds: {},
                  characters: [],
                  relationships: [],
                  foreshadowings: [],
                  chapterMetas: {},
                  runningSummary: '',
                  nextChapterPredictions: {},
                  nextChapterHints: {},
                  fullReview: null,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        })),
    }),
    {
      name: 'abook-novels',
      storage: createJSONStorage(() => localStorage),
      version: 13,
      migrate: (persistedState: unknown, version: number) => {
        const persisted = persistedState as Record<string, unknown>
        if (version < 2) {
          const projects = (persisted.projects as Record<string, unknown>[]) || []
          return {
            ...persisted,
            projects: projects.map((p) => ({
              ...p,
              characters: (p as Record<string, unknown>).characters || [],
              foreshadowings: (p as Record<string, unknown>).foreshadowings || [],
              chapterMetas: (p as Record<string, unknown>).chapterMetas || {},
            })),
          }
        }
        if (version < 3) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => {
            const params = (p as Record<string, unknown>).params as Record<string, unknown> | undefined
            return {
              ...p,
              params: params ? { ...params, strictWordCount: params.strictWordCount ?? false } : { strictWordCount: false },
            }
          })
          return { ...persisted, projects }
        }
        if (version < 4) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => ({
            ...p,
            relationships: (p as Record<string, unknown>).relationships || [],
            characters: ((p as Record<string, unknown>).characters as Record<string, unknown>[])?.map((c) => ({
              ...c,
              age: c.age || '',
              personality: c.personality || '',
              growthArc: c.growthArc || [],
            })) || [],
          }))
          return { ...persisted, projects }
        }
        if (version < 5) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => ({
            ...p,
            reviewRounds: (p as Record<string, unknown>).reviewRounds || {},
          }))
          return { ...persisted, projects }
        }
        if (version < 6) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => {
            const params = (p as Record<string, unknown>).params as Record<string, unknown> | undefined
            return {
              ...p,
              params: params ? { ...params, writingStyle: (params as Record<string, unknown>).writingStyle || '' } : { writingStyle: '' },
            }
          })
          return { ...persisted, projects }
        }
        if (version < 7) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => ({
            ...p,
            nextChapterHints: (p as Record<string, unknown>).nextChapterHints || {},
          }))
          return { ...persisted, projects }
        }
        if (version < 8) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => ({
            ...p,
            nextChapterPredictions: (p as Record<string, unknown>).nextChapterPredictions || {},
          }))
          return { ...persisted, projects }
        }
        if (version < 9) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => ({
            ...p,
            runningSummary: (p as Record<string, unknown>).runningSummary || '',
          }))
          return { ...persisted, projects }
        }
        if (version < 10) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => ({
            ...p,
            fullReview: (p as Record<string, unknown>).fullReview || null,
          }))
          return { ...persisted, projects }
        }
        if (version < 11) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => {
            const params = (p as Record<string, unknown>).params as Record<string, unknown> | undefined
            return {
              ...p,
              novelOutline: (p as Record<string, unknown>).volumeOutline || '',
              volumeOutline: (p as Record<string, unknown>).volumeOutline || '',
              params: params ? { ...params } : {},
            }
          })
          return { ...persisted, projects }
        }
        if (version < 12) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => {
            return {
              ...p,
              chapterHistory: (p as Record<string, unknown>).chapterHistory || {},
            }
          })
          return { ...persisted, projects }
        }
        if (version < 13) {
          const projects = ((persisted.projects as Record<string, unknown>[]) || []).map((p) => {
            const chars = ((p as Record<string, unknown>).characters as Record<string, unknown>[]) || []
            return {
              ...p,
              characters: chars.map(normalizeCharacter),
            }
          })
          return { ...persisted, projects }
        }
        return persisted
      },
    }
  )
)
