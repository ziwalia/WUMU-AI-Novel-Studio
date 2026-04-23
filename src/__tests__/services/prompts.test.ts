import { describe, it, expect } from 'vitest'
import {
  architecturePrompt,
  volumeOutlinePrompt,
  blueprintPrompt,
  draftPrompt,
  reviewPrompt,
  rewritePrompt,
} from '@/services/prompts'
import type { NovelParams } from '@/types'

const baseParams: NovelParams = {
  topic: '修仙记',
  genre: '玄幻',
  volumeCount: 3,
  chapterCount: 30,
  wordsPerChapter: 3000,
      strictWordCount: false,
  userGuidance: '爽文风格', writingStyle: '',
  coreCharacters: '张三，李四',
  keyItems: '宝剑',
  sceneLocation: '修仙界',
  timePressure: '三年之约',
}

describe('prompts', () => {
  it('architecturePrompt includes all params', () => {
    const prompt = architecturePrompt(baseParams)
    expect(prompt).toContain('修仙记')
    expect(prompt).toContain('玄幻')
    expect(prompt).toContain('3')
    expect(prompt).toContain('30')
    expect(prompt).toContain('张三，李四')
    expect(prompt).toContain('JSON')
  })

  it('volumeOutlinePrompt includes architecture context', () => {
    const prompt = volumeOutlinePrompt(baseParams, '架构内容')
    expect(prompt).toContain('架构内容')
    expect(prompt).toContain('3')
    expect(prompt).toContain('卷')
  })

  it('blueprintPrompt includes volume outline', () => {
    const prompt = blueprintPrompt(baseParams, '分卷大纲')
    expect(prompt).toContain('分卷大纲')
    expect(prompt).toContain('30')
  })

  it('draftPrompt includes chapter context', () => {
    const prompt = draftPrompt(baseParams, '章节目录', 5)
    expect(prompt).toContain('第 6 章') // 0-indexed
    expect(prompt).toContain('3000')
    expect(prompt).toContain('章节目录')
  })

  it('draftPrompt includes previous content when provided', () => {
    const prompt = draftPrompt(baseParams, '目录', 1, '上一章结尾...')
    expect(prompt).toContain('上一章结尾...')
  })

  it('reviewPrompt includes content and characters', () => {
    const prompt = reviewPrompt('章节内容', '角色设定')
    expect(prompt).toContain('章节内容')
    expect(prompt).toContain('角色设定')
    expect(prompt).toContain('character')
    expect(prompt).toContain('plot')
  })

  it('rewritePrompt includes original and review', () => {
    const prompt = rewritePrompt('原文内容', '审校意见')
    expect(prompt).toContain('原文内容')
    expect(prompt).toContain('审校意见')
  })
})
