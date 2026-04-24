import { useState } from 'react'
import { useLLMStore } from '@/stores/llmStore'
import { LLMSettingsPanel } from '@/components/settings/LLMSettingsPanel'

export function ModelSelector() {
  const configs = useLLMStore((s) => s.configs)
  const activeConfigId = useLLMStore((s) => s.activeConfigId)
  const setActiveConfig = useLLMStore((s) => s.setActiveConfig)
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <div className="flex items-center gap-1">
        {configs.length === 0 ? (
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1 h-8 px-2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] rounded-[var(--radius-sm)] transition-colors"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            配置模型
          </button>
        ) : (
          <>
            <select
              value={activeConfigId ?? ''}
              onChange={(e) => setActiveConfig(e.target.value)}
              className="h-8 px-2 text-xs bg-[var(--color-surface-container)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
              aria-label="选择模型"
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowSettings(true)}
              className="h-8 px-2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] rounded-[var(--radius-sm)] transition-colors whitespace-nowrap"
            >
              LLM 模型配置
            </button>
          </>
        )}
      </div>

      {showSettings && <LLMSettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}
