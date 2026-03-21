import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedbackEntry {
  id: string
  timestamp: string
  userId: string
  satisfaction: number | null          // 1-5 emoji scale
  difficulty: 'too-easy' | 'just-right' | 'too-hard' | null
  workedWell: string[]                 // chip selections
  needsImprovement: string[]           // chip selections
  bugReport: string                    // optional textarea
  npsScore: number | null              // 1-10, shown every 7th feedback
  metadata: {
    wordsLearned: number
    totalReviewed: number
    accuracy: number
    streak: number
    toolsUsed: string[]
    platform: string
    userAgent: string
    appVersion: string
    sessionDate: string
  }
}

interface FeedbackCollectorProps {
  /** If true, show as embedded (no dismiss button) */
  embedded?: boolean
  /** Called when feedback is submitted */
  onComplete?: () => void
  /** Called when user dismisses without submitting */
  onDismiss?: () => void
  /** Override the heading text */
  heading?: string
  /** Override the subtitle text */
  subtitle?: string
  /** Quick bug report mode — only shows textarea + info dump */
  quickBugMode?: boolean
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'lingua-feedback-log'
const LAST_FEEDBACK_KEY = 'lingua-last-feedback-date'
const FEEDBACK_COUNT_KEY = 'lingua-feedback-count'

function getUserId(): string {
  return localStorage.getItem('lingua-user-id') ?? 'anonymous'
}

function getFeedbackCount(): number {
  try {
    return parseInt(localStorage.getItem(FEEDBACK_COUNT_KEY) ?? '0', 10)
  } catch { return 0 }
}

function getSessionMetadata(): FeedbackEntry['metadata'] {
  let wordsLearned = 0
  let totalReviewed = 0
  let accuracy = 0
  let streak = 0
  let toolsUsed: string[] = []

  // Try to read from recent session data
  try {
    const today = new Date().toISOString().slice(0, 10)
    const planRaw = localStorage.getItem(`lingua-daily-plan-${today}`)
    if (planRaw) {
      const plan = JSON.parse(planRaw)
      toolsUsed = plan.completedStepIds ?? []
    }
  } catch { /* ignore */ }

  // Try to read stats from cached data
  try {
    const statsRaw = localStorage.getItem('lingua-cached-stats')
    if (statsRaw) {
      const stats = JSON.parse(statsRaw)
      wordsLearned = stats.words_learned ?? 0
      totalReviewed = stats.total_reviewed ?? 0
      accuracy = stats.accuracy ?? 0
      streak = typeof stats.streak === 'object' ? stats.streak?.current ?? 0 : stats.streak ?? 0
    }
  } catch { /* ignore */ }

  return {
    wordsLearned,
    totalReviewed,
    accuracy,
    streak,
    toolsUsed,
    platform: navigator.platform ?? 'unknown',
    userAgent: navigator.userAgent,
    appVersion: '1.0.0',
    sessionDate: new Date().toISOString().slice(0, 10),
  }
}

export function saveFeedbackEntry(entry: FeedbackEntry): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const log: FeedbackEntry[] = raw ? JSON.parse(raw) : []
    log.push(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
    localStorage.setItem(LAST_FEEDBACK_KEY, new Date().toISOString().slice(0, 10))
    localStorage.setItem(FEEDBACK_COUNT_KEY, String(getFeedbackCount() + 1))
  } catch { /* ignore */ }
}

export function loadFeedbackLog(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function getLastFeedbackDate(): string | null {
  return localStorage.getItem(LAST_FEEDBACK_KEY)
}

/** Check if yesterday had no feedback (for welcome-back prompt) */
export function shouldShowWelcomeBack(): boolean {
  const lastDate = getLastFeedbackDate()
  if (!lastDate) return false
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10)
  // Show if last feedback was 2+ days ago (meaning they missed yesterday)
  return lastDate <= twoDaysAgoStr
}

// ---------------------------------------------------------------------------
// Chip options
// ---------------------------------------------------------------------------

const TOOL_CHIPS = [
  'Flashcards', 'Games', 'Stories', 'Grammar',
  'Reading', 'Speaking', 'Listening', 'Writing', 'New Words',
]

const SATISFACTION_EMOJIS = [
  { value: 1, emoji: '\uD83D\uDE2B', label: 'Terrible' },
  { value: 2, emoji: '\uD83D\uDE15', label: 'Bad' },
  { value: 3, emoji: '\uD83D\uDE10', label: 'Okay' },
  { value: 4, emoji: '\uD83D\uDE42', label: 'Good' },
  { value: 5, emoji: '\uD83D\uDE0D', label: 'Amazing' },
]

const DIFFICULTY_OPTIONS = [
  { value: 'too-easy' as const, label: 'Too easy' },
  { value: 'just-right' as const, label: 'Just right' },
  { value: 'too-hard' as const, label: 'Too hard' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackCollector({
  embedded = false,
  onComplete,
  onDismiss,
  heading = 'How was your session?',
  subtitle = 'Quick feedback to improve your experience',
  quickBugMode = false,
}: FeedbackCollectorProps) {
  const [satisfaction, setSatisfaction] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState<'too-easy' | 'just-right' | 'too-hard' | null>(null)
  const [workedWell, setWorkedWell] = useState<Set<string>>(new Set())
  const [needsImprovement, setNeedsImprovement] = useState<Set<string>>(new Set())
  const [bugReport, setBugReport] = useState('')
  const [bugExpanded, setBugExpanded] = useState(quickBugMode)
  const [npsScore, setNpsScore] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const showNps = useMemo(() => {
    const count = getFeedbackCount()
    return count > 0 && count % 7 === 0
  }, [])

  const toggleChip = useCallback((set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }, [])

  const handleSubmit = useCallback(() => {
    const entry: FeedbackEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: getUserId(),
      satisfaction,
      difficulty,
      workedWell: [...workedWell],
      needsImprovement: [...needsImprovement],
      bugReport: bugReport.trim(),
      npsScore: showNps ? npsScore : null,
      metadata: getSessionMetadata(),
    }
    saveFeedbackEntry(entry)
    setSubmitted(true)
    setTimeout(() => onComplete?.(), 1200)
  }, [satisfaction, difficulty, workedWell, needsImprovement, bugReport, npsScore, showNps, onComplete])

  const handleQuickBugSubmit = useCallback(() => {
    const entry: FeedbackEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: getUserId(),
      satisfaction: null,
      difficulty: null,
      workedWell: [],
      needsImprovement: [],
      bugReport: bugReport.trim(),
      npsScore: null,
      metadata: getSessionMetadata(),
    }
    saveFeedbackEntry(entry)
    setSubmitted(true)
    setTimeout(() => onComplete?.(), 1200)
  }, [bugReport, onComplete])

  // --- Submitted state ---
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-6 text-center"
        style={{
          background: 'var(--color-primary-pale, var(--color-primary-faded))',
          border: '1px solid var(--color-primary-light)',
        }}
      >
        <div className="text-3xl mb-2">{'\u2728'}</div>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-primary-dark, var(--color-primary-main))' }}>
          Thanks for your feedback!
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Your input helps us improve Lingua
        </p>
      </motion.div>
    )
  }

  // --- Quick Bug Mode ---
  if (quickBugMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-5 space-y-4"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Report a Bug
          </h3>
          {!embedded && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs cursor-pointer bg-transparent border-none"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancel
            </button>
          )}
        </div>
        <textarea
          value={bugReport}
          onChange={e => setBugReport(e.target.value)}
          placeholder="Describe the issue or suggestion..."
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
          style={{
            background: 'var(--color-bg, var(--color-surface-alt))',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
        <div
          className="rounded-lg px-3 py-2 text-xs font-mono whitespace-pre-wrap max-h-24 overflow-y-auto"
          style={{
            background: 'var(--color-surface-alt, var(--color-bg))',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          {JSON.stringify(getSessionMetadata(), null, 2)}
        </div>
        <button
          type="button"
          onClick={handleQuickBugSubmit}
          disabled={!bugReport.trim()}
          className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Submit Bug Report
        </button>
      </motion.div>
    )
  }

  // --- Full Feedback Form ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl p-5 space-y-5"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {heading}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        </div>
        {!embedded && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs cursor-pointer bg-transparent border-none underline"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Skip
          </button>
        )}
      </div>

      {/* 1. Satisfaction — emoji scale */}
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Overall satisfaction
        </label>
        <div className="flex gap-2 justify-center">
          {SATISFACTION_EMOJIS.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => setSatisfaction(item.value)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl cursor-pointer transition-all border"
              style={{
                background: satisfaction === item.value ? 'var(--color-primary-faded)' : 'transparent',
                borderColor: satisfaction === item.value ? 'var(--color-primary-main)' : 'var(--color-border)',
                transform: satisfaction === item.value ? 'scale(1.1)' : 'scale(1)',
              }}
              aria-label={item.label}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Difficulty */}
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Session difficulty
        </label>
        <div className="flex gap-2">
          {DIFFICULTY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDifficulty(opt.value)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors border"
              style={{
                background: difficulty === opt.value ? 'var(--color-primary-main)' : 'var(--color-surface)',
                color: difficulty === opt.value ? '#fff' : 'var(--color-text-secondary)',
                borderColor: difficulty === opt.value ? 'var(--color-primary-main)' : 'var(--color-border)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. What worked well */}
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          What worked well?
        </label>
        <div className="flex flex-wrap gap-2">
          {TOOL_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => toggleChip(workedWell, chip, setWorkedWell)}
              className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all border"
              style={{
                background: workedWell.has(chip) ? 'var(--color-correct)' : 'var(--color-surface)',
                color: workedWell.has(chip) ? '#fff' : 'var(--color-text-secondary)',
                borderColor: workedWell.has(chip) ? 'var(--color-correct)' : 'var(--color-border)',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Needs improvement */}
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          What needs improvement?
        </label>
        <div className="flex flex-wrap gap-2">
          {TOOL_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => toggleChip(needsImprovement, chip, setNeedsImprovement)}
              className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all border"
              style={{
                background: needsImprovement.has(chip) ? 'var(--color-accent-dark, var(--color-accent-main))' : 'var(--color-surface)',
                color: needsImprovement.has(chip) ? '#fff' : 'var(--color-text-secondary)',
                borderColor: needsImprovement.has(chip) ? 'var(--color-accent-dark, var(--color-accent-main))' : 'var(--color-border)',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Bug report / suggestion (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setBugExpanded(!bugExpanded)}
          className="flex items-center gap-1.5 text-xs font-medium cursor-pointer bg-transparent border-none"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span style={{ fontSize: 10 }}>{bugExpanded ? '\u25BE' : '\u25B8'}</span>
          Bug report or suggestion (optional)
        </button>
        <AnimatePresence>
          {bugExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <textarea
                value={bugReport}
                onChange={e => setBugReport(e.target.value)}
                placeholder="Tell us what happened or what you'd like to see..."
                rows={3}
                className="w-full mt-2 px-3 py-2 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
                style={{
                  background: 'var(--color-bg, var(--color-surface-alt))',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 6. NPS — shown every 7th feedback */}
      {showNps && (
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Would you recommend Lingua to a friend? (1-10)
          </label>
          <div className="flex gap-1 justify-center">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setNpsScore(n)}
                className="w-8 h-8 rounded-lg text-xs font-bold cursor-pointer transition-all border"
                style={{
                  background: npsScore === n
                    ? n >= 9 ? 'var(--color-correct)' : n >= 7 ? 'var(--color-primary-main)' : 'var(--color-accent-dark, var(--color-accent-main))'
                    : 'var(--color-surface)',
                  color: npsScore === n ? '#fff' : 'var(--color-text-secondary)',
                  borderColor: npsScore === n ? 'transparent' : 'var(--color-border)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Not likely</span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Very likely</span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--color-primary-main)' }}
      >
        Submit Feedback
      </button>
    </motion.div>
  )
}
