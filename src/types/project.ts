export interface ProjectMeta {
  id: string
  name: string
  path: string
  lastOpened: string
}

export interface AppConfig {
  theme: 'light' | 'dark' | 'system'
  language: 'zh-CN'
  recentProjects: ProjectMeta[]
  defaultLLMConfigId: string
}
