import { useLLMStore } from '@/stores/llmStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { useWizardStore } from '@/stores/wizardStore'
import { chatStream } from '@/services/llm'
import type { Message } from '@/types'

export function useGeneration() {
  const getActiveConfig = useLLMStore((s) => s.getActiveConfig)
  const setActiveConfig = useLLMStore((s) => s.setActiveConfig)
  const configs = useLLMStore((s) => s.configs)
  const startGeneration = useSessionStore((s) => s.startGeneration)
  const appendContent = useSessionStore((s) => s.appendContent)
  const setStreaming = useSessionStore((s) => s.setStreaming)
  const setTokenUsage = useSessionStore((s) => s.setTokenUsage)
  const stopGenerationStore = useSessionStore((s) => s.stopGeneration)
  const clearContent = useSessionStore((s) => s.clearContent)
  const isStreaming = useSessionStore((s) => s.isStreaming)
  const streamingContent = useSessionStore((s) => s.streamingContent)
  const addToast = useUIStore((s) => s.addToast)
  const setGenerating = useWizardStore((s) => s.setGenerating)

  const getConfig = () => {
    let config = getActiveConfig()
    if (!config && configs.length > 0) {
      config = configs[0]!
      setActiveConfig(config.id)
    }
    return config
  }

  const generate = async (
    messages: Message[],
    _onContent?: (content: string) => void,
    onComplete?: (content: string) => void
  ) => {
    const config = getConfig()
    if (!config) {
      addToast('error', '请先配置 LLM 模型（点击右上角的模型选择器）')
      return
    }

    const controller = startGeneration()
    setGenerating(true)

    try {
      const result = await chatStream(
        config,
        messages,
        (chunk) => {
          appendContent(chunk)
        },
        controller.signal
      )

      setStreaming(false)
      setGenerating(false)
      setTokenUsage(result.usage.inputTokens, result.usage.outputTokens)
      onComplete?.(result.content)
      clearContent()
      return result
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        const partialContent = stopGenerationStore()
        setGenerating(false)
        if (partialContent && onComplete) {
          onComplete(partialContent)
          addToast('info', `生成已停止（${partialContent.length.toLocaleString()} 字）`)
        } else {
          addToast('info', '生成已停止')
        }
        return
      }
      const message = err instanceof Error ? err.message : '生成失败'
      setStreaming(false)
      setGenerating(false)
      addToast('error', message)
      throw err
    }
  }

  const stopGeneration = () => {
    const content = streamingContent
    stopGenerationStore()
    setGenerating(false)
    return content
  }

  return { generate, stopGeneration, isStreaming, getConfig }
}
