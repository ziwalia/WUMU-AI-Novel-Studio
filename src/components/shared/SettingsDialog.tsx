import { useState } from 'react'
import { useUIStore, type FontConfig, type GenreItem } from '@/stores/uiStore'
import type { WritingStyleItem } from '@/data/defaultWritingStyles'

const FONT_OPTIONS = [
  'SimSun', 'Microsoft YaHei', 'KaiTi', 'FangSong', 'SimHei',
  'Arial', 'Georgia', 'Times New Roman',
]

type SettingsTab = 'font' | 'genre' | 'writingStyle'
const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: 'font', label: '字体设置', icon: 'text_fields' },
  { key: 'genre', label: '类型管理', icon: 'category' },
  { key: 'writingStyle', label: '文笔文风管理', icon: 'brush' },
]

export function SettingsDialog() {
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const fontGlobal = useUIStore((s) => s.fontGlobal)
  const setFontGlobal = useUIStore((s) => s.setFontGlobal)
  const genres = useUIStore((s) => s.genres)
  const addGenre = useUIStore((s) => s.addGenre)
  const updateGenre = useUIStore((s) => s.updateGenre)
  const removeGenre = useUIStore((s) => s.removeGenre)
  const writingStyles = useUIStore((s) => s.writingStyles)
  const addWritingStyle = useUIStore((s) => s.addWritingStyle)
  const updateWritingStyle = useUIStore((s) => s.updateWritingStyle)
  const removeWritingStyle = useUIStore((s) => s.removeWritingStyle)

  const [activeTab, setActiveTab] = useState<SettingsTab>('font')

  if (!settingsOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSettingsOpen(false)}>
      <div
        className="bg-[var(--color-surface)] rounded-lg shadow-xl flex flex-col border border-[var(--color-border)]"
        style={{ width: '90vw', minWidth: '920px', maxWidth: '1200px', height: '80vh', fontFamily: "'Microsoft YaHei', sans-serif", fontWeight: 600 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-separator)]">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">设置</h2>
          <button onClick={() => setSettingsOpen(false)} className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex border-b border-[var(--color-border-separator)] px-5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[var(--color-primary)] text-[var(--color-text-primary)] font-bold'
                  : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'font' && <FontSection font={fontGlobal} onChange={setFontGlobal} />}
          {activeTab === 'genre' && <GenreSection genres={genres} onAdd={addGenre} onUpdate={updateGenre} onRemove={removeGenre} />}
          {activeTab === 'writingStyle' && (
            <WritingStyleSection
              styles={writingStyles}
              onAdd={addWritingStyle}
              onUpdate={updateWritingStyle}
              onRemove={removeWritingStyle}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function FontSection({ font, onChange }: { font: FontConfig; onChange: (c: Partial<FontConfig>) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--color-text-tertiary)] w-10 shrink-0">字体</span>
        <select
          value={font.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="flex-1 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text-primary)]"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--color-text-tertiary)] w-10 shrink-0">字号</span>
        <input
          type="range"
          value={font.fontSize}
          min={10}
          max={40}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="flex-1"
        />
        <span className="text-xs text-[var(--color-text-tertiary)] w-12 text-right">{font.fontSize}px</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--color-text-tertiary)] w-10 shrink-0">行高</span>
        <input
          type="range"
          value={font.lineHeight}
          min={1}
          max={3}
          step={0.1}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          className="flex-1"
        />
        <span className="text-xs text-[var(--color-text-tertiary)] w-12 text-right">{font.lineHeight}</span>
      </div>
      <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded p-3 mt-2">
        <p style={{ fontFamily: font.fontFamily, fontSize: `${font.fontSize}px`, lineHeight: font.lineHeight }} className="text-[var(--color-text-primary)]">
          预览文字：天地玄黄，宇宙洪荒。日月盈昃，辰宿列张。The quick brown fox jumps over the lazy dog.
        </p>
      </div>
    </div>
  )
}

type Channel = 'male' | 'female'

const emptyForm = (): GenreItem => ({
  name: '',
  channel: 'male',
  tagDescription: '',
  definition: '',
  suggestedElements: '',
  notSuggestedElements: '',
  popularSettings: '',
})

function GenreSection({ genres, onAdd, onUpdate, onRemove }: {
  genres: GenreItem[]
  onAdd: (g: GenreItem) => void
  onUpdate: (i: number, g: GenreItem) => void
  onRemove: (i: number) => void
}) {
  const [channel, setChannel] = useState<Channel>('male')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<GenreItem>(emptyForm())

  const filtered = genres.map((g, i) => ({ ...g, _idx: i })).filter((g) => g.channel === channel)

  const startEdit = (idx: number) => {
    const g = genres[idx]!
    setEditingIdx(idx)
    setForm({ ...g })
    setAdding(false)
  }

  const startAdd = () => {
    setAdding(true)
    setForm({ ...emptyForm(), channel })
    setEditingIdx(null)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editingIdx !== null) {
      onUpdate(editingIdx, { ...form })
      setEditingIdx(null)
    } else if (adding) {
      onAdd({ ...form })
      setAdding(false)
    }
    setForm(emptyForm())
  }

  const cancelEdit = () => {
    setEditingIdx(null)
    setAdding(false)
    setForm(emptyForm())
  }

  const updateForm = (field: keyof GenreItem, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Channel tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => { setChannel('male'); cancelEdit() }}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors ${
            channel === 'male'
              ? 'bg-[var(--color-primary)] text-white font-bold'
              : 'bg-[var(--color-surface-container-lowest)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
        >
          <span className="material-symbols-outlined text-base">male</span>
          男频 ({genres.filter((g) => g.channel === 'male').length})
        </button>
        <button
          onClick={() => { setChannel('female'); cancelEdit() }}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors ${
            channel === 'female'
              ? 'bg-[var(--color-primary)] text-white font-bold'
              : 'bg-[var(--color-surface-container-lowest)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
          }`}
        >
          <span className="material-symbols-outlined text-base">female</span>
          女频 ({genres.filter((g) => g.channel === 'female').length})
        </button>
        <div className="flex-1" />
        {!adding && editingIdx === null && (
          <button
            onClick={startAdd}
            className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--color-primary)] font-bold hover:bg-[var(--color-surface-hover)] rounded-md border border-[var(--color-primary)]/30"
          >
            <span className="material-symbols-outlined text-base">add</span>
            新增类别
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {adding && (
        <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-primary)] rounded-lg p-4 mb-4 space-y-3">
          <div className="text-sm font-bold text-[var(--color-primary)] mb-2">
            {editingIdx !== null ? '编辑类别' : `新增${channel === 'male' ? '男频' : '女频'}类别`}
          </div>
          <FormRow label="分类名称">
            <input value={form.name} onChange={(e) => updateForm('name', e.target.value)}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text-primary)]" />
          </FormRow>
          <FormRow label="标签说明">
            <input value={form.tagDescription} onChange={(e) => updateForm('tagDescription', e.target.value)}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text-primary)]" />
          </FormRow>
          <FormRow label="分类定义">
            <textarea value={form.definition} onChange={(e) => updateForm('definition', e.target.value)} rows={2}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text-primary)] resize-none" />
          </FormRow>
          <FormRow label="建议元素">
            <textarea value={form.suggestedElements} onChange={(e) => updateForm('suggestedElements', e.target.value)} rows={2}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text-primary)] resize-none" />
          </FormRow>
          <FormRow label="不建议元素">
            <textarea value={form.notSuggestedElements} onChange={(e) => updateForm('notSuggestedElements', e.target.value)} rows={2}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text-primary)] resize-none" />
          </FormRow>
          <FormRow label="流行设定">
            <textarea value={form.popularSettings} onChange={(e) => updateForm('popularSettings', e.target.value)} rows={2}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text-primary)] resize-none" />
          </FormRow>
          <div className="flex items-center gap-2 justify-end pt-1">
            <button onClick={cancelEdit} className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] px-3 py-1.5">取消</button>
            <button onClick={handleSave} className="text-sm bg-[var(--color-primary)] text-white font-bold px-4 py-1.5 rounded-md hover:opacity-90">
              {editingIdx !== null ? '保存修改' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto border border-[var(--color-border)] rounded-lg">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-surface-container-lowest)] border-b border-[var(--color-border)]">
              <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider w-28">分类名称</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">分类定义</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider w-36">标签说明</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">建议元素</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">不建议元素</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">流行设定</th>
              <th className="text-center px-2 py-2.5 w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => {
              const isEditing = editingIdx === g._idx
              if (isEditing) {
                return (
                  <tr key={g._idx} className="border-b border-[var(--color-border)] bg-[var(--color-primary)]/5">
                    <td className="px-3 py-2 align-top">
                      <input value={form.name} onChange={(e) => updateForm('name', e.target.value)}
                        className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-primary)] rounded px-1.5 py-1 text-[var(--color-text-primary)]" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <textarea value={form.definition} onChange={(e) => updateForm('definition', e.target.value)} rows={2}
                        className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-primary)] rounded px-1.5 py-1 text-[var(--color-text-primary)] resize-none" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input value={form.tagDescription} onChange={(e) => updateForm('tagDescription', e.target.value)}
                        className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-primary)] rounded px-1.5 py-1 text-[var(--color-text-primary)]" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <textarea value={form.suggestedElements} onChange={(e) => updateForm('suggestedElements', e.target.value)} rows={2}
                        className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-primary)] rounded px-1.5 py-1 text-[var(--color-text-primary)] resize-none" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <textarea value={form.notSuggestedElements} onChange={(e) => updateForm('notSuggestedElements', e.target.value)} rows={2}
                        className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-primary)] rounded px-1.5 py-1 text-[var(--color-text-primary)] resize-none" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <textarea value={form.popularSettings} onChange={(e) => updateForm('popularSettings', e.target.value)} rows={2}
                        className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-primary)] rounded px-1.5 py-1 text-[var(--color-text-primary)] resize-none" />
                    </td>
                    <td className="px-2 py-2 text-center align-top">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={handleSave} className="p-1 text-[var(--color-success)] hover:bg-[var(--color-surface-hover)] rounded" title="保存">
                          <span className="material-symbols-outlined text-sm">check</span>
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] rounded" title="取消">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={g._idx} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="px-3 py-2.5 align-top font-bold text-[var(--color-text-primary)] whitespace-nowrap">{g.name}</td>
                  <td className="px-3 py-2.5 align-top text-[var(--color-text-secondary)]" style={{ maxWidth: 200 }}>
                    <div className="line-clamp-3">{g.definition}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top text-[var(--color-text-tertiary)]" style={{ maxWidth: 140 }}>
                    <div className="line-clamp-2">{g.tagDescription}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top text-[var(--color-success)]" style={{ maxWidth: 180 }}>
                    <div className="line-clamp-3">{g.suggestedElements}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top text-[var(--color-error)]" style={{ maxWidth: 180 }}>
                    <div className="line-clamp-3">{g.notSuggestedElements}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top text-[var(--color-primary)]" style={{ maxWidth: 180 }}>
                    <div className="line-clamp-3">{g.popularSettings}</div>
                  </td>
                  <td className="px-2 py-2.5 text-center align-top">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => startEdit(g._idx)} className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] rounded" title="编辑">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => { if (confirm(`确定删除"${g.name}"?`)) onRemove(g._idx) }} className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-hover)] rounded" title="删除">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-3xl block mb-2">category</span>
            暂无{channel === 'male' ? '男频' : '女频'}分类数据
          </div>
        )}
      </div>
    </div>
  )
}

const emptyStyleForm = (): WritingStyleItem => ({ name: '', description: '' })

function WritingStyleSection({ styles, onAdd, onUpdate, onRemove }: {
  styles: WritingStyleItem[]
  onAdd: (s: WritingStyleItem) => void
  onUpdate: (i: number, s: WritingStyleItem) => void
  onRemove: (i: number) => void
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<WritingStyleItem>(emptyStyleForm())

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setForm({ ...styles[idx]! })
    setAdding(false)
  }

  const startAdd = () => {
    setAdding(true)
    setForm(emptyStyleForm())
    setEditingIdx(null)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editingIdx !== null) {
      onUpdate(editingIdx, { ...form })
      setEditingIdx(null)
    } else if (adding) {
      onAdd({ ...form })
      setAdding(false)
    }
    setForm(emptyStyleForm())
  }

  const cancelEdit = () => {
    setEditingIdx(null)
    setAdding(false)
    setForm(emptyStyleForm())
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-[var(--color-text-tertiary)]">
          共 {styles.length} 种文笔风格
        </span>
        <div className="flex-1" />
        {!adding && editingIdx === null && (
          <button
            onClick={startAdd}
            className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--color-primary)] font-bold hover:bg-[var(--color-surface-hover)] rounded-md border border-[var(--color-primary)]/30"
          >
            <span className="material-symbols-outlined text-base">add</span>
            新增文风
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-primary)] rounded-lg p-4 mb-4 space-y-3">
          <div className="text-sm font-bold text-[var(--color-primary)] mb-2">新增文笔风格</div>
          <FormRow label="风格名称">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text-primary)]"
              placeholder="如：豪放热血风" />
          </FormRow>
          <FormRow label="风格描述">
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={8}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-[var(--color-text-primary)] resize-none"
              placeholder="详细描述该文笔风格的要求、特点，可包含参考例句"
            />
          </FormRow>
          <div className="flex items-center gap-2 justify-end pt-1">
            <button onClick={cancelEdit} className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] px-3 py-1.5">取消</button>
            <button onClick={handleSave} className="text-sm bg-[var(--color-primary)] text-white font-bold px-4 py-1.5 rounded-md hover:opacity-90">添加</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto border border-[var(--color-border)] rounded-lg">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-surface-container-lowest)] border-b border-[var(--color-border)]">
              <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider w-40">风格名称</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">风格描述</th>
              <th className="text-center px-2 py-2.5 w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {styles.map((s, i) => {
              if (editingIdx === i) {
                return (
                  <tr key={i} className="border-b border-[var(--color-border)] bg-[var(--color-primary)]/5">
                    <td className="px-3 py-2 align-top">
                      <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-primary)] rounded px-1.5 py-1 text-[var(--color-text-primary)]" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={6}
                        className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-primary)] rounded px-1.5 py-1 text-[var(--color-text-primary)] resize-none" />
                    </td>
                    <td className="px-2 py-2 text-center align-top">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={handleSave} className="p-1 text-[var(--color-success)] hover:bg-[var(--color-surface-hover)] rounded" title="保存">
                          <span className="material-symbols-outlined text-sm">check</span>
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] rounded" title="取消">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={i} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="px-3 py-2.5 align-top font-bold text-[var(--color-text-primary)] whitespace-nowrap">{s.name}</td>
                  <td className="px-3 py-2.5 align-top text-[var(--color-text-secondary)]">
                    <div className="line-clamp-4 whitespace-pre-line">{s.description}</div>
                  </td>
                  <td className="px-2 py-2.5 text-center align-top">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => startEdit(i)} className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] rounded" title="编辑">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => { if (confirm(`确定删除"${s.name}"?`)) onRemove(i) }} className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-hover)] rounded" title="删除">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {styles.length === 0 && (
          <div className="text-center py-8 text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-3xl block mb-2">brush</span>
            暂无文笔风格数据
          </div>
        )}
      </div>
    </div>
  )
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-[var(--color-text-tertiary)] w-20 shrink-0 pt-1.5 text-right">{label}</span>
      {children}
    </div>
  )
}
