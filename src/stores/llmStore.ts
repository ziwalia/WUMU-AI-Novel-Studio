import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { LLMConfig, PollingStrategy } from '@/types'

interface LLMState {
  configs: LLMConfig[]
  activeConfigId: string | null
  pollingStrategy: PollingStrategy
  stepOverrides: Record<string, string>

  addConfig: (config: LLMConfig) => void
  updateConfig: (id: string, updates: Partial<LLMConfig>) => void
  removeConfig: (id: string) => void
  setActiveConfig: (id: string) => void
  setPollingStrategy: (strategy: PollingStrategy) => void
  setStepOverride: (step: string, configId: string) => void
  getActiveConfig: () => LLMConfig | undefined
}

export const useLLMStore = create<LLMState>()(
  persist(
    (set, get) => ({
      configs: [],
      activeConfigId: null,
      pollingStrategy: 'sequential',
      stepOverrides: {},

      addConfig: (config) => set((state) => ({ configs: [...state.configs, config] })),

      updateConfig: (id, updates) =>
        set((state) => ({
          configs: state.configs.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),

      removeConfig: (id) =>
        set((state) => ({
          configs: state.configs.filter((c) => c.id !== id),
          activeConfigId: state.activeConfigId === id ? null : state.activeConfigId,
        })),

      setActiveConfig: (id) => set({ activeConfigId: id }),
      setPollingStrategy: (strategy) => set({ pollingStrategy: strategy }),
      setStepOverride: (step, configId) =>
        set((state) => ({ stepOverrides: { ...state.stepOverrides, [step]: configId } })),

      getActiveConfig: () => {
        const { configs, activeConfigId } = get()
        return configs.find((c) => c.id === activeConfigId)
      },
    }),
    {
      name: 'abook-llm',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
)
