import type { Character, Foreshadowing } from './character'

export type WizardStep =
  | 'project-info'
  | 'architecture'
  | 'outline'
  | 'blueprint'
  | 'draft'
  | 'review'
  | 'rewrite'
  | 'finalize'
  | 'export'

export const WIZARD_STEPS: WizardStep[] = [
  'project-info',
  'architecture',
  'outline',
  'blueprint',
  'draft',
  'review',
  'rewrite',
  'finalize',
  'export',
]

export const STEP_LABELS: Record<WizardStep, string> = {
  'project-info': '项目信息',
  'architecture': '小说架构',
  'outline': '小说大纲',
  'blueprint': '章节目录',
  'draft': '草稿生成',
  'review': '一致性审校',
  'rewrite': '改写',
  'finalize': '定稿',
  'export': '导出',
}

export type ChapterStatus = 'draft' | 'reviewing' | 'rewriting' | 'finalized'

export interface NovelParams {
  topic: string
  genre: string
  chapterCount: number
  wordsPerChapter: number
  strictWordCount: boolean
  storyPremise: string
  narrativePerspective: string
  userGuidance: string
  writingStyle: string
  coreCharacters: string
  keyItems: string
  sceneLocation: string
  timePressure: string
}

export interface OutlineStage {
  stageIndex: number
  title: string
  theme: string
  chapterRange: [number, number]
  keyEvents: string[]
  emotionalTone: string
  characterArcs: string
}

export interface StructuredSummary {
  mainPlotProgress: string
  activeConflicts: string[]
  unresolvedMysteries: string[]
  emotionalTone: string
  recentEvents: string[]
  powerBalance: string
  keyTurningPoints: string[]
}

export interface ChapterBlueprint {
  chapterIndex: number
  title: string
  summary: string
}

export interface ChapterMeta {
  summary: string
  timeline: string
  sceneTypes: string[]
  pacingTag: 'tension' | 'calm' | 'transition'
  emotionIntensity: 'high' | 'medium' | 'low'
  characterUpdates: Record<string, {
    location?: string
    emotionalState?: string
    abilities?: string[]
    items?: string[]
  }>
  foreshadowingPlanted: { type: string; content: string }[]
  foreshadowingResolved: string[]
  itemChanges: string[]
  runningSummarySnapshot?: string
  characterSnapshot?: {
    characters: import('./character').Character[]
    relationships: import('./character').CharacterRelationship[]
  }
}

export interface FullReviewDimension {
  name: string
  score: number
  comment: string
}

export interface FullReviewResult {
  reviewedAt: string
  overallScore: number
  dimensions: FullReviewDimension[]
  summary: string
  suggestions: string[]
}

export interface NovelProject {
  id: string
  name: string
  path: string
  createdAt: string
  updatedAt: string
  currentStep: WizardStep
  currentChapterIndex: number
  chapterStatuses: Record<number, ChapterStatus>
  params: NovelParams
  // Generated data
  architecture: string
  novelOutline: string
  blueprint: string
  chapters: Record<number, string>
  reviewResults: Record<number, string>
  reviewRounds: Record<number, number>
  chapterHistory: Record<number, string[]>
  // Phase 3+4: Characters, foreshadowing, chapter metadata
  characters: Character[]
  relationships: import('./character').CharacterRelationship[]
  foreshadowings: Foreshadowing[]
  chapterMetas: Record<number, ChapterMeta>
  runningSummary: string
  nextChapterPredictions: Record<number, string>
  nextChapterHints: Record<number, string>
  fullReview: FullReviewResult | null
}
