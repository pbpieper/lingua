import { useMemo } from 'react'
import { motion } from 'framer-motion'

// ---------------------------------------------------------------------------
// Milestone definitions
// ---------------------------------------------------------------------------

export interface MilestoneDef {
  id: string
  icon: string
  title: string
  description: string
  target: number
  xpReward: number
  check: (ctx: MilestoneContext) => number // returns current progress (0..target)
}

export interface MilestoneContext {
  totalWords: number
  wordsMastered: number
  totalReviewed: number
  streakDays: number
  daysUsed: number
  storiesRead: number
  grammarLessons: number
}

export const MILESTONES: MilestoneDef[] = [
  // Words learned
  { id: 'first-10', icon: '\u{1F331}', title: 'First 10 Words', description: 'Add 10 words to your vocabulary', target: 10, xpReward: 25, check: ctx => ctx.totalWords },
  { id: 'first-50', icon: '\u{1F4DA}', title: 'Half Century', description: 'Add 50 words to your vocabulary', target: 50, xpReward: 50, check: ctx => ctx.totalWords },
  { id: 'first-100', icon: '\u{1F4D6}', title: 'Century Club', description: 'Add 100 words to your vocabulary', target: 100, xpReward: 100, check: ctx => ctx.totalWords },
  { id: 'first-250', icon: '\u{1F4D5}', title: 'Word Hoarder', description: 'Add 250 words to your vocabulary', target: 250, xpReward: 150, check: ctx => ctx.totalWords },
  { id: 'first-500', icon: '\u{1F3C6}', title: 'Lexicon Legend', description: 'Add 500 words to your vocabulary', target: 500, xpReward: 250, check: ctx => ctx.totalWords },

  // Mastery
  { id: 'master-10', icon: '\u{1F393}', title: 'First Mastery', description: 'Master 10 words', target: 10, xpReward: 50, check: ctx => ctx.wordsMastered },
  { id: 'master-50', icon: '\u{1F9E0}', title: 'Mind Palace', description: 'Master 50 words', target: 50, xpReward: 100, check: ctx => ctx.wordsMastered },

  // Streaks
  { id: 'streak-3', icon: '\u{1F525}', title: 'On Fire', description: 'Maintain a 3-day streak', target: 3, xpReward: 25, check: ctx => ctx.streakDays },
  { id: 'streak-7', icon: '\u{1F4AA}', title: 'Week Warrior', description: 'Maintain a 7-day streak', target: 7, xpReward: 50, check: ctx => ctx.streakDays },
  { id: 'streak-30', icon: '\u26A1', title: 'Month Master', description: 'Maintain a 30-day streak', target: 30, xpReward: 200, check: ctx => ctx.streakDays },

  // Reviews
  { id: 'reviews-50', icon: '\u{1F4DD}', title: 'Reviewer', description: 'Complete 50 reviews', target: 50, xpReward: 25, check: ctx => ctx.totalReviewed },
  { id: 'reviews-500', icon: '\u{1F3AF}', title: 'Practice Pro', description: 'Complete 500 reviews', target: 500, xpReward: 100, check: ctx => ctx.totalReviewed },

  // Engagement
  { id: 'days-7', icon: '\u{1F4C5}', title: 'First Week', description: 'Use Lingua for 7 days', target: 7, xpReward: 50, check: ctx => ctx.daysUsed },
  { id: 'days-30', icon: '\u{1F5D3}\uFE0F', title: 'Monthly Regular', description: 'Use Lingua for 30 days', target: 30, xpReward: 150, check: ctx => ctx.daysUsed },
]

// ---------------------------------------------------------------------------
// localStorage persistence for earned milestones
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'lingua-milestones-earned'

export interface EarnedMilestone {
  id: string
  earnedAt: string
}

export function loadEarnedMilestones(): EarnedMilestone[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveEarnedMilestones(earned: EarnedMilestone[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(earned))
}

// ---------------------------------------------------------------------------
// Home screen widget: shows next milestone to achieve
// ---------------------------------------------------------------------------

interface Props {
  totalWords: number
  wordsMastered: number
  totalReviewed: number
  streakDays: number
  daysUsed: number
  onViewAll: () => void
}

export function ProgressMilestones({
  totalWords, wordsMastered, totalReviewed, streakDays, daysUsed, onViewAll,
}: Props) {
  const ctx: MilestoneContext = {
    totalWords, wordsMastered, totalReviewed, streakDays, daysUsed,
    storiesRead: 0, grammarLessons: 0,
  }

  const earned = useMemo(() => {
    const e = loadEarnedMilestones()
    return new Set(e.map(m => m.id))
  }, [totalWords, wordsMastered, totalReviewed, streakDays, daysUsed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check for newly earned milestones and persist
  useMemo(() => {
    const currentEarned = loadEarnedMilestones()
    const earnedIds = new Set(currentEarned.map(m => m.id))
    const newlyEarned: EarnedMilestone[] = []

    for (const m of MILESTONES) {
      if (!earnedIds.has(m.id) && m.check(ctx) >= m.target) {
        newlyEarned.push({ id: m.id, earnedAt: new Date().toISOString() })
      }
    }

    if (newlyEarned.length > 0) {
      saveEarnedMilestones([...currentEarned, ...newlyEarned])
    }
  }, [ctx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Find next 2 milestones in progress (not yet earned)
  const upcoming = useMemo(() => {
    return MILESTONES
      .filter(m => !earned.has(m.id))
      .map(m => {
        const current = Math.min(m.check(ctx), m.target)
        return { ...m, current, pct: current / m.target }
      })
      .sort((a, b) => b.pct - a.pct) // closest to completion first
      .slice(0, 2)
  }, [earned, ctx])

  const totalEarned = MILESTONES.filter(m => earned.has(m.id)).length

  if (upcoming.length === 0 && totalEarned === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{'\u{1F3C5}'}</span>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Milestones
          </h3>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-primary-faded)] text-[var(--color-primary-main)]">
            {totalEarned}/{MILESTONES.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-[var(--color-primary-main)] cursor-pointer bg-transparent border-none hover:underline"
        >
          View all
        </button>
      </div>

      <div className="space-y-2">
        {upcoming.map(m => (
          <div
            key={m.id}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0">{m.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{m.title}</p>
                  <span className="text-[10px] font-medium text-[var(--color-primary-main)]">+{m.xpReward} XP</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1.5">{m.description}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[var(--color-primary-main)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${m.pct * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[10px] font-medium tabular-nums text-[var(--color-text-muted)] shrink-0">
                    {m.current}/{m.target}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Recently earned */}
        {totalEarned > 0 && upcoming.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            {MILESTONES.filter(m => earned.has(m.id)).slice(-3).map(m => (
              <span key={m.id} className="text-lg" title={m.title}>{m.icon}</span>
            ))}
            {totalEarned > 3 && (
              <span className="text-xs text-[var(--color-text-muted)]">+{totalEarned - 3} more</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Utility: component for achievements page to show milestone badges
// ---------------------------------------------------------------------------

export function MilestoneBadgesGrid({ context }: { context: MilestoneContext }) {
  const earned = useMemo(() => {
    const e = loadEarnedMilestones()
    return new Set(e.map(m => m.id))
  }, [])

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Milestones</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {MILESTONES.map(m => {
          const isEarned = earned.has(m.id)
          const current = Math.min(m.check(context), m.target)
          const pct = current / m.target

          return (
            <div
              key={m.id}
              className={`relative rounded-xl border p-4 text-center transition-all ${
                isEarned
                  ? 'border-[var(--color-primary-light)] bg-[var(--color-surface)] shadow-sm'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] opacity-60'
              }`}
            >
              <div className={`text-2xl mb-1.5 ${isEarned ? '' : 'grayscale'}`}>
                {isEarned ? m.icon : '\u{1F512}'}
              </div>
              <p className={`text-xs font-semibold mb-0.5 ${
                isEarned ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'
              }`}>{m.title}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] leading-tight mb-2">{m.description}</p>

              {!isEarned && (
                <div className="flex items-center gap-1.5 justify-center">
                  <div className="flex-1 h-1 rounded-full bg-[var(--color-border)] overflow-hidden max-w-[60px]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary-main)]"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-[var(--color-text-muted)]">{current}/{m.target}</span>
                </div>
              )}

              {isEarned && (
                <div
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'var(--color-correct)', color: 'white' }}
                >
                  &#10003;
                </div>
              )}

              <p className="text-[9px] font-medium mt-1 text-[var(--color-primary-main)]">+{m.xpReward} XP</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
