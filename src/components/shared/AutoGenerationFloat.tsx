import { useState, useRef, useEffect, useCallback } from 'react'
import { useNovelStore } from '@/stores/novelStore'
import { useUIStore } from '@/stores/uiStore'
import { abortAutoGeneration } from '@/services/autoGenerationService'
import { ConfirmDialog } from './ConfirmDialog'

export function AutoGenerationFloat() {
  const autoGenerating = useUIStore((s) => s.autoGenerating)
  const activeProjectId = useNovelStore((s) => s.activeProjectId)
  const projects = useNovelStore((s) => s.projects)
  const setAutoGenerating = useUIStore((s) => s.setAutoGenerating)
  const clearProject = useNovelStore((s) => s.clearProject)
  const setCurrentStep = useNovelStore((s) => s.setCurrentStep)
  const addToast = useUIStore((s) => s.addToast)

  const project = projects.find((p) => p.id === activeProjectId)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Drag state
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const floatRef = useRef<HTMLDivElement>(null)

  // Initialize position: center-bottom of viewport
  useEffect(() => {
    if (autoGenerating && pos.x === 0 && pos.y === 0) {
      setPos({
        x: Math.max(100, (window.innerWidth - 320) / 2),
        y: window.innerHeight - 100,
      })
    }
  }, [autoGenerating])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!floatRef.current) return
    setDragging(true)
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    }
    e.preventDefault()
  }, [pos])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: MouseEvent) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)),
      })
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging])

  const handleInterrupt = () => setConfirmOpen(true)

  const handleInterruptConfirm = () => {
    abortAutoGeneration()
    if (activeProjectId) {
      clearProject(activeProjectId)
      setCurrentStep(activeProjectId, 'project-info')
    }
    setAutoGenerating(false)
    setConfirmOpen(false)
    addToast('info', '已中断并清空项目')
  }

  if (!autoGenerating || !project) return null

  return (
    <>
      {/* Invisible overlay to block all interaction */}
      <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: 'auto' }} />

      {/* Draggable floating window */}
      <div
        ref={floatRef}
        className="fixed z-[9999] flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-lg shadow-2xl select-none"
        style={{ left: pos.x, top: pos.y }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="cursor-move flex items-center gap-2 flex-1 min-w-0"
        >
          <span className="material-symbols-outlined text-base text-[var(--color-primary)] animate-spin">progress_activity</span>
          <span className="text-sm font-medium text-[var(--color-text-primary)] whitespace-nowrap truncate">
            正在全自动生成《{project.params.topic || project.name}》
          </span>
        </div>

        <button
          onClick={handleInterrupt}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-[var(--color-error)] rounded hover:opacity-90 transition-opacity"
        >
          中断重来
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="中断全自动生成"
        message="中断将清空本项目所有数据并回到项目信息页面，确定？"
        confirmLabel="确定中断"
        danger
        onConfirm={handleInterruptConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
