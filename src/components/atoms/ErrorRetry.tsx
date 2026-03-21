interface ErrorRetryProps {
  message?: string
  onRetry: () => void
  compact?: boolean
}

/**
 * Reusable error state with retry button.
 * Use in catch blocks or when API calls fail.
 */
export function ErrorRetry({ message = 'Something went wrong', onRetry, compact = false }: ErrorRetryProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10">
        <span className="text-xs text-red-600 dark:text-red-400 flex-1">{message}</span>
        <button
          onClick={onRetry}
          className="px-2 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 cursor-pointer border-none hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3 opacity-40">&#9888;&#65039;</div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary-main)] text-white cursor-pointer border-none hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    </div>
  )
}
