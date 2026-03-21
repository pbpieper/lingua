import type { AdaptiveState } from '@/hooks/useAdaptiveDifficulty'

interface AdaptiveBannerProps {
  state: AdaptiveState
  /** Minimum answers before the banner renders. Default 5. */
  minAnswers?: number
}

/**
 * Compact banner showing adaptive difficulty state.
 * Designed to sit at the top of any practice tool.
 * Only renders once enough answers have been recorded.
 */
export function AdaptiveBanner({ state, minAnswers = 5 }: AdaptiveBannerProps) {
  if (state.answerCount < minAnswers) {
    return null
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
      style={{
        backgroundColor: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Difficulty dots */}
      <div className="flex items-center gap-1 shrink-0" title={`Difficulty ${state.difficulty}/5`}>
        {[1, 2, 3, 4, 5].map(level => (
          <span
            key={level}
            className="inline-block w-2 h-2 rounded-full"
            style={{
              backgroundColor: level <= state.difficulty
                ? 'var(--color-primary-main)'
                : 'var(--color-gray-300)',
            }}
          />
        ))}
        <span
          className="ml-1 text-xs font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Lv {state.difficulty}
        </span>
      </div>

      {/* Accuracy */}
      <span
        className="text-xs font-medium shrink-0"
        style={{
          color: state.recentAccuracy >= 70
            ? 'var(--color-correct)'
            : state.recentAccuracy >= 40
              ? 'var(--color-accent-dark)'
              : 'var(--color-incorrect)',
        }}
      >
        {state.recentAccuracy}%
      </span>

      {/* Weak area pills */}
      {state.weakAreas.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {state.weakAreas.map(area => (
            <span
              key={area}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight"
              style={{
                backgroundColor: 'var(--color-accent-light)',
                color: 'var(--color-accent-dark)',
              }}
            >
              {area}
            </span>
          ))}
        </div>
      )}

      {/* Recommendation */}
      <span
        className="text-xs ml-auto truncate"
        style={{ color: 'var(--color-text-muted)' }}
        title={state.recommendation}
      >
        {state.recommendation}
      </span>
    </div>
  )
}
