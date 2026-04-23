import { describe, it, expect, beforeEach } from 'vitest'
import { useNovelStore } from '@/stores/novelStore'

describe('novelStore', () => {
  beforeEach(() => {
    useNovelStore.setState({ projects: [], activeProjectId: null })
  })

  it('creates a project with correct defaults', () => {
    const id = useNovelStore.getState().createProject('测试小说', '', {
      topic: '修仙记',
      genre: '玄幻',
      volumeCount: 3,
      chapterCount: 30,
      wordsPerChapter: 3000,
      strictWordCount: false,
      userGuidance: '爽文',
      coreCharacters: '张三',
      keyItems: '',
      sceneLocation: '',
      timePressure: '',
      writingStyle: '',
    })

    const state = useNovelStore.getState()
    expect(state.projects).toHaveLength(1)
    expect(state.activeProjectId).toBe(id)
    expect(state.projects[0]!.name).toBe('测试小说')
    expect(state.projects[0]!.params.topic).toBe('修仙记')
    expect(state.projects[0]!.currentStep).toBe('project-info')
    expect(state.projects[0]!.architecture).toBe('')
  })

  it('updates project params immutably', () => {
    useNovelStore.getState().createProject('小说', '', {
      topic: '', genre: '', volumeCount: 1, chapterCount: 10, wordsPerChapter: 3000,
      strictWordCount: false,
      userGuidance: '', coreCharacters: '', keyItems: '', sceneLocation: '', timePressure: '', writingStyle: '',
    })

    const id = useNovelStore.getState().projects[0]!.id
    useNovelStore.getState().updateProjectParams(id, { topic: '新书名', genre: '科幻' })

    const project = useNovelStore.getState().projects[0]!
    expect(project.params.topic).toBe('新书名')
    expect(project.params.genre).toBe('科幻')
    expect(project.params.chapterCount).toBe(10) // unchanged
  })

  it('sets current step', () => {
    useNovelStore.getState().createProject('小说', '', {
      topic: '', genre: '', volumeCount: 1, chapterCount: 10, wordsPerChapter: 3000,
      strictWordCount: false,
      userGuidance: '', coreCharacters: '', keyItems: '', sceneLocation: '', timePressure: '', writingStyle: '',
    })

    const id = useNovelStore.getState().projects[0]!.id
    useNovelStore.getState().setCurrentStep(id, 'architecture')

    expect(useNovelStore.getState().projects[0]!.currentStep).toBe('architecture')
  })

  it('stores chapter content', () => {
    useNovelStore.getState().createProject('小说', '', {
      topic: '', genre: '', volumeCount: 1, chapterCount: 10, wordsPerChapter: 3000,
      strictWordCount: false,
      userGuidance: '', coreCharacters: '', keyItems: '', sceneLocation: '', timePressure: '', writingStyle: '',
    })

    const id = useNovelStore.getState().projects[0]!.id
    useNovelStore.getState().setChapterContent(id, 0, '第一章正文内容')

    expect(useNovelStore.getState().projects[0]!.chapters[0]).toBe('第一章正文内容')
  })

  it('deletes a project and clears activeProjectId', () => {
    const id = useNovelStore.getState().createProject('小说', '', {
      topic: '', genre: '', volumeCount: 1, chapterCount: 10, wordsPerChapter: 3000,
      strictWordCount: false,
      userGuidance: '', coreCharacters: '', keyItems: '', sceneLocation: '', timePressure: '', writingStyle: '',
    })

    useNovelStore.getState().deleteProject(id)
    expect(useNovelStore.getState().projects).toHaveLength(0)
    expect(useNovelStore.getState().activeProjectId).toBeNull()
  })

  it('stores architecture, volume outline, blueprint', () => {
    useNovelStore.getState().createProject('小说', '', {
      topic: '', genre: '', volumeCount: 1, chapterCount: 10, wordsPerChapter: 3000,
      strictWordCount: false,
      userGuidance: '', coreCharacters: '', keyItems: '', sceneLocation: '', timePressure: '', writingStyle: '',
    })

    const id = useNovelStore.getState().projects[0]!.id
    useNovelStore.getState().setArchitecture(id, '架构内容')
    useNovelStore.getState().setVolumeOutline(id, '分卷大纲')
    useNovelStore.getState().setBlueprint(id, '章节目录')

    const p = useNovelStore.getState().projects[0]!
    expect(p.architecture).toBe('架构内容')
    expect(p.volumeOutline).toBe('分卷大纲')
    expect(p.blueprint).toBe('章节目录')
  })
})
