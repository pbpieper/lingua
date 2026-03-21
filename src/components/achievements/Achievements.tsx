import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { VocabStats, VocabSession } from '@/types/word'

// ─── Achievement Definitions ─────────────────────────────────────

interface AchievementDef {
  id: string
  icon: string
  title: string
  description: string
  category: 'words' | 'streak' | 'sessions' | 'accuracy' | 'tools' | 'special'
  check: (ctx: AchievementContext) => boolean
}

interface EarnedAchievement {
  id: string
  earnedAt: string
}

interface AchievementContext {
  stats: VocabStats
  sessions: VocabSession[]
  uniqueToolIds: Set<string>
  sessionCount: number
}

const ACHIEVEMENTS: AchievementDef[] = [
  // Words
  { id: 'first_steps', icon: '👣', title: 'First Steps', description: 'Review your first word', category: 'words',
    check: ctx => ctx.stats.total_reviews >= 1 },
  { id: 'getting_started', icon: '📝', title: 'Getting Started', description: 'Add 10 words', category: 'words',
    check: ctx => ctx.stats.total_words >= 10 },
  { id: 'word_collector', icon: '📖', title: 'Word Collector', description: 'Add 50 words', category: 'words',
    check: ctx => ctx.stats.total_words >= 50 },
  { id: 'vocabulary_master', icon: '🎓', title: 'Vocabulary Master', description: 'Add 200 words', category: 'words',
    check: ctx => ctx.stats.total_words >= 200 },
  { id: 'polyglot', icon: '🌍', title: 'Polyglot', description: 'Add 500 words', category: 'words',
    check: ctx => ctx.stats.total_words >= 500 },

  // Streaks
  { id: 'consistent', icon: '📅', title: 'Consistent', description: '3-day streak', category: 'streak',
    check: ctx => ctx.stats.streak.longest >= 3 },
  { id: 'dedicated', icon: '💪', title: 'Dedicated', description: '7-day streak', category: 'streak',
    check: ctx => ctx.stats.streak.longest >= 7 },
  { id: 'committed', icon: '🏋️', title: 'Committed', description: '30-day streak', category: 'streak',
    check: ctx => ctx.stats.streak.longest >= 30 },
  { id: 'unstoppable', icon: '⚡', title: 'Unstoppable', description: '100-day streak', category: 'streak',
    check: ctx => ctx.stats.streak.longest >= 100 },

  // Sessions
  { id: 'quick_learner', icon: '🚀', title: 'Quick Learner', description: 'Complete 10 review sessions', category: 'sessions',
    check: ctx => ctx.sessionCount >= 10 },
  { id: 'study_machine', icon: '🤖', title: 'Study Machine', description: 'Complete 50 sessions', category: 'sessions',
    check: ctx => ctx.sessionCount >= 50 },
  { id: 'scholar', icon: '🧑‍🎓', title: 'Scholar', description: 'Complete 100 sessions', category: 'sessions',
    check: ctx => ctx.sessionCount >= 100 },

  // Accuracy
  { id: 'sharp_mind', icon: '🧠', title: 'Sharp Mind', description: '80% accuracy over 50+ reviews', category: 'accuracy',
    check: ctx => ctx.stats.accuracy >= 80 && ctx.stats.total_reviews >= 50 },
  { id: 'perfectionist', icon: '💎', title: 'Perfectionist', description: '95% accuracy over 100+ reviews', category: 'accuracy',
    check: ctx => ctx.stats.accuracy >= 95 && ctx.stats.total_reviews >= 100 },

  // Tools
  { id: 'explorer', icon: '🧭', title: 'Explorer', description: 'Try 5 different tools', category: 'tools',
    check: ctx => ctx.uniqueToolIds.size >= 5 },
  { id: 'multi_tasker', icon: '🎯', title: 'Multi-Tasker', description: 'Try all tools in one day', category: 'tools',
    check: ctx => {
      // Group sessions by date, check if any date has all unique tools
      const byDate = new Map<string, Set<string>>()
      for (const s of ctx.sessions) {
        const date = s.started_at.slice(0, 10)
        if (!byDate.has(date)) byDate.set(date, new Set())
        byDate.get(date)!.add(s.tool_id)
      }
      // "all tools" = at least 5 different study tools in one day (excluding home/upload/dashboard/achievements)
      for (const tools of byDate.values()) {
        if (tools.size >= 5) return true
      }
      return false
    }
  },

  // Special
  { id: 'pre_learner', icon: '🔮', title: 'Pre-Learner', description: 'Use the Pre-Learn pipeline once', category: 'special',
    check: ctx => ctx.sessions.some(s => s.tool_id === 'prelearn') },
  { id: 'writer', icon: '✍️', title: 'Writer', description: 'Complete a writing exercise', category: 'special',
    check: ctx => ctx.sessions.some(s => s.tool_id === 'writing') },
  { id: 'listener', icon: '👂', title: 'Listener', description: 'Complete a listening exercise', category: 'special',
    check: ctx => ctx.sessions.some(s => s.tool_id === 'listening') },
]

// ─── XP & Level Calculations ────────────────────────────────────

function calculateXP(stats: VocabStats, sessionCount: number): number {
  const reviewXP = stats.total_reviews * 10
  const correctXP = Math.round(stats.total_reviews * (stats.accuracy / 100)) * 5
  const sessionXP = sessionCount * 50
  const newWordXP = stats.total_words * 25
  return reviewXP + correctXP + sessionXP + newWordXP
}

function getLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100))
}

function xpForLevel(level: number): number {
  return level * level * 100
}

// ─── localStorage helpers ────────────────────────────────────────

function getStorageKey(userId: string): string {
  return `lingua-achievements-${userId}`
}

function loadEarned(userId: string): EarnedAchievement[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return []
    return JSON.parse(raw) as EarnedAchievement[]
  } catch {
    return []
  }
}

function saveEarned(userId: string, earned: EarnedAchievement[]): void {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(earned))
}

// ─── Main Component ─────────────────────────────────────────────

export function Achievements() {
  const { userId } = useApp()

  const [stats, setStats] = useState<VocabStats | null>(null)
  const [sessions, setSessions] = useState<VocabSession[]>([])
  const [earned, setEarned] = useState<EarnedAchievement[]>(() => loadEarned(userId))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getDashboard(userId)
      .then(data => {
        setStats(data.stats)
        setSessions(data.recent_sessions ?? [])
      })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [userId])

  // Check achievements when stats load
  useEffect(() => {
    if (!stats) return

    const uniqueToolIds = new Set(sessions.map(s => s.tool_id))
    const ctx: AchievementContext = {
      stats,
      sessions,
      uniqueToolIds,
      sessionCount: sessions.length,
    }

    const earnedIds = new Set(earned.map(e => e.id))
    const newlyEarned: EarnedAchievement[] = []

    for (const def of ACHIEVEMENTS) {
      if (!earnedIds.has(def.id) && def.check(ctx)) {
        newlyEarned.push({ id: def.id, earnedAt: new Date().toISOString() })
      }
    }

    if (newlyEarned.length > 0) {
      const updated = [...earned, ...newlyEarned]
      setEarned(updated)
      saveEarned(userId, updated)

      // Toast for newly earned
      for (const ne of newlyEarned) {
        const def = ACHIEVEMENTS.find(a => a.id === ne.id)
        if (def) {
          toast.success(`${def.icon} Achievement unlocked: ${def.title}!`)
        }
      }
    }
  }, [stats, sessions, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="text-center py-16 text-[var(--color-text-muted)] text-sm">
        Loading achievements...
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4 opacity-40">🏆</div>
        <p className="text-[var(--color-text-secondary)] font-medium">No data available yet</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Start studying to earn achievements</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        Achievements
      </h2>

      <XPSection stats={stats} sessionCount={sessions.length} />
      <StreakSection stats={stats} />
      <AchievementsGrid earned={earned} />
      <RecentMilestones earned={earned} />
    </div>
  )
}

// ─── XP & Level Section ─────────────────────────────────────────

function XPSection({ stats, sessionCount }: { stats: VocabStats; sessionCount: number }) {
  const totalXP = useMemo(() => calculateXP(stats, sessionCount), [stats, sessionCount])
  const level = getLevel(totalXP)
  const currentLevelXP = xpForLevel(level)
  const nextLevelXP = xpForLevel(level + 1)
  const progressXP = totalXP - currentLevelXP
  const neededXP = nextLevelXP - currentLevelXP
  const progressPct = neededXP > 0 ? Math.min((progressXP / neededXP) * 100, 100) : 100

  return (
    <motion.div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-primary-main), var(--color-primary-dark))' }}
          >
            {level}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Level {level}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {totalXP.toLocaleString()} XP total
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-muted)]">Next level</p>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {(nextLevelXP - totalXP).toLocaleString()} XP to go
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-primary-pale)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--color-primary-main)' }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-[var(--color-text-muted)]">
          {currentLevelXP.toLocaleString()} XP
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {nextLevelXP.toLocaleString()} XP
        </span>
      </div>

      {/* XP breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <XPBreakdownItem label="Reviews" value={stats.total_reviews * 10} detail={`${stats.total_reviews} x 10`} />
        <XPBreakdownItem label="Correct" value={Math.round(stats.total_reviews * (stats.accuracy / 100)) * 5} detail={`x 5 each`} />
        <XPBreakdownItem label="Sessions" value={sessionCount * 50} detail={`${sessionCount} x 50`} />
        <XPBreakdownItem label="New Words" value={stats.total_words * 25} detail={`${stats.total_words} x 25`} />
      </div>
    </motion.div>
  )
}

function XPBreakdownItem({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-md px-3 py-2" style={{ background: 'var(--color-primary-pale)' }}>
      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
      <p className="text-sm font-bold text-[var(--color-primary-main)]">{value.toLocaleString()} XP</p>
      <p className="text-xs text-[var(--color-text-muted)]">{detail}</p>
    </div>
  )
}

// ─── Streak Section ─────────────────────────────────────────────

function StreakSection({ stats }: { stats: VocabStats }) {
  const { current, longest } = stats.streak
  const active = current > 0

  return (
    <motion.div
      className="rounded-lg border px-5 py-4"
      style={{
        borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
        background: active ? 'var(--color-accent-faded)' : 'var(--color-surface)',
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
    >
      <div className="flex items-center gap-4">
        {/* Flame icon */}
        <div className="relative flex-shrink-0">
          <svg
            width="40" height="40" viewBox="0 0 24 24" fill="none"
            className={active ? 'streak-flame-ach' : 'opacity-30'}
          >
            <path
              d="M12 2C12 2 5 9 5 14.5C5 18.09 8.13 21 12 21C15.87 21 19 18.09 19 14.5C19 9 12 2 12 2Z"
              fill={active ? 'var(--color-accent)' : 'var(--color-gray-400)'}
            />
            <path
              d="M12 21C10.07 21 8.5 19.43 8.5 17.5C8.5 15.57 12 11 12 11C12 11 15.5 15.57 15.5 17.5C15.5 19.43 13.93 21 12 21Z"
              fill={active ? 'var(--color-accent-mid)' : 'var(--color-gray-300)'}
            />
          </svg>
          {active && (
            <style>{`
              @keyframes streak-pulse-ach {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.85; }
              }
              .streak-flame-ach { animation: streak-pulse-ach 2s ease-in-out infinite; }
            `}</style>
          )}
        </div>

        {/* Current streak */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${active ? 'text-[var(--color-accent-dark)]' : 'text-[var(--color-text-muted)]'}`}>
              {current}
            </span>
            <span className={`text-sm font-medium ${active ? 'text-[var(--color-accent-dark)]' : 'text-[var(--color-text-muted)]'}`}>
              day{current !== 1 ? 's' : ''} streak
            </span>
          </div>
          {active && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-accent-dark)' }}>
              Keep it going!
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-4 flex-shrink-0">
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Longest</p>
            <p className="text-lg font-bold text-[var(--color-text-secondary)]">{longest}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Total days</p>
            <p className="text-lg font-bold text-[var(--color-text-secondary)]">{stats.streak.total_days}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Achievements Grid ──────────────────────────────────────────

function AchievementsGrid({ earned }: {
  earned: EarnedAchievement[]
}) {
  const earnedIds = useMemo(() => new Set(earned.map(e => e.id)), [earned])

  const categories: Array<{ key: string; label: string }> = [
    { key: 'words', label: 'Vocabulary' },
    { key: 'streak', label: 'Streaks' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'tools', label: 'Exploration' },
    { key: 'special', label: 'Special' },
  ]

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      {categories.map(cat => {
        const defs = ACHIEVEMENTS.filter(a => a.category === cat.key)
        if (defs.length === 0) return null

        return (
          <div key={cat.key}>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              {cat.label}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {defs.map(def => {
                const isEarned = earnedIds.has(def.id)
                return (
                  <AchievementBadge key={def.id} def={def} earned={isEarned} />
                )
              })}
            </div>
          </div>
        )
      })}
    </motion.div>
  )
}

function AchievementBadge({ def, earned }: { def: AchievementDef; earned: boolean }) {
  return (
    <div
      className={`relative rounded-xl border p-4 text-center transition-all ${
        earned
          ? 'border-[var(--color-primary-light)] bg-[var(--color-surface)] shadow-sm'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] opacity-50'
      }`}
      style={earned ? { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } : undefined}
    >
      {/* Icon */}
      <div className={`text-3xl mb-2 ${earned ? '' : 'grayscale'}`}>
        {earned ? def.icon : '🔒'}
      </div>

      {/* Title */}
      <p className={`text-xs font-semibold mb-0.5 ${
        earned ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'
      }`}>
        {def.title}
      </p>

      {/* Description */}
      <p className="text-xs text-[var(--color-text-muted)] leading-tight">
        {def.description}
      </p>

      {/* Earned indicator */}
      {earned && (
        <div
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
          style={{ background: 'var(--color-correct)', color: 'white' }}
        >
          &#10003;
        </div>
      )}
    </div>
  )
}

// ─── Recent Milestones ──────────────────────────────────────────

function RecentMilestones({ earned }: { earned: EarnedAchievement[] }) {
  const recent = useMemo(() => {
    return [...earned]
      .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
      .slice(0, 5)
  }, [earned])

  if (recent.length === 0) {
    return (
      <motion.div
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
          Recent Milestones
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
          No achievements earned yet. Keep studying!
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
        Recent Milestones
      </h3>
      <div className="space-y-2">
        {recent.map(item => {
          const def = ACHIEVEMENTS.find(a => a.id === item.id)
          if (!def) return null
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: 'var(--color-primary-pale)' }}
            >
              <span className="text-xl">{def.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{def.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{def.description}</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                {formatTimestamp(item.earnedAt)}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
