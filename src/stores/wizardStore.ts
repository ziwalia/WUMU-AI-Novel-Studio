import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { WizardStep } from '@/types'
import { WIZARD_STEPS } from '@/types'

interface WizardState {
  completedSteps: string[]
  isAutoMode: boolean
  isGenerating: boolean

  markStepCompleted: (step: WizardStep) => void
  setAutoMode: (enabled: boolean) => void
  setGenerating: (generating: boolean) => void
  canNavigateTo: (step: WizardStep) => boolean
  isStepCompleted: (step: WizardStep) => boolean
  getStepStatus: (step: WizardStep, currentStep: WizardStep) => 'completed' | 'active' | 'pending'
  reset: () => void
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      completedSteps: [],
      isAutoMode: false,
      isGenerating: false,

      markStepCompleted: (step) =>
        set((state) => {
          if (state.completedSteps.includes(step)) return state
          return { completedSteps: [...state.completedSteps, step] }
        }),

      setAutoMode: (enabled) => set({ isAutoMode: enabled }),
      setGenerating: (generating) => set({ isGenerating: generating }),

      canNavigateTo: (step) => {
        const { completedSteps } = get()
        const stepIndex = WIZARD_STEPS.indexOf(step)
        if (stepIndex === 0) return true
        if (completedSteps.includes(step)) return true
        const prevStep = WIZARD_STEPS[stepIndex - 1]
        if (!prevStep) return false
        return completedSteps.includes(prevStep)
      },

      isStepCompleted: (step) => get().completedSteps.includes(step),

      getStepStatus: (step, currentStep) => {
        const { completedSteps } = get()
        if (completedSteps.includes(step)) return 'completed'
        if (step === currentStep) return 'active'
        return 'pending'
      },

      reset: () => set({ completedSteps: [], isAutoMode: false, isGenerating: false }),
    }),
    {
      name: 'abook-wizard',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        completedSteps: state.completedSteps,
        isAutoMode: state.isAutoMode,
      }),
    }
  )
)
