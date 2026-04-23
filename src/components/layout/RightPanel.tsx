import { useState, useMemo } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useNovelStore } from '@/stores/novelStore'
import { useCharacters, useRelationships, useCharacterSnapshots, useForeshadowings, createCharacter, addCharacter, updateCharacter, removeCharacter, addRelationship, removeRelationship } from '@/stores/characterStore'
import { STEP_LABELS, WEIGHT_LABELS, RELATIONSHIP_TYPES, REL_COLORS, FORESHADOWING_LABELS } from '@/types'
import type { CharacterWeight, CharacterRelationship, RelationshipType } from '@/types'
import { buildSystemPrompt, architecturePrompt, volumeOutlinePrompt, blueprintPrompt, draftPrompt, reviewPrompt, rewritePrompt, buildProjectContext } from '@/services/prompts'

function ContextTab() {
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const genres = useUIStore((s) => s.genres)
  const foreshadowings = useForeshadowings()
  const project = projects.find((p) => p.id === activeProjectId)
  if (!project) return <EmptyHint text="请先选择或创建项目" />

  const currentStep = project.currentStep
  const params = project.params
  const systemPrompt = buildSystemPrompt()
  const globalContext = buildProjectContext(params, genres)

  let inputPrompt = ''
  let outputLabel = ''
  let outputContent = ''

  switch (currentStep) {
    case 'project-info':
      inputPrompt = '(用户直接输入，无LLM调用)'
      outputLabel = '项目参数'
      outputContent = globalContext
      break
    case 'architecture':
      inputPrompt = architecturePrompt(params, genres)
      outputLabel = '架构输出'
      outputContent = project.architecture || ''
      break
    case 'volume':
      inputPrompt = volumeOutlinePrompt(
        params,
        project.architecture || '',
        genres,
        project.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo })),
        project.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description })),
      )
      outputLabel = '卷纲输出'
      outputContent = project.volumeOutline || ''
      break
    case 'blueprint':
      inputPrompt = blueprintPrompt(
        params,
        project.volumeOutline || '',
        genres,
        project.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo })),
        project.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description })),
      )
      outputLabel = '目录输出'
      outputContent = project.blueprint || ''
      break
    case 'draft': {
      const idx = project.currentChapterIndex
      const prevChapter = idx > 0 ? project.chapters[idx - 1] : undefined
      const draftCtx: import('@/services/prompts').DraftContext = {}
      if (project.runningSummary) draftCtx.runningSummary = project.runningSummary
      if (project.nextChapterHints?.[idx - 1]) draftCtx.nextChapterHint = project.nextChapterHints[idx - 1]
      // Recent 10 summaries
      const rStart = Math.max(0, idx - 10)
      const rSum: { index: number; summary: string }[] = []
      for (let i = rStart; i < idx; i++) {
        const m = project.chapterMetas[i]
        if (m?.summary) rSum.push({ index: i, summary: m.summary })
      }
      if (rSum.length > 0) draftCtx.recentSummaries = rSum
      // Prev 2 endings
      const ends: { index: number; ending: string }[] = []
      for (let i = Math.max(0, idx - 2); i < idx; i++) {
        const ch = project.chapters[i]
        if (ch) ends.push({ index: i, ending: ch.slice(-500) })
      }
      if (ends.length > 0) draftCtx.prevChapterEndings = ends
      inputPrompt = draftPrompt(
        params,
        project.blueprint || '',
        idx,
        prevChapter?.slice(-500),
        Object.keys(draftCtx).length > 0 ? draftCtx : undefined,
        genres,
        project.characters.map((c) => ({ name: c.name, weight: c.weight, age: c.age, personality: c.personality, abilities: c.abilities, basicInfo: c.basicInfo })),
        project.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type, description: r.description })),
      )
      outputLabel = `第${idx + 1}章草稿`
      outputContent = project.chapters[idx] || ''
      break
    }
    case 'review': {
      const idx = project.currentChapterIndex
      const charSummary = project.characters.length > 0
        ? project.characters.map((c) => `${c.name}(${c.weight}): ${c.basicInfo}`).join('\n')
        : params.coreCharacters
      const reviewCtx: Parameters<typeof reviewPrompt>[3] = {}
      if (project.runningSummary) reviewCtx.runningSummary = project.runningSummary
      const rStart2 = Math.max(0, idx - 10)
      const rSum2: { index: number; summary: string }[] = []
      for (let i = rStart2; i < idx; i++) {
        const m = project.chapterMetas[i]
        if (m?.summary) rSum2.push({ index: i, summary: m.summary })
      }
      if (rSum2.length > 0) reviewCtx.recentSummaries = rSum2
      inputPrompt = reviewPrompt(project.chapters[idx] || '', charSummary, undefined,
        Object.keys(reviewCtx).length > 0 ? reviewCtx : undefined)
      outputLabel = `第${idx + 1}章审查`
      outputContent = project.reviewResults[idx] || ''
      break
    }
    case 'rewrite': {
      const idx = project.currentChapterIndex
      inputPrompt = rewritePrompt(project.chapters[idx] || '', project.reviewResults[idx] || '')
      outputLabel = `第${idx + 1}章改写`
      outputContent = ''
      break
    }
    case 'finalize':
      inputPrompt = '(纯状态管理，无LLM调用)'
      outputLabel = ''
      outputContent = ''
      break
    case 'export':
      inputPrompt = '(纯文件导出，无LLM调用)'
      outputLabel = ''
      outputContent = ''
      break
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Chapter context panel (draft/review/rewrite steps) */}
      {['draft', 'review', 'rewrite'].includes(currentStep) && (() => {
        const idx = project.currentChapterIndex
        const prevMeta = idx > 0 ? project.chapterMetas[idx - 1] : undefined
        const currMeta = project.chapterMetas[idx]

        return (
          <>
            {/* Running summary — show snapshot for current chapter */}
            {(() => {
              const snapshot = project.chapterMetas[idx]?.runningSummarySnapshot
              return snapshot ? (
                <InfoBox title="当前递进摘要" defaultHeight={80}>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed">{snapshot}</p>
                </InfoBox>
              ) : null
            })()}
            <InfoBox title={`第${idx + 1}章 章节信息`} defaultHeight={80}>
              <div className="space-y-2">
                {prevMeta?.summary && (
                  <div>
                    <span className="text-[var(--color-text-tertiary)] font-medium">前章摘要</span>
                    <p className="text-[var(--color-text-secondary)] mt-0.5">{prevMeta.summary}</p>
                  </div>
                )}
                {currMeta?.timeline && (
                  <div>
                    <span className="text-[var(--color-text-tertiary)] font-medium">当前时间线</span>
                    <p className="text-[var(--color-text-secondary)] mt-0.5">{currMeta.timeline}</p>
                  </div>
                )}
                {foreshadowings.length > 0 && (
                  <div>
                    <span className="text-[var(--color-text-tertiary)] font-medium">
                      伏笔管理 ({foreshadowings.filter(f => f.status === 'planted').length} 未收束 / {foreshadowings.filter(f => f.status === 'resolved').length} 已收束)
                    </span>
                    <div className="space-y-0.5 mt-0.5">
                      {foreshadowings.map((f) => (
                        <div key={f.id} className={`px-1.5 py-0.5 rounded ${f.status === 'planted' ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'}`}>
                          <span className="font-medium">[{FORESHADOWING_LABELS[f.type]}]</span> {f.content}
                          {f.status === 'resolved' && <span className="ml-1 opacity-70">(第{f.resolvedChapter! + 1}章收束)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!prevMeta?.summary && !currMeta?.timeline && foreshadowings.length === 0 && !project.runningSummary && (
                  <p className="text-[var(--color-text-tertiary)]">暂无信息（草稿生成后自动提取）</p>
                )}
              </div>
            </InfoBox>
          </>
        )
      })()}

      {/* Global info */}
      <InfoBox title="全局信息" defaultHeight={100}>
        <pre className="whitespace-pre-wrap text-[var(--color-text-secondary)] leading-relaxed">{globalContext}</pre>
      </InfoBox>

      {/* System prompt */}
      <InfoBox title="System Prompt" defaultHeight={80}>
        <pre className="whitespace-pre-wrap text-[var(--color-text-secondary)] leading-relaxed">{systemPrompt}</pre>
      </InfoBox>

      {/* Step input prompt */}
      {inputPrompt && (
        <InfoBox title={`输入 Prompt (${STEP_LABELS[currentStep]})`} defaultHeight={120}>
          <pre className="whitespace-pre-wrap text-[var(--color-text-secondary)] leading-relaxed">{inputPrompt}</pre>
        </InfoBox>
      )}

      {/* Step output */}
      {outputContent && outputLabel && (
        <InfoBox title={outputLabel} defaultHeight={120}>
          <pre className="whitespace-pre-wrap text-[var(--color-text-secondary)] leading-relaxed">{outputContent}</pre>
        </InfoBox>
      )}
    </div>
  )
}

function InfoBox({ title, defaultHeight, children }: { title: string; defaultHeight: number; children: React.ReactNode }) {
  const [height, setHeight] = useState(defaultHeight)
  const [dragging, setDragging] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    const startY = e.clientY
    const startH = height

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY
      setHeight(Math.max(40, startH + delta))
    }
    const onUp = () => {
      setDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="border-b border-[var(--color-border-separator)]">
      <div className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1 px-1">
        {title}
      </div>
      <div
        className="overflow-y-auto bg-[var(--color-surface-container-lowest)] rounded px-2 py-1 mx-1 mb-1"
        style={{ height: `${height}px`, minHeight: '40px', fontFamily: 'var(--font-content)', fontSize: 'var(--font-content-size)', lineHeight: 'var(--font-content-lh)' }}
      >
        {children}
      </div>
      <div
        className={`h-1.5 mx-1 cursor-row-resize flex items-center justify-center ${dragging ? 'bg-[var(--color-primary)]/20' : 'hover:bg-[var(--color-surface-hover)]'}`}
        onMouseDown={handleMouseDown}
      >
        <span className="material-symbols-outlined text-[10px] text-[var(--color-text-tertiary)]">drag_handle</span>
      </div>
    </div>
  )
}

const WEIGHT_ORDER: CharacterWeight[] = ['protagonist', 'major', 'supporting', 'minor']
const WEIGHT_ICONS: Record<CharacterWeight, string> = {
  protagonist: 'star',
  major: 'local_fire_department',
  supporting: 'person',
  minor: 'person_outline',
}

function CharactersTab() {
  const characters = useCharacters()
  const relationships = useRelationships()
  const snapshots = useCharacterSnapshots()
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWeight, setNewWeight] = useState<CharacterWeight>('supporting')
  const [viewingSnapshot, setViewingSnapshot] = useState<number | null>(null)

  // When viewing a snapshot, get snapshot data instead of live data
  const displayChars = viewingSnapshot !== null
    ? projects.find((p) => p.id === activeProjectId)?.chapterMetas[viewingSnapshot]?.characterSnapshot?.characters ?? characters
    : characters
  const displayRels = viewingSnapshot !== null
    ? projects.find((p) => p.id === activeProjectId)?.chapterMetas[viewingSnapshot]?.characterSnapshot?.relationships ?? relationships
    : relationships

  if (!activeProjectId) return <EmptyHint text="请先选择或创建项目" />

  const handleAdd = () => {
    if (!newName.trim()) return
    const char = createCharacter({ name: newName.trim(), weight: newWeight })
    addCharacter(char)
    setNewName('')
    setAdding(false)
    setEditingId(char.id)
  }

  const sorted = [...displayChars].sort(
    (a, b) => WEIGHT_ORDER.indexOf(a.weight) - WEIGHT_ORDER.indexOf(b.weight)
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto p-1" style={{ fontWeight: 600 }}>
      {/* Snapshot switcher */}
      {snapshots.length > 0 && (
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <button
            onClick={() => setViewingSnapshot(null)}
            className={`text-xs px-1.5 py-0.5 rounded ${viewingSnapshot === null ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container-lowest)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'}`}
          >
            实时状态
          </button>
          {snapshots.map((s) => (
            <button
              key={s.chapterIndex}
              onClick={() => setViewingSnapshot(viewingSnapshot === s.chapterIndex ? null : s.chapterIndex)}
              className={`text-xs px-1.5 py-0.5 rounded ${viewingSnapshot === s.chapterIndex ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container-lowest)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'}`}
            >
              {s.label}
            </button>
          ))}
          {viewingSnapshot !== null && (
            <span className="text-[10px] text-[var(--color-text-tertiary)] ml-1">
              📖 只读快照
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 mb-2">
        {adding ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="角色名"
              className="flex-1 text-base bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[var(--color-text-primary)]"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <select
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value as CharacterWeight)}
              className="text-base bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded px-1 py-1 text-[var(--color-text-primary)]"
            >
              {WEIGHT_ORDER.map((w) => (
                <option key={w} value={w}>{WEIGHT_LABELS[w]}</option>
              ))}
            </select>
            <button onClick={handleAdd} className="p-1 text-[var(--color-success)] hover:bg-[var(--color-surface-hover)] rounded">
              <span className="material-symbols-outlined text-sm">check</span>
            </button>
            <button onClick={() => { setAdding(false); setNewName('') }} className="p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] rounded">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] px-1 py-1 hover:bg-[var(--color-surface-hover)] rounded w-full"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            添加角色
          </button>
        )}
      </div>

      <div className="space-y-1">
        {sorted.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            relationships={displayRels}
            isEditing={viewingSnapshot === null && editingId === char.id}
            onEdit={() => viewingSnapshot === null && setEditingId(editingId === char.id ? null : char.id)}
            onDelete={() => viewingSnapshot === null && removeCharacter(char.id)}
            onSave={(updates) => { updateCharacter(char.id, updates); setEditingId(null) }}
          />
        ))}
      </div>

      {displayChars.length >= 2 && (
        <>
          <div className="flex items-center gap-2 mt-3 mb-1 px-1">
            <div className="flex-1 h-px bg-[var(--color-border-separator)]" />
            <span className="text-xs text-[var(--color-text-tertiary)]">关系图谱</span>
            <div className="flex-1 h-px bg-[var(--color-border-separator)]" />
          </div>
          <RelationshipGraph characters={displayChars} relationships={displayRels} />
          <RelationshipList characters={displayChars} relationships={displayRels} readOnly={viewingSnapshot !== null} />
        </>
      )}

      {displayChars.length === 0 && !adding && (
        <div className="text-center py-6">
          <span className="material-symbols-outlined text-2xl text-[var(--color-text-tertiary)] block mb-1">group</span>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            完成架构生成后可自动提取角色，或手动添加
          </p>
        </div>
      )}
    </div>
  )
}

function CharacterCard({ character, relationships, isEditing, onEdit, onDelete, onSave }: {
  character: import('@/types').Character
  relationships: CharacterRelationship[]
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
  onSave: (updates: Partial<import('@/types').Character>) => void
}) {
  const [editName, setEditName] = useState(character.name)
  const [editAge, setEditAge] = useState(character.age)
  const [editPersonality, setEditPersonality] = useState(character.personality)
  const [editAbilities, setEditAbilities] = useState(Array.isArray(character.abilities) ? character.abilities.join('、') : String(character.abilities ?? ''))
  const [editInfo, setEditInfo] = useState(character.basicInfo)

  if (isEditing) {
    return (
      <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-primary)] rounded p-2 space-y-1.5">
        <div className="flex items-center gap-1">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-primary)] font-medium"
          />
          <button onClick={() => onSave({
            name: editName,
            age: editAge,
            personality: editPersonality,
            abilities: editAbilities.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
            basicInfo: editInfo,
          })} className="p-0.5 text-[var(--color-success)]">
            <span className="material-symbols-outlined text-sm">check</span>
          </button>
          <button onClick={onEdit} className="p-0.5 text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-text-tertiary)] w-10 shrink-0">年龄</span>
          <input value={editAge} onChange={(e) => setEditAge(e.target.value)} placeholder="如：18岁"
            className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-secondary)]" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-text-tertiary)] w-10 shrink-0">性格</span>
          <input value={editPersonality} onChange={(e) => setEditPersonality(e.target.value)} placeholder="如：坚毅果断"
            className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-secondary)]" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-text-tertiary)] w-10 shrink-0">能力</span>
          <input value={editAbilities} onChange={(e) => setEditAbilities(e.target.value)} placeholder="用顿号分隔"
            className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-secondary)]" />
        </div>
        <textarea value={editInfo} onChange={(e) => setEditInfo(e.target.value)} placeholder="详细描述..."
          rows={2} className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-secondary)] resize-none" />
      </div>
    )
  }

  const charRels = relationships.filter((r) => r.from === character.name || r.to === character.name)
  const tags: string[] = []
  if (character.age) tags.push(character.age)
  if (character.personality) tags.push(character.personality.slice(0, 8))
  if (character.abilities.length > 0) tags.push(character.abilities[0]!)

  return (
    <div
      className="px-2 py-1.5 rounded hover:bg-[var(--color-surface-hover)] cursor-pointer group transition-colors"
      onClick={onEdit}
    >
      <div className="flex items-center gap-1.5">
        <span className={`material-symbols-outlined text-sm ${
          character.weight === 'protagonist' ? 'text-[var(--color-primary)]' :
          character.weight === 'major' ? 'text-[var(--color-success)]' :
          'text-[var(--color-text-tertiary)]'
        }`}>
          {WEIGHT_ICONS[character.weight]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-base font-medium text-[var(--color-text-primary)] truncate">{character.name}</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">{WEIGHT_LABELS[character.weight]}</span>
          </div>
          {tags.length > 0 && (
            <p className="text-xs text-[var(--color-text-tertiary)] truncate">{tags.join(' · ')}</p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-0.5 opacity-0 group-hover:opacity-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-opacity"
        >
          <span className="material-symbols-outlined text-xs">close</span>
        </button>
      </div>
      {charRels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 ml-6">
          {charRels.map((r) => {
            const otherName = r.from === character.name ? r.to : r.from
            return (
              <span key={r.id} className="text-xs px-1.5 py-0.5 rounded-full border" style={{ borderColor: REL_COLORS[r.type], color: REL_COLORS[r.type] }}>
                {otherName}·{r.type}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RelationshipGraph({ characters, relationships }: { characters: { name: string; weight: CharacterWeight }[]; relationships: CharacterRelationship[] }) {
  const positions = useMemo(() => {
    if (characters.length < 2) return new Map<string, { x: number; y: number }>()
    const cx = 120, cy = 95
    const map = new Map<string, { x: number; y: number }>()
    const protagonist = characters.find((c) => c.weight === 'protagonist')
    const majors = characters.filter((c) => c.weight === 'major')
    const others = characters.filter((c) => c.weight !== 'protagonist' && c.weight !== 'major')

    if (protagonist) map.set(protagonist.name, { x: cx, y: cy })

    const ring1 = majors.slice(0, 6)
    const ring2 = [...majors.slice(6), ...others]
    const r1 = 55, r2 = 90

    ring1.forEach((c, i) => {
      const a = (2 * Math.PI * i) / ring1.length - Math.PI / 2
      map.set(c.name, { x: cx + r1 * Math.cos(a), y: cy + r1 * Math.sin(a) })
    })
    ring2.forEach((c, i) => {
      const a = (2 * Math.PI * i) / ring2.length - Math.PI / 4
      map.set(c.name, { x: cx + r2 * Math.cos(a), y: cy + r2 * Math.sin(a) })
    })
    return map
  }, [characters])

  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  if (characters.length < 2 || relationships.length === 0) return null

  const relatedNames = new Set(relationships.flatMap((r) => [r.from, r.to]))
  const visibleChars = characters.filter((c) => relatedNames.has(c.name))

  return (
    <div className="bg-[var(--color-surface-container-lowest)] rounded border border-[var(--color-border)] mx-1 mb-1" style={{ height: 200 }}>
      <svg viewBox="0 0 240 190" className="w-full h-full">
        {relationships.map((r) => {
          const p1 = positions.get(r.from)
          const p2 = positions.get(r.to)
          if (!p1 || !p2) return null
          const dimmed = hoveredNode && r.from !== hoveredNode && r.to !== hoveredNode
          return (
            <line key={r.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={REL_COLORS[r.type]} strokeWidth={dimmed ? 0.5 : 1.5}
              opacity={dimmed ? 0.15 : 0.7} />
          )
        })}
        {visibleChars.map((c) => {
          const pos = positions.get(c.name)
          if (!pos) return null
          const isHovered = hoveredNode === c.name
          const isProtagonist = c.weight === 'protagonist'
          const isMajor = c.weight === 'major'
          const fill = isProtagonist ? 'var(--color-primary)' : isMajor ? 'var(--color-success)' : 'var(--color-text-tertiary)'
          return (
            <g key={c.name}
              onMouseEnter={() => setHoveredNode(c.name)}
              onMouseLeave={() => setHoveredNode(null)}>
              <circle cx={pos.x} cy={pos.y} r={isProtagonist ? 16 : isMajor ? 12 : 10} fill={fill} opacity={isHovered ? 1 : 0.8} />
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                fill="white" fontSize={isProtagonist ? 10 : 8} fontWeight="bold">
                {c.name.slice(0, 2)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function RelationshipList({ characters, relationships, readOnly }: { characters: { name: string }[]; relationships: CharacterRelationship[]; readOnly?: boolean }) {
  const [addingRel, setAddingRel] = useState(false)
  const [relFrom, setRelFrom] = useState('')
  const [relTo, setRelTo] = useState('')
  const [relType, setRelType] = useState<RelationshipType>('朋友')
  const [relDesc, setRelDesc] = useState('')

  if (characters.length < 2) return null

  const charNames = characters.map((c) => c.name)
  const grouped = new Map<string, CharacterRelationship[]>()
  for (const r of relationships) {
    const list = grouped.get(r.from) || []
    list.push(r)
    grouped.set(r.from, list)
  }

  const handleAddRel = () => {
    if (!relFrom || !relTo || relFrom === relTo) return
    addRelationship({ from: relFrom, to: relTo, type: relType, description: relDesc })
    setAddingRel(false)
    setRelFrom('')
    setRelTo('')
    setRelDesc('')
  }

  return (
    <div className="px-1 pb-1">
      {relationships.length > 0 && (
        <div className="space-y-0.5 mb-1 max-h-40 overflow-y-auto">
          {relationships.map((r) => (
            <div key={r.id} className="flex items-center gap-1 text-sm group">
              <span className="text-[var(--color-text-secondary)] truncate flex-1">
                <span className="font-medium">{r.from}</span>
                <span className="mx-0.5 text-sm" style={{ color: REL_COLORS[r.type] }}>─{r.type}─</span>
                <span className="font-medium">{r.to}</span>
                {r.description && <span className="text-[var(--color-text-tertiary)] ml-1">{r.description}</span>}
              </span>
              <button onClick={() => removeRelationship(r.id)}
                className={`p-0 ${readOnly ? 'hidden' : 'opacity-0 group-hover:opacity-100'} text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] shrink-0`}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {addingRel ? (
        <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-primary)] rounded p-1.5 space-y-1">
          <div className="flex items-center gap-1">
            <select value={relFrom} onChange={(e) => setRelFrom(e.target.value)}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[var(--color-text-primary)]">
              <option value="">角色A</option>
              {charNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={relType} onChange={(e) => setRelType(e.target.value as RelationshipType)}
              className="text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[var(--color-text-primary)]">
              {RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={relTo} onChange={(e) => setRelTo(e.target.value)}
              className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[var(--color-text-primary)]">
              <option value="">角色B</option>
              {charNames.filter((n) => n !== relFrom).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <input value={relDesc} onChange={(e) => setRelDesc(e.target.value)} placeholder="关系描述（可选）"
            className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[var(--color-text-secondary)]" />
          <div className="flex items-center gap-1 justify-end">
            <button onClick={() => setAddingRel(false)} className="text-sm text-[var(--color-text-tertiary)] px-1">取消</button>
            <button onClick={handleAddRel} className="text-sm text-[var(--color-primary)] font-bold px-1">添加</button>
          </div>
        </div>
      ) : !readOnly ? (
          <button onClick={() => setAddingRel(true)}
            className="flex items-center gap-0.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] w-full px-1 py-0.5 hover:bg-[var(--color-surface-hover)] rounded">
            <span className="material-symbols-outlined text-sm">add</span>
            添加关系
          </button>
      ) : null}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <span className="text-xs text-[var(--color-text-tertiary)]">{text}</span>
    </div>
  )
}

type TabKey = 'context' | 'characters'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'context', label: '上下文', icon: 'code' },
  { key: 'characters', label: '角色', icon: 'group' },
]

export function RightPanel() {
  const collapsed = useUIStore((s) => s.rightPanelCollapsed)
  const setTab = useUIStore((s) => s.setRightPanelTab)
  const activeTab = useUIStore((s) => s.rightPanelTab)
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel)

  return (
    <aside
      className={`flex flex-col h-full bg-[var(--color-surface)] border-l border-[var(--color-border-separator)] transition-all duration-200 ${
        collapsed ? 'w-[40px]' : 'w-full'
      }`}
    >
      {/* Header with toggle */}
      <div className="flex items-center justify-between h-10 px-2 border-b border-[var(--color-border-separator)]">
        {!collapsed && (
          <div className="flex items-center gap-1 flex-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-[var(--radius-sm)] transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[var(--color-surface-selected)] text-[var(--color-text-primary)] font-medium'
                    : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                <span className="material-symbols-outlined text-xs">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={toggleRightPanel}
          className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
          aria-label={collapsed ? '展开右侧面板' : '收起右侧面板'}
        >
          <span className="material-symbols-outlined text-base">
            {collapsed ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>
      </div>

      {/* Tab content */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === 'context' && <ContextTab />}
          {activeTab === 'characters' && <CharactersTab />}
        </div>
      )}
    </aside>
  )
}
