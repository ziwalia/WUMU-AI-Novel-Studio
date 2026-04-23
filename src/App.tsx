import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { ToastContainer } from '@/components/shared/Toast'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { AutoGenerationFloat } from '@/components/shared/AutoGenerationFloat'
import { UpdateBanner } from '@/components/shared/UpdateBanner'
import { useSessionStore } from '@/stores/sessionStore'
import { useWizardStore } from '@/stores/wizardStore'

function useGlobalKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape: stop generation
      if (e.key === 'Escape') {
        const { isStreaming, stopGeneration } = useSessionStore.getState()
        if (isStreaming) {
          const partial = stopGeneration()
          useWizardStore.getState().setGenerating(false)
          if (partial) {
            // Content will be saved by the step component's next render
            console.log(`生成已停止（${partial.length.toLocaleString()} 字）`)
          }
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

export function App() {
  useGlobalKeyboard()

  return (
    <ErrorBoundary>
      <AppShell />
      <UpdateBanner />
      <ToastContainer />
      <AutoGenerationFloat />
    </ErrorBoundary>
  )
}
