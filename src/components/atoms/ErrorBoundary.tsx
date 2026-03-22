import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React error boundary that catches rendering errors.
 * Shows a friendly error message with a "Try Again" button.
 * Logs the error to localStorage for the feedback system.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Log to localStorage feedback system
    try {
      const key = 'lingua-error-log'
      const existing = localStorage.getItem(key)
      const logs: Array<{ timestamp: string; message: string; stack?: string; componentStack?: string }> =
        existing ? JSON.parse(existing) : []

      logs.push({
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack ?? undefined,
      })

      // Keep only the last 20 entries
      if (logs.length > 20) logs.splice(0, logs.length - 20)
      localStorage.setItem(key, JSON.stringify(logs))
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center py-20 px-4">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4 opacity-50">&#9888;&#65039;</div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              An unexpected error occurred. Try refreshing or click below to recover.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors">
                  Error details
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] overflow-auto max-h-32 font-[var(--font-mono)]">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-primary-main)] text-white cursor-pointer border-none hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--color-primary-main)] focus-visible:outline-offset-2"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary-main)] focus-visible:outline-offset-2"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
