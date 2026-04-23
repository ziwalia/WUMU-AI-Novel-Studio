import { describe, it, expect } from 'vitest'
import { exportProjectToJson, importProjectFromJson } from '@/services/storage/projectIO'
import type { NovelProject } from '@/types'

const mockProject: NovelProject = {
  id: 'test-id',
  name: '测试小说',
  path: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  currentStep: 'architecture',
  currentChapterIndex: 0,
  chapterStatuses: { 0: 'draft' },
  params: {
    topic: '修仙记',
    genre: '玄幻',
    volumeCount: 3,
    chapterCount: 30,
    wordsPerChapter: 3000,
      strictWordCount: false,
    userGuidance: '爽文风格',
    writingStyle: '',
    coreCharacters: '张三',
    keyItems: '宝剑',
    sceneLocation: '修仙界',
    timePressure: '三年之约',
  },
  architecture: '架构内容',
  volumeOutline: '',
  blueprint: '',
  chapters: { 0: '第一章内容' },
  reviewResults: {},
  reviewRounds: {},
  characters: [],
  foreshadowings: [],
  chapterMetas: {},
  relationships: [],
  nextChapterPredictions: {},
  nextChapterHints: {},
  runningSummary: '',
  fullReview: null,
}

describe('projectIO', () => {
  it('exports project to valid JSON', () => {
    const json = exportProjectToJson(mockProject)
    const parsed = JSON.parse(json)

    expect(parsed.version).toBe(1)
    expect(parsed.project.name).toBe('测试小说')
    expect(parsed.project.params.topic).toBe('修仙记')
    expect(parsed.project.chapters[0]).toBe('第一章内容')
  })

  it('imports project from JSON with new ID', () => {
    const json = exportProjectToJson(mockProject)
    const imported = importProjectFromJson(json)

    expect(imported.name).toBe('测试小说')
    expect(imported.id).not.toBe('test-id') // new ID generated
    expect(imported.params.topic).toBe('修仙记')
    expect(imported.chapters[0]).toBe('第一章内容')
  })

  it('rejects invalid JSON', () => {
    expect(() => importProjectFromJson('{"invalid": true}')).toThrow('无效的项目文件格式')
  })

  it('round-trips data without loss', () => {
    const json = exportProjectToJson(mockProject)
    const imported = importProjectFromJson(json)

    expect(imported.params).toEqual(mockProject.params)
    expect(imported.architecture).toBe(mockProject.architecture)
    expect(imported.chapters).toEqual(mockProject.chapters)
  })
})
