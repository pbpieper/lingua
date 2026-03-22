import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '@/context/AppContext'
import type { LinguaToolId } from '@/types/tools'

// ---------------------------------------------------------------------------
// Milestone definitions
// ---------------------------------------------------------------------------

interface Milestone {
  id: string
  title: string
  description: string
  icon: string
  /** Condition: minimum total words */
  minWords?: number
  /** Condition: minimum mastered words */
  minMastered?: number
  /** Condition: minimum days used */
  minDays?: number
  /** Condition: minimum total reviews */
  minReviews?: number
  /** Link to a tool when clicked */
  toolLink?: LinguaToolId
}

const MILESTONES: Milestone[] = [
  { id: 'start', title: 'First Steps', description: 'Welcome to your journey!', icon: '\uD83C\uDF31', minWords: 0 },
  { id: '10words', title: '10 Words', description: 'Your first 10 vocabulary words', icon: '\uD83D\uDCDA', minWords: 10, toolLink: 'upload' },
  { id: '25words', title: 'Building Blocks', description: '25 words in your word bank', icon: '\uD83E\uDDF1', minWords: 25, toolLink: 'wordbank' },
  { id: 'greetings', title: 'Can Say Hello', description: 'Basic greetings mastered', icon: '\uD83D\uDC4B', minWords: 25, minMastered: 5, toolLink: 'flashcards' },
  { id: '50words', title: 'Expanding Horizons', description: '50 words learned', icon: '\uD83C\uDF0D', minWords: 50 },
  { id: 'streak3', title: '3-Day Streak', description: 'Practiced 3 days in a row', icon: '\uD83D\uDD25', minDays: 3 },
  { id: 'orderfood', title: 'Can Order Food', description: 'Enough vocabulary to navigate a menu', icon: '\uD83C\uDF7D\uFE0F', minWords: 75, minMastered: 15, toolLink: 'scenarios' },
  { id: '100words', title: 'Century Club', description: '100 words in your universe', icon: '\uD83C\uDFC5', minWords: 100, toolLink: 'universe' },
  { id: '100reviews', title: 'Dedicated Learner', description: '100 total reviews completed', icon: '\u2B50', minReviews: 100 },
  { id: 'directions', title: 'Can Ask Directions', description: 'Navigate with confidence', icon: '\uD83E\uDDED', minWords: 100, minMastered: 30, toolLink: 'scenarios' },
  { id: '200words', title: 'Word Explorer', description: '200 words and growing', icon: '\uD83D\uDE80', minWords: 200 },
  { id: 'conversation', title: 'Basic Conversation', description: 'Hold a simple conversation', icon: '\uD83D\uDDE3\uFE0F', minWords: 200, minMastered: 60, toolLink: 'speaking' },
  { id: 'streak7', title: 'Week Warrior', description: '7 days of consistent practice', icon: '\uD83D\uDCAA', minDays: 7 },
  { id: '500words', title: 'Vocabulary Builder', description: '500 words learned', icon: '\uD83C\uDF1F', minWords: 500 },
  { id: 'reader', title: 'Independent Reader', description: 'Read simple texts with ease', icon: '\uD83D\uDCD6', minWords: 500, minMastered: 150, toolLink: 'reading' },
  { id: '1000words', title: 'Word Master', description: '1000 words — real fluency begins here', icon: '\uD83C\uDFC6', minWords: 1000, toolLink: 'universe' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LearningJourneyProps {
  compact?: boolean
}

export function LearningJourney({ compact = false }: LearningJourneyProps) {
  const { totalWords, wordsMastered, daysUsed, totalReviewed, setActiveTool } = useApp()

  const milestoneStates = useMemo(() => {
    return MILESTONES.map(m => {
      let isComplete = true
      if (m.minWords !== undefined && totalWords < m.minWords) isComplete = false
      if (m.minMastered !== undefined && wordsMastered < m.minMastered) isComplete = false
      if (m.minDays !== undefined && daysUsed < m.minDays) isComplete = false
      if (m.minReviews !== undefined && totalReviewed < m.minReviews) isComplete = false
      return { ...m, isComplete }
    })
  }, [totalWords, wordsMastered, daysUsed, totalReviewed])

  // Find current position: first incomplete milestone
  const currentIndex = milestoneStates.findIndex(m => !m.isComplete)
  const progress = currentIndex === -1 ? 100 : Math.round((currentIndex / milestoneStates.length) * 100)

  // In compact mode, show only nearby milestones
  const visibleMilestones = compact
    ? milestoneStates.slice(Math.max(0, (currentIndex === -1 ? milestoneStates.length : currentIndex) - 1), Math.max(3, (currentIndex === -1 ? milestoneStates.length : currentIndex) + 3))
    : milestoneStates

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-bold text-[var(--color-text-primary)] flex items-center gap-2 ${compact ? 'text-sm' : 'text-base'}`}>
          <span>{progress === 100 ? '\uD83C\uDFC6' : '\uD83D\uDDFA\uFE0F'}</span>
          Your Journey
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          {progress}% complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden mb-4">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, var(--color-primary-main), #10b981)' }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      {/* Journey path */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[var(--color-border)]" />

        <div className="space-y-0.5">
          {visibleMilestones.map((milestone, i) => {
            const globalIndex = milestoneStates.indexOf(milestone)
            const isCurrent = globalIndex === currentIndex
            const isLocked = !milestone.isComplete && !isCurrent

            return (
              <motion.div
                key={milestone.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  if (milestone.toolLink && milestone.isComplete) {
                    setActiveTool(milestone.toolLink)
                  }
                }}
                className={`relative flex items-center gap-3 py-2 px-2 rounded-lg transition-colors ${
                  milestone.toolLink && milestone.isComplete ? 'cursor-pointer hover:bg-[var(--color-surface-alt)]' : ''
                } ${isCurrent ? 'bg-[var(--color-primary-faded, var(--color-surface-alt))]' : ''}`}
              >
                {/* Node */}
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 border-2 transition-all ${
                    milestone.isComplete
                      ? 'border-green-500 bg-green-500/10'
                      : isCurrent
                        ? 'border-[var(--color-primary-main)] bg-[var(--color-primary-faded, var(--color-surface-alt))] animate-pulse'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] opacity-40'
                  }`}
                >
                  {milestone.isComplete ? '\u2705' : milestone.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${
                    isLocked ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'
                  }`}>
                    {milestone.title}
                  </div>
                  {!compact && (
                    <div className={`text-xs ${
                      isLocked ? 'text-[var(--color-text-muted)] opacity-60' : 'text-[var(--color-text-secondary)]'
                    }`}>
                      {milestone.description}
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                {isCurrent && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-primary-main)] text-white shrink-0">
                    NEXT
                  </span>
                )}
                {milestone.isComplete && milestone.toolLink && (
                  <span className="text-xs text-[var(--color-text-muted)]">&rarr;</span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {compact && milestoneStates.length > visibleMilestones.length && (
        <div className="text-center mt-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {milestoneStates.filter(m => m.isComplete).length} / {milestoneStates.length} milestones
          </span>
        </div>
      )}
    </div>
  )
}
