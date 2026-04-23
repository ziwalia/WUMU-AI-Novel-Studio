export type CharacterWeight = 'protagonist' | 'major' | 'supporting' | 'minor'

export type RelationshipType = '恋人' | '师徒' | '敌对' | '同门' | '盟友' | '朋友' | '亲人' | '其他'

export const RELATIONSHIP_TYPES: RelationshipType[] = ['恋人', '师徒', '敌对', '同门', '盟友', '朋友', '亲人', '其他']

export const REL_COLORS: Record<RelationshipType, string> = {
  '恋人': '#ec4899',
  '师徒': '#3b82f6',
  '敌对': '#ef4444',
  '同门': '#06b6d4',
  '盟友': '#22c55e',
  '朋友': '#84cc16',
  '亲人': '#f97316',
  '其他': '#9ca3af',
}

export interface CharacterRelationship {
  id: string
  from: string
  to: string
  type: RelationshipType
  description: string
}

export interface GrowthEntry {
  chapterIndex: number
  change: string
}

export interface Character {
  id: string
  name: string
  weight: CharacterWeight
  basicInfo: string
  age: string
  personality: string
  abilities: string[]
  heldItems: string[]
  lifeStatus: 'alive' | 'dead' | 'unknown'
  emotionalArc: string
  locationTrajectory: string[]
  dialogueKeywords: string[]
  lastAppearance: number
  growthArc: GrowthEntry[]
}

export type ForeshadowingType = 'MF' | 'AF' | 'CF' | 'SF' | 'YF'
export type ForeshadowingPriority = 'high' | 'medium' | 'low'

export interface Foreshadowing {
  id: string
  type: ForeshadowingType
  content: string
  status: 'planted' | 'resolved'
  plantedChapter: number
  resolvedChapter?: number
  priority: ForeshadowingPriority
}

export const WEIGHT_LABELS: Record<CharacterWeight, string> = {
  protagonist: '主角',
  major: '重要配角',
  supporting: '配角',
  minor: '龙套',
}

export const FORESHADOWING_LABELS: Record<ForeshadowingType, string> = {
  MF: '主线伏笔',
  AF: '动作伏笔',
  CF: '角色伏笔',
  SF: '设定伏笔',
  YF: '预言伏笔',
}
