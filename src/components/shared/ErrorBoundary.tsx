import { Component, type ReactNode } from 'react'
import { useUIStore } from '@/stores/uiStore'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    const addToast = useUIStore.getState().addToast
    addToast('error', `渲染错误: ${error.message}`)
  }

  handleClearStorage = () => {
    const keys = Object.keys(localStorage)
    keys.forEach((k) => {
      if (k.startsWith('novel-') || k.startsWith('wizard-') || k.startsWith('session-')) {
        localStorage.removeItem(k)
      }
    })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-[var(--color-surface)]">
          <div className="text-center max-w-md p-6">
            <span className="material-symbols-outlined text-5xl text-[var(--color-error)]">
              error
            </span>
            <h2 className="font-headline text-lg font-semibold text-[var(--color-text-primary)] mt-4">
              页面渲染出错
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2 break-all">
              {this.state.error?.message}
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90"
              >
                刷新页面
              </button>
              <button
                onClick={this.handleClearStorage}
                className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              >
                清除数据并刷新
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
