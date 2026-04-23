import { useSessionStore } from '@/stores/sessionStore'
import { useLLMStore } from '@/stores/llmStore'

export function StatusBar() {
  const isStreaming = useSessionStore((s) => s.isStreaming)
  const inputTokens = useSessionStore((s) => s.inputTokens)
  const outputTokens = useSessionStore((s) => s.outputTokens)
  const configs = useLLMStore((s) => s.configs)
  const activeConfigId = useLLMStore((s) => s.activeConfigId)

  const activeConfig = configs.find((c) => c.id === activeConfigId)

  return (
    <footer
      className="flex items-center h-[var(--statusbar-height)] px-4 bg-[var(--color-surface)] border-t border-[var(--color-border-separator)] text-xs text-[var(--color-text-tertiary)] gap-4"
      role="status"
    >
      <span className="flex items-center gap-1">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isStreaming ? 'bg-[var(--color-primary)] animate-pulse-dot' : 'bg-[var(--color-success)]'
          }`}
        />
        {isStreaming ? '生成中' : '就绪'}
      </span>

      {activeConfig && (
        <span>
          模型: {activeConfig.name} ({activeConfig.modelName})
        </span>
      )}

      {(inputTokens > 0 || outputTokens > 0) && (
        <span>
          Token: {(inputTokens / 1000).toFixed(1)}k / {(outputTokens / 1000).toFixed(1)}k
        </span>
      )}
    </footer>
  )
}
