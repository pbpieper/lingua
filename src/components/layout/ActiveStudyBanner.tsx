import { useApp } from '@/context/AppContext'
import type { LinguaToolId } from '@/types/tools'

const TOOL_CHIPS: { id: LinguaToolId; label: string }[] = [
  { id: 'flashcards', label: 'Cards' },
  { id: 'match', label: 'Match' },
  { id: 'multichoice', label: 'Quiz' },
  { id: 'fillblank', label: 'Blank' },
]

/**
 * Shows when a custom (or session-scoped) word set is active across practice tools.
 */
export function ActiveStudyBanner() {
  const {
    activeStudyWords,
    activeStudyLabel,
    clearActiveStudyWords,
    activeTool,
    setActiveTool,
  } = useApp()

  if (!activeStudyWords?.length) return null

  return (
    <div
      className="mb-4 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{
        background: 'var(--color-primary-faded)',
        border: '1px solid var(--color-primary-light)',
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-dark)]">
          Active practice set
        </p>
        <p className="text-sm text-[var(--color-text-primary)] mt-0.5">
          {activeStudyLabel ?? `${activeStudyWords.length} words`} — tools below use this set when possible.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {TOOL_CHIPS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTool(t.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border transition-colors
                ${activeTool === t.id
                  ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={clearActiveStudyWords}
        className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer border border-[var(--color-border)]
          bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]"
      >
        Clear set
      </button>
    </div>
  )
}
