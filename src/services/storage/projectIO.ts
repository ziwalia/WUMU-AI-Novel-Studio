import type { NovelProject } from '@/types'

export function exportProjectToJson(project: NovelProject): string {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    project: {
      ...project,
      // Strip internal runtime state
      chapterStatuses: project.chapterStatuses,
    },
  }
  return JSON.stringify(exportData, null, 2)
}

export function importProjectFromJson(json: string): NovelProject {
  const data = JSON.parse(json)

  if (!data.project?.id || !data.project?.params) {
    throw new Error('无效的项目文件格式')
  }

  // Generate new ID to avoid conflicts
  const project: NovelProject = {
    ...data.project,
    id: crypto.randomUUID(),
    createdAt: data.project.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return project
}

export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function readFileAsText(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new Error('未选择文件'))
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsText(file)
    }
    input.click()
  })
}
