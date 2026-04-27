import { useMemo, useState } from 'react'
import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import { runAutoGeneration, resetAutoAbort, type AutoGenConfig } from '@/services/autoGenerationService'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

export function StepProjectInfo() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const updateProjectParams = useNovelStore((s) => s.updateProjectParams)

  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return null

  const genres = useUIStore((s) => s.genres)
  const writingStyles = useUIStore((s) => s.writingStyles)
  const [selectedStyleIdx, setSelectedStyleIdx] = useState<number | ''>('')
  const addToast = useUIStore((s) => s.addToast)
  const setAutoGenerating = useUIStore((s) => s.setAutoGenerating)
  const isStreaming = useSessionStore((s) => s.isStreaming)
  const params = project.params

  const update = (updates: Partial<typeof params>) => {
    if (activeProjectId) updateProjectParams(activeProjectId, updates)
  }

  const selectedGenres = useMemo(
    () => (params.genre ? params.genre.split(',').filter(Boolean) : []),
    [params.genre],
  )

  const [channel, setChannel] = useState<'male' | 'female'>(() => {
    if (selectedGenres.length > 0) {
      const first = genres.find((g) => g.name === selectedGenres[0])
      return first?.channel || 'male'
    }
    return 'male'
  })

  const channelGenres = useMemo(
    () => genres.filter((g) => g.channel === channel),
    [genres, channel],
  )

  const toggleGenre = (name: string) => {
    if (selectedGenres.includes(name)) {
      update({ genre: selectedGenres.filter((g) => g !== name).join(',') })
    } else {
      if (selectedGenres.length >= 4) {
        addToast('warning', '最多选择4个类型')
        return
      }
      update({ genre: [...selectedGenres, name].join(',') })
    }
  }

  const handleChannelChange = (c: 'male' | 'female') => {
    setChannel(c)
    update({ genre: '' })
  }

  // --- Auto generation ---
  const [autoDialogOpen, setAutoDialogOpen] = useState(false)
  const [reviewRounds, setReviewRounds] = useState(1)
  const [autoConfirmOpen, setAutoConfirmOpen] = useState(false)
  const [autoError, setAutoError] = useState<string | null>(null)

  const canAutoGenerate = !!params.topic && !!params.genre && !isStreaming

  const handleAutoStart = () => {
    if (!canAutoGenerate) return
    setAutoDialogOpen(true)
  }

  const handleAutoConfigConfirm = () => {
    setAutoDialogOpen(false)
    setAutoConfirmOpen(true)
  }

  const handleAutoFinalConfirm = async () => {
    setAutoConfirmOpen(false)
    setAutoGenerating(true)

    try {
      resetAutoAbort()
      const autoConfig: AutoGenConfig = { reviewRounds }
      await runAutoGeneration(autoConfig)
      addToast('success', '全自动生成完成！')
    } catch (err: unknown) {
      if (err instanceof Error && (err.message === 'AUTO_ABORTED' || err.name === 'AbortError')) {
        return
      }
      setAutoError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setAutoGenerating(false)
    }
  }

  const inputCls = "w-full h-10 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
  const textareaCls = "w-full px-3 py-2 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] resize-none"
  const labelCls = "block text-sm font-medium text-[var(--color-text-primary)] mb-1"
  const hintCls = "text-xs text-[var(--color-text-tertiary)] mt-0.5"

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="font-headline text-xl font-semibold text-[var(--color-text-primary)] mb-1">
          小说基本信息
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          填写小说的基本参数，AI 将基于这些信息生成架构和内容
        </p>
      </div>

      <div className="space-y-4">
        {/* 小说名称 */}
        <div>
          <label htmlFor="topic" className={labelCls}>小说名称</label>
          <input id="topic" type="text" value={params.topic} onChange={(e) => update({ topic: e.target.value })}
            placeholder="例如：修仙记、星际迷航" className={inputCls} />
        </div>

        {/* 小说类型 */}
        <div>
          <label className={labelCls}>小说类型{selectedGenres.length > 0 && <span style={{ color: '#995137' }} className="ml-2">{selectedGenres.join('、')}</span>}</label>
          <div className="flex items-center gap-6 mb-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="radio" name="channel" checked={channel === 'male'} onChange={() => handleChannelChange('male')} className="accent-[var(--color-primary)] w-4 h-4" />
              <span className="text-sm text-[var(--color-text-primary)] font-medium">男频</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="radio" name="channel" checked={channel === 'female'} onChange={() => handleChannelChange('female')} className="accent-[var(--color-primary)] w-4 h-4" />
              <span className="text-sm text-[var(--color-text-primary)] font-medium">女频</span>
            </label>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-4 max-h-48 overflow-y-auto">
            <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
              {channelGenres.map((g) => (
                <label key={g.name} className="flex items-center gap-2 cursor-pointer py-0.5 select-none">
                  <input type="checkbox" checked={selectedGenres.includes(g.name)} onChange={() => toggleGenre(g.name)} className="accent-[var(--color-primary)] w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs text-[var(--color-text-secondary)] truncate">{g.name}</span>
                </label>
              ))}
            </div>
          </div>
          {selectedGenres.length > 0 && (
            <div className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
              已选择 {selectedGenres.length}/4：{selectedGenres.join('、')}
            </div>
          )}
        </div>

        {/* 总章数 + 每章字数 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="chapterCount" className={labelCls}>总章数</label>
            <input id="chapterCount" type="number" min={1} max={500} value={params.chapterCount}
              onChange={(e) => update({ chapterCount: Math.max(1, parseInt(e.target.value) || 10) })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="wordsPerChapter" className={labelCls}>每章字数</label>
            <input id="wordsPerChapter" type="number" min={1000} max={10000} step={500} value={params.wordsPerChapter}
              onChange={(e) => update({ wordsPerChapter: Math.max(1000, parseInt(e.target.value) || 3000) })} className={inputCls} />
            <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={params.strictWordCount ?? false} onChange={(e) => update({ strictWordCount: e.target.checked })} className="accent-[var(--color-primary)]" />
              <span className="text-xs text-[var(--color-text-tertiary)]">精确字数 (±5%)</span>
            </label>
          </div>
        </div>

        {/* 模型建议提示 */}
        {(() => {
          const estTokens = params.chapterCount * 50 + params.wordsPerChapter * 4.5 + 5000
          const rec = estTokens < 25000 ? '32K' : estTokens < 50000 ? '64K' : '128K'
          return (
            <div className="text-xs font-semibold bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2" style={{ color: '#934C33' }}>
              独立调用模式（{params.chapterCount}章 x {params.wordsPerChapter}字），预估单章生成峰值约 {Math.round(estTokens).toLocaleString()} tokens，建议使用 {rec} 及以上上下文的大模型
            </div>
          )
        })()}

        {/* 叙事视角 */}
        <div>
          <label htmlFor="narrativePerspective" className={labelCls}>叙事视角</label>
          <select id="narrativePerspective" value={params.narrativePerspective}
            onChange={(e) => update({ narrativePerspective: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
          >
            <option value="">请选择叙事视角</option>
            <option value="第一人称">第一人称（我）</option>
            <option value="第三人称有限视角">第三人称有限视角（聚焦单一角色）</option>
            <option value="第三人称全知视角">第三人称全知视角（上帝视角）</option>
            <option value="多人视角/POV">多人视角/POV（多角色交替）</option>
            <option value="第二人称">第二人称（你）</option>
          </select>
        </div>

        {/* 故事梗概 */}
        <div>
          <label htmlFor="storyPremise" className={labelCls}>
            故事梗概
            <span className={hintCls}> — 用1-3句话描述你想要的故事核心，这是AI创作最重要的指引</span>
          </label>
          <textarea id="storyPremise" value={params.storyPremise} onChange={(e) => update({ storyPremise: e.target.value })}
            placeholder="例如：女主重生回到末世前一个月，利用先知优势疯狂囤积物资。全球气温骤降开启末日，她凭借随身空间和冷静头脑，在极寒丧尸末世中建立幸存者基地，一步步重建文明秩序。"
            rows={3} className={textareaCls} />
        </div>

        {/* 创作指导 */}
        <div>
          <label htmlFor="userGuidance" className={labelCls}>
            创作指导
            <span className={hintCls}> — 补充你对风格、节奏、情节偏好的具体要求，AI会尽量遵循</span>
          </label>
          <textarea id="userGuidance" value={params.userGuidance} onChange={(e) => update({ userGuidance: e.target.value })}
            placeholder="例如：爽文节奏，打脸剧情要多；注重权谋博弈，少写感情线；前期慢热铺垫，后期节奏加快"
            rows={3} className={textareaCls} />
        </div>

        {/* 文笔风格 */}
        <div>
          <label htmlFor="writingStyleSelect" className={labelCls}>文笔风格</label>
          <select id="writingStyleSelect" value={selectedStyleIdx}
            onChange={(e) => {
              const val = e.target.value
              const idx = Number(val)
              setSelectedStyleIdx(val === '' ? '' : idx)
              if (val !== '' && writingStyles[idx]) {
                update({ writingStyle: writingStyles[idx]!.description })
              }
            }}
            className="w-full px-3 py-2 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
          >
            <option value="">选择预设文风（可选）</option>
            {writingStyles.map((style, i) => (
              <option key={i} value={i}>{style.name}</option>
            ))}
          </select>
          <textarea value={params.writingStyle} onChange={(e) => { update({ writingStyle: e.target.value }); setSelectedStyleIdx('') }}
            placeholder="选择上方预设自动填入，或自定义描述你期望的文笔风格" rows={4} className={`${textareaCls} mt-2`} />
        </div>

        {/* 核心角色 */}
        <div>
          <label htmlFor="coreCharacters" className={labelCls}>核心角色</label>
          <textarea id="coreCharacters" value={params.coreCharacters} onChange={(e) => update({ coreCharacters: e.target.value })}
            placeholder="描述主要角色的名字、性格、背景等，如：林浅，25岁，冷静果断，末世前是物流经理" rows={2} className={textareaCls} />
        </div>

        {/* 关键道具 + 场景地点 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="keyItems" className={labelCls}>关键道具</label>
            <textarea id="keyItems" value={params.keyItems} onChange={(e) => update({ keyItems: e.target.value })}
              placeholder="法宝、神器、特殊物品等" rows={2} className={textareaCls} />
          </div>
          <div>
            <label htmlFor="sceneLocation" className={labelCls}>场景地点</label>
            <textarea id="sceneLocation" value={params.sceneLocation} onChange={(e) => update({ sceneLocation: e.target.value })}
              placeholder="主要场景、地图设定等" rows={2} className={textareaCls} />
          </div>
        </div>

        {/* 时间压力 */}
        <div>
          <label htmlFor="timePressure" className={labelCls}>时间压力</label>
          <textarea id="timePressure" value={params.timePressure} onChange={(e) => update({ timePressure: e.target.value })}
            placeholder="倒计时、deadline、紧迫感来源等" rows={2} className={textareaCls} />
        </div>
      </div>

      {/* 全自动生成按钮 — 移到底部 */}
      <div className="flex justify-center pt-2 pb-6">
        <button
          onClick={handleAutoStart}
          disabled={!canAutoGenerate}
          className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            canAutoGenerate
              ? 'bg-gradient-to-r from-[var(--color-primary)] to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
              : 'bg-[var(--color-surface-variant)] text-[var(--color-text-tertiary)] cursor-not-allowed'
          }`}
          title={!canAutoGenerate ? '请先填写小说名称和类型' : '全自动生成整部小说'}
        >
          <span className="material-symbols-outlined text-lg">smart_toy</span>
          全自动生成
        </button>
      </div>

      {/* Auto generation config dialog */}
      {autoDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-surface)] rounded-lg shadow-xl w-[400px] flex flex-col border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-separator)]">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">全自动生成设置</h2>
              <button onClick={() => setAutoDialogOpen(false)} className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-tertiary)]">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  将按照"架构 → 小说大纲 → 章节目录 → 逐章草稿/审校/改写 → 定稿 → 全文审核"的流程全自动执行。
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  每章审校改写轮次
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setReviewRounds(Math.max(1, reviewRounds - 1))} disabled={reviewRounds <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30">
                    <span className="material-symbols-outlined text-base">remove</span>
                  </button>
                  <span className="text-2xl font-bold text-[var(--color-primary)] w-8 text-center">{reviewRounds}</span>
                  <button onClick={() => setReviewRounds(Math.min(5, reviewRounds + 1))} disabled={reviewRounds >= 5}
                    className="w-8 h-8 flex items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30">
                    <span className="material-symbols-outlined text-base">add</span>
                  </button>
                  <span className="text-xs text-[var(--color-text-tertiary)]">轮（范围 1~5）</span>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                  {reviewRounds === 1
                    ? '每章：草稿 → 审校1次 → 改写1次 → 定稿'
                    : `每章：草稿 → (审校→改写) × ${reviewRounds}轮 → 定稿`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border-separator)]">
              <button onClick={() => setAutoDialogOpen(false)} className="px-4 py-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] rounded">
                取消
              </button>
              <button onClick={handleAutoConfigConfirm} className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded hover:opacity-90">
                开始生成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final confirmation dialog */}
      <ConfirmDialog
        open={autoConfirmOpen}
        title="确认全自动生成"
        message={`即将开始全自动生成《${params.topic || '未命名'}》，共 ${params.chapterCount} 章，每章 ${reviewRounds} 轮审校改写。此过程耗时较长，请确保网络稳定。确认开始？`}
        confirmLabel="确认开始"
        onConfirm={handleAutoFinalConfirm}
        onCancel={() => setAutoConfirmOpen(false)}
      />

      {/* Error dialog */}
      {autoError && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-surface)] rounded-lg shadow-xl w-[420px] flex flex-col border border-[var(--color-error)]/40">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-separator)]">
              <span className="material-symbols-outlined text-lg text-[var(--color-error)]">error</span>
              <h2 className="text-base font-semibold text-[var(--color-error)]">自动生成出错</h2>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed break-all">{autoError}</p>
            </div>
            <div className="flex items-center justify-end px-4 py-3 border-t border-[var(--color-border-separator)]">
              <button
                onClick={() => setAutoError(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-on-error)] bg-[var(--color-error)] rounded hover:opacity-90"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
