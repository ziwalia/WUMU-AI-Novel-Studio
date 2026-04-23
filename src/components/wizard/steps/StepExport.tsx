import { useState } from 'react'
import { useNovelStore } from '@/stores/novelStore'
import { Button } from '@/components/shared/Button'

type ExportFormat = 'txt' | 'markdown' | 'json'

const FORMATS: { value: ExportFormat; label: string; icon: string; desc: string }[] = [
  { value: 'txt', label: 'TXT', icon: 'description', desc: '纯文本格式，适合各大阅读平台' },
  { value: 'markdown', label: 'Markdown', icon: 'code', desc: '保留章节结构，适合二次编辑' },
  { value: 'json', label: 'JSON', icon: 'data_object', desc: '包含完整元数据，适合程序处理' },
]

export function StepExport() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('txt')
  const [exported, setExported] = useState(false)

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const totalChapters = project.params.chapterCount
  const finalizedCount = Object.values(project.chapterStatuses).filter(
    (s) => s === 'finalized'
  ).length
  const chaptersWithContent = Object.keys(project.chapters).length

  const buildExportContent = (): string => {
    switch (selectedFormat) {
      case 'txt':
        return Array.from({ length: totalChapters }, (_, i) => {
          const content = project.chapters[i]
          if (!content) return ''
          return `第${i + 1}章\n\n${content}`
        })
          .filter(Boolean)
          .join('\n\n---\n\n')

      case 'markdown':
        return `# ${project.params.topic || '未命名小说'}\n\n`
          + `> ${project.params.genre} | ${totalChapters}章 | ${project.params.wordsPerChapter}字/章\n\n`
          + `---\n\n`
          + Array.from({ length: totalChapters }, (_, i) => {
              const content = project.chapters[i]
              if (!content) return ''
              return `## 第${i + 1}章\n\n${content}`
            })
            .filter(Boolean)
            .join('\n\n---\n\n')

      case 'json':
        return JSON.stringify(
          {
            name: project.params.topic,
            genre: project.params.genre,
            totalChapters,
            params: project.params,
            architecture: project.architecture,
            volumeOutline: project.volumeOutline,
            blueprint: project.blueprint,
            chapters: project.chapters,
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        )
    }
  }

  const handleExport = () => {
    const content = buildExportContent()
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.params.topic || '小说'}.${selectedFormat === 'markdown' ? 'md' : selectedFormat}`
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  const handleCopyAll = async () => {
    const content = buildExportContent()
    await navigator.clipboard.writeText(content)
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col">
      <div className="mb-6">
        <h3 className="font-headline text-xl font-semibold text-[var(--color-text-primary)]">
          导出小说
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          选择格式并导出你的作品
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--color-primary)]">{chaptersWithContent}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">已生成章节</p>
        </div>
        <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--color-success)]">{finalizedCount}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">已定稿</p>
        </div>
        <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--color-text-primary)]">
            {Object.values(project.chapters).reduce((sum, c) => sum + c.length, 0).toLocaleString()}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">总字数</p>
        </div>
      </div>

      {/* Format selection */}
      <div className="space-y-2 mb-6">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">选择导出格式</p>
        {FORMATS.map((fmt) => (
          <button
            key={fmt.value}
            onClick={() => setSelectedFormat(fmt.value)}
            className={`w-full flex items-center gap-3 p-3 rounded-[var(--radius-md)] border transition-colors text-left ${
              selectedFormat === fmt.value
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${
              selectedFormat === fmt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)]'
            }`}>
              {fmt.icon}
            </span>
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{fmt.label}</span>
              <p className="text-xs text-[var(--color-text-tertiary)]">{fmt.desc}</p>
            </div>
            {selectedFormat === fmt.value && (
              <span className="material-symbols-outlined text-base text-[var(--color-primary)] ml-auto">
                check_circle
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="md"
          onClick={handleExport}
          disabled={chaptersWithContent === 0}
          icon={
            <span className="material-symbols-outlined text-base">
              {exported ? 'check' : 'download'}
            </span>
          }
        >
          {exported ? '已下载' : '下载文件'}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={handleCopyAll}
          disabled={chaptersWithContent === 0}
          icon={<span className="material-symbols-outlined text-base">content_copy</span>}
        >
          复制全部
        </Button>
      </div>
    </div>
  )
}
