import { create } from 'zustand'

interface SessionState {
  streamingContent: string
  isStreaming: boolean
  inputTokens: number
  outputTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  abortController: AbortController | null

  setStreamingContent: (content: string) => void
  appendContent: (chunk: string) => void
  setStreaming: (streaming: boolean) => void
  setTokenUsage: (input: number, output: number) => void
  startGeneration: () => AbortController
  stopGeneration: () => string
  clearContent: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  streamingContent: '',
  isStreaming: false,
  inputTokens: 0,
  outputTokens: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  abortController: null,

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setTokenUsage: (input, output) =>
    set((state) => ({
      inputTokens: input,
      outputTokens: output,
      totalInputTokens: state.totalInputTokens + input,
      totalOutputTokens: state.totalOutputTokens + output,
    })),

  startGeneration: () => {
    const controller = new AbortController()
    set({ abortController: controller, isStreaming: true, streamingContent: '', outputTokens: 0 })
    return controller
  },

  stopGeneration: () => {
    const content = get().streamingContent
    set((state) => {
      state.abortController?.abort()
      return { abortController: null, isStreaming: false }
    })
    return content
  },

  clearContent: () => set({ streamingContent: '' }),
}))
