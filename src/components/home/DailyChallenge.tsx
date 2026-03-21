import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/context/AppContext'
import { useXP } from '@/hooks/useXP'
import type { LinguaToolId } from '@/types/tools'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const DAILY_CHALLENGE_KEY = 'lingua-daily-challenge'
const DAILY_CHALLENGE_XP = 25

interface ChallengeType {
  id: string
  title: string
  description: string
  icon: string
  targetTool: LinguaToolId
  goal: string
}

const CHALLENGE_POOL: ChallengeType[] = [
  {
    id: 'learn5words',
    title: 'Speed Learner',
    description: 'Score at least 100 points in Speed Typing',
    icon: '\u{26A1}',
    targetTool: 'speedtyping',
    goal: 'Play Speed Typing and score 100+ points',
  },
  {
    id: 'perfectquiz',
    title: 'Perfect Score',
    description: 'Get all answers right in a Quiz round',
    icon: '\u{1F3AF}',
    targetTool: 'multichoice',
    goal: 'Complete a Quiz with 100% accuracy',
  },
  {
    id: 'readnostory',
    title: 'Story Time',
    description: 'Read a full AI-generated story',
    icon: '\u{1F4D6}',
    targetTool: 'stories',
    goal: 'Complete reading an entire story',
  },
  {
    id: 'translate10',
    title: 'Translator',
    description: 'Complete a full listening practice session',
    icon: '\u{1F442}',
    targetTool: 'listening',
    goal: 'Finish a listening practice session',
  },
  {
    id: 'matchmaster',
    title: 'Match Master',
    description: 'Complete a match game with at least 80% accuracy',
    icon: '\u{1F517}',
    targetTool: 'match',
    goal: 'Win a Match Game round',
  },
  {
    id: 'flashcardgrind',
    title: 'Flashcard Grinder',
    description: 'Review at least 20 flashcards',
    icon: '\u{1F0CF}',
    targetTool: 'flashcards',
    goal: 'Review 20+ flashcards in one session',
  },
  {
    id: 'wordassoc',
    title: 'Word Detective',
    description: 'Complete a Word Association round',
    icon: '\u{1F50D}',
    targetTool: 'wordassociation',
    goal: 'Finish a Word Association game',
  },
  {
    id: 'writing',
    title: 'Wordsmith',
    description: 'Complete a writing practice exercise',
    icon: '\u270D\uFE0F',
    targetTool: 'writing',
    goal: 'Submit a writing exercise',
  },
  {
    id: 'cloze',
    title: 'Context Clues',
    description: 'Complete a sentence cloze exercise',
    icon: '\u{1F4DD}',
    targetTool: 'cloze',
    goal: 'Finish a Sentence Cloze session',
  },
  {
    id: 'fillblank',
    title: 'Fill It In',
    description: 'Complete a Fill in the Blank round',
    icon: '\u270F\uFE0F',
    targetTool: 'fillblank',
    goal: 'Finish a Fill Blank session',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Seeded random based on date string — deterministic challenge per day */
function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

function getTodaysChallenge(): ChallengeType {
  const today = todayKey()
  const idx = seededRandom(today) % CHALLENGE_POOL.length
  return CHALLENGE_POOL[idx]
}

interface DailyChallengeProgress {
  date: string
  completed: boolean
  challengeId: string
}

function loadProgress(): DailyChallengeProgress | null {
  try {
    const raw = localStorage.getItem(DAILY_CHALLENGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DailyChallengeProgress
  } catch {
    return null
  }
}

function saveProgress(progress: DailyChallengeProgress): void {
  try {
    localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify(progress))
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DailyChallenge() {
  const { setActiveTool } = useApp()
  const { addXP } = useXP()

  const challenge = useMemo(() => getTodaysChallenge(), [])
  const today = todayKey()

  const [progress, setProgress] = useState<DailyChallengeProgress>(() => {
    const saved = loadProgress()
    if (saved && saved.date === today) return saved
    return { date: today, completed: false, challengeId: challenge.id }
  })

  const isCompleted = progress.date === today && progress.completed

  const handleComplete = useCallback(() => {
    if (isCompleted) return
    const newProgress: DailyChallengeProgress = {
      date: today,
      completed: true,
      challengeId: challenge.id,
    }
    setProgress(newProgress)
    saveProgress(newProgress)
    addXP(DAILY_CHALLENGE_XP, 'daily_task_category')
  }, [isCompleted, today, challenge.id, addXP])

  const handleGoToChallenge = useCallback(() => {
    setActiveTool(challenge.targetTool)
  }, [challenge.targetTool, setActiveTool])

  return (
    <div
      className="rounded-2xl px-5 py-4 flex flex-col gap-3"
      style={{
        background: isCompleted
          ? 'rgba(5,150,105,0.06)'
          : 'var(--color-surface)',
        border: `1px solid ${isCompleted ? 'var(--color-correct)' : 'var(--color-border)'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{challenge.icon}</span>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Daily Challenge
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {challenge.title}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"
              style={{ background: 'rgba(5,150,105,0.12)', color: 'var(--color-correct)' }}
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Done
            </span>
          ) : (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: 'var(--color-accent-faded)', color: 'var(--color-accent-main)' }}
            >
              +{DAILY_CHALLENGE_XP} XP
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {challenge.description}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        {!isCompleted && (
          <>
            <button
              onClick={handleGoToChallenge}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer"
              style={{ background: 'var(--color-primary-main)' }}
            >
              Go to {challenge.goal.split(' ')[0]}
            </button>
            <button
              onClick={handleComplete}
              className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
              style={{
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Mark Complete
            </button>
          </>
        )}
        {isCompleted && (
          <AnimatePresence>
            <motion.span
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-medium"
              style={{ color: 'var(--color-correct)' }}
            >
              Challenge completed! Come back tomorrow for a new one.
            </motion.span>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
