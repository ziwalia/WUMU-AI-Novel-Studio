import { Component, type ReactNode } from 'react'

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
    console.error('[ErrorBoundary]', error)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center max-w-md p-6 bg-[var(--color-surface)] rounded-lg border border-[var(--color-error)]/30">
            <span className="material-symbols-outlined text-4xl text-[var(--color-error)]">
              error
            </span>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-3">
              步骤渲染出错
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2 break-all">
              {this.state.error?.message}
            </p>
            <button
              onClick={this.handleRetry}
              className="mt-4 px-4 py-2 text-sm rounded bg-[var(--color-primary)] text-white hover:opacity-90"
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
