import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import { TOOLS } from '@/types/tools'
import type { VocabStats, VocabList, VocabSession } from '@/types/word'
import { VocabHeatMap } from '@/components/wordbank/VocabHeatMap'

// ─── Main Component ───────────────────────────────────────────────

export function VocabDashboard() {
  const { userId, lists, setCurrentListId, setActiveTool } = useApp()

  const [stats, setStats] = useState<VocabStats | null>(null)
  const [sessions, setSessions] = useState<VocabSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getDashboard(userId)
      .then(data => {
        setStats(data.stats)
        setSessions(data.recent_sessions ?? [])
      })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load stats'))
      .finally(() => setLoading(false))
  }, [userId])

  const handleListClick = (list: VocabList) => {
    setCurrentListId(list.id)
    setActiveTool('wordbank')
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-[var(--color-text-muted)] text-sm">
        Loading dashboard...
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4 opacity-40">📊</div>
        <p className="text-[var(--color-text-secondary)] font-medium">No stats available yet</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Start studying to see your progress</p>
      </div>
    )
  }

  const hasActivity = stats.daily_stats.length > 0

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        Progress
      </h2>

      {/* Stats overview cards */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <StatCard label="Total Words" value={stats.total_words} />
        <StatCard label="Learned" value={stats.words_learned} accent />
        <StatCard label="Due for Review" value={stats.words_due} warn={stats.words_due > 0} />
        <StatCard label="Accuracy" value={`${Math.round(stats.accuracy)}%`} />
      </motion.div>

      {/* Streak Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <StreakDisplay current={stats.streak.current} longest={stats.streak.longest} />
      </motion.div>

      {/* Activity Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <SectionCard title="Activity">
          {hasActivity ? (
            <ActivityHeatmap dailyStats={stats.daily_stats} />
          ) : (
            <EmptyState text="Start studying to see your activity" />
          )}
        </SectionCard>
      </motion.div>

      {/* Vocabulary Heat Map (90-day GitHub-style) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <VocabHeatMap stats={stats} />
      </motion.div>

      {/* Progress Over Time + Mastery Breakdown */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <SectionCard title="Words Learned (Weekly)">
          {hasActivity ? (
            <WeeklyBarChart dailyStats={stats.daily_stats} />
          ) : (
            <EmptyState text="Start studying to build your weekly chart" />
          )}
        </SectionCard>

        <SectionCard title="Mastery Breakdown">
          {stats.total_words > 0 ? (
            <MasteryDonut stats={stats} />
          ) : (
            <EmptyState text="Import vocabulary to see mastery levels" />
          )}
        </SectionCard>
      </motion.div>

      {/* Recent Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <SectionCard title="Recent Sessions">
          {sessions.length > 0 ? (
            <SessionsList sessions={sessions} />
          ) : (
            <EmptyState text="Complete a study session to see your history" />
          )}
        </SectionCard>
      </motion.div>

      {/* Vocabulary Lists */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <SectionCard title="Vocabulary Lists">
          {lists.length === 0 ? (
            <EmptyState text="No lists yet. Import some vocabulary to get started." />
          ) : (
            <div className="grid gap-2">
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => handleListClick(list)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-[var(--color-border)]
                    bg-[var(--color-surface)] hover:border-[var(--color-primary-light)]
                    hover:bg-[var(--color-primary-pale)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-[var(--color-text-primary)]">{list.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {list.language_from.toUpperCase()} &rarr; {list.language_to.toUpperCase()}
                        {list.description && ` \u00B7 ${list.description}`}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium
                      bg-[var(--color-primary-faded)] text-[var(--color-primary-dark)]">
                      {list.word_count} word{list.word_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </motion.div>
    </div>
  )
}

// ─── Section Card Wrapper ─────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">{title}</h3>
      {children}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">{text}</p>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────

function StatCard({ label, value, accent, warn }: {
  label: string
  value: string | number
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={`text-xl font-bold ${
        warn ? 'text-[var(--color-accent-dark)]'
        : accent ? 'text-[var(--color-correct)]'
        : 'text-[var(--color-text-primary)]'
      }`}>
        {value}
      </p>
    </div>
  )
}

// ─── Streak Display ───────────────────────────────────────────────

function StreakDisplay({ current, longest }: { current: number; longest: number }) {
  const active = current > 0

  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
      active
        ? 'border-[var(--color-accent-light)] bg-[var(--color-accent-faded)]'
        : 'border-[var(--color-border)] bg-[var(--color-surface)]'
    }`}>
      {/* Flame icon */}
      <div className="relative flex-shrink-0">
        <svg
          width="32" height="32" viewBox="0 0 24 24" fill="none"
          className={active ? 'streak-flame' : 'opacity-30'}
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
            @keyframes streak-pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.08); opacity: 0.85; }
            }
            .streak-flame { animation: streak-pulse 2s ease-in-out infinite; }
          `}</style>
        )}
      </div>

      {/* Numbers */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-bold ${active ? 'text-[var(--color-accent-dark)]' : 'text-[var(--color-text-muted)]'}`}>
            {current}
          </span>
          <span className={`text-sm font-medium ${active ? 'text-[var(--color-accent-dark)]' : 'text-[var(--color-text-muted)]'}`}>
            day{current !== 1 ? 's' : ''} streak
          </span>
        </div>
      </div>

      {/* Longest */}
      {longest > 0 && (
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-[var(--color-text-muted)]">Longest</p>
          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{longest} day{longest !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}

// ─── Activity Heatmap (GitHub-style, 12 weeks) ───────────────────

interface DayStat {
  date: string
  reviews: number
  correct: number
  new_words: number
  time_seconds: number
}

function ActivityHeatmap({ dailyStats }: { dailyStats: DayStat[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const { grid, months, totalReviews } = useMemo(() => {
    // Build a map of date -> reviews
    const reviewMap = new Map<string, number>()
    let total = 0
    for (const ds of dailyStats) {
      reviewMap.set(ds.date, ds.reviews)
      total += ds.reviews
    }

    // Build 12 weeks of days ending today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const totalDays = 84 // 12 weeks

    // Go back to the start: find the Monday of the week 12 weeks ago
    const endDay = new Date(today)
    const startDay = new Date(today)
    startDay.setDate(startDay.getDate() - totalDays + 1)
    // Align to start of week (Monday = 1)
    const startDow = startDay.getDay() // 0=Sun
    const mondayOffset = startDow === 0 ? -6 : 1 - startDow
    startDay.setDate(startDay.getDate() + mondayOffset)

    // Calculate total days from aligned start to today
    const alignedTotalDays = Math.ceil((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const cells: Array<{ date: string; reviews: number; col: number; row: number }> = []
    const monthLabels: Array<{ label: string; col: number }> = []
    const seenMonths = new Set<string>()

    for (let i = 0; i < alignedTotalDays; i++) {
      const d = new Date(startDay)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const dow = d.getDay() // 0=Sun
      const row = dow === 0 ? 6 : dow - 1 // Mon=0, Tue=1, ..., Sun=6
      const col = Math.floor(i / 7)

      cells.push({
        date: dateStr,
        reviews: reviewMap.get(dateStr) ?? 0,
        col,
        row,
      })

      // Month labels
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`
      if (!seenMonths.has(monthKey) && d.getDate() <= 7) {
        seenMonths.add(monthKey)
        monthLabels.push({
          label: d.toLocaleDateString(undefined, { month: 'short' }),
          col,
        })
      }
    }

    return { grid: cells, months: monthLabels, totalReviews: total }
  }, [dailyStats])

  const cellSize = 13
  const cellGap = 3
  const step = cellSize + cellGap
  const labelWidth = 28
  const topPadding = 18

  const maxCol = Math.max(...grid.map(c => c.col), 0)
  const svgWidth = labelWidth + (maxCol + 1) * step + 4
  const svgHeight = topPadding + 7 * step + 4

  function getColor(reviews: number): string {
    if (reviews === 0) return 'var(--color-gray-100)'
    if (reviews <= 5) return 'var(--color-primary-faded)'
    if (reviews <= 15) return 'var(--color-primary-light)'
    return 'var(--color-primary-main)'
  }

  const dayLabels = [
    { label: 'Mon', row: 0 },
    { label: 'Wed', row: 2 },
    { label: 'Fri', row: 4 },
  ]

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="block"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Month labels */}
          {months.map((m, i) => (
            <text
              key={i}
              x={labelWidth + m.col * step}
              y={12}
              fill="var(--color-text-muted)"
              fontSize="10"
              fontFamily="var(--font-sans)"
            >
              {m.label}
            </text>
          ))}

          {/* Day-of-week labels */}
          {dayLabels.map(d => (
            <text
              key={d.label}
              x={0}
              y={topPadding + d.row * step + cellSize - 2}
              fill="var(--color-text-muted)"
              fontSize="9"
              fontFamily="var(--font-sans)"
            >
              {d.label}
            </text>
          ))}

          {/* Cells */}
          {grid.map((cell, i) => (
            <rect
              key={i}
              x={labelWidth + cell.col * step}
              y={topPadding + cell.row * step}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={getColor(cell.reviews)}
              className="transition-colors"
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const parent = e.currentTarget.closest('.relative')!.getBoundingClientRect()
                setTooltip({
                  x: rect.left - parent.left + rect.width / 2,
                  y: rect.top - parent.top - 6,
                  text: `${formatDate(cell.date)}: ${cell.reviews} review${cell.reviews !== 1 ? 's' : ''}`,
                })
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded text-xs font-medium
            bg-[var(--color-gray-900)] text-white dark:bg-[var(--color-gray-200)] dark:text-[var(--color-text-primary)]
            whitespace-nowrap z-10"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-muted)] justify-end">
        <span>Less</span>
        {[0, 3, 10, 20].map(v => (
          <div
            key={v}
            className="rounded-sm"
            style={{
              width: 10,
              height: 10,
              backgroundColor: getColor(v),
            }}
          />
        ))}
        <span>More</span>
        <span className="ml-3">{totalReviews} total reviews</span>
      </div>
    </div>
  )
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────

function WeeklyBarChart({ dailyStats }: { dailyStats: DayStat[] }) {
  const weeks = useMemo(() => {
    // Group daily stats into weeks (last 8 weeks)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const result: Array<{ label: string; count: number }> = []

    for (let w = 7; w >= 0; w--) {
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() - w * 7)
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() - 6)

      let count = 0
      for (const ds of dailyStats) {
        const d = new Date(ds.date)
        if (d >= weekStart && d <= weekEnd) {
          count += ds.new_words
        }
      }

      const label = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      result.push({ label, count })
    }
    return result
  }, [dailyStats])

  const maxCount = Math.max(...weeks.map(w => w.count), 1)

  return (
    <div className="flex items-end gap-2 h-36">
      {weeks.map((week, i) => {
        const pct = (week.count / maxCount) * 100
        const barHeight = Math.max(pct, week.count > 0 ? 8 : 2)

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            {/* Count label */}
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              {week.count > 0 ? week.count : ''}
            </span>

            {/* Bar */}
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${barHeight}%`,
                  background: week.count > 0
                    ? 'linear-gradient(to top, var(--color-primary-main), var(--color-primary-light))'
                    : 'var(--color-gray-100)',
                }}
              />
            </div>

            {/* Week label */}
            <span className="text-[9px] text-[var(--color-text-muted)] truncate w-full text-center">
              {week.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Mastery Donut Chart ──────────────────────────────────────────

function MasteryDonut({ stats }: { stats: VocabStats }) {
  // We derive mastery levels from what we know:
  // total_words, words_learned, words_due, accuracy
  // Since we don't have per-word review counts in the dashboard endpoint,
  // we estimate from available stats:
  // - Mastered: words_learned (high familiarity)
  // - Due/Learning: words_due
  // - Remaining: new/unfamiliar
  const total = stats.total_words
  if (total === 0) return <EmptyState text="No words yet" />

  const mastered = stats.words_learned
  const due = stats.words_due
  const newWords = Math.max(0, total - mastered - due)
  // Split mastered into familiar vs mastered based on accuracy
  const trueMastered = Math.round(mastered * Math.min(stats.accuracy / 100, 1) * 0.7)
  const familiar = mastered - trueMastered
  const learning = due

  const segments = [
    { label: 'New', count: newWords, color: 'var(--color-gray-400)' },
    { label: 'Learning', count: learning, color: 'var(--color-accent)' },
    { label: 'Familiar', count: familiar, color: 'var(--color-primary-light)' },
    { label: 'Mastered', count: trueMastered, color: 'var(--color-correct)' },
  ].filter(s => s.count > 0)

  // Build SVG donut
  const size = 120
  const strokeWidth = 20
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div className="flex-shrink-0 relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-gray-100)"
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {segments.map((seg, i) => {
            const pct = seg.count / total
            const dashLength = pct * circumference
            const dashOffset = -offset * circumference
            offset += pct
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            )
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-[var(--color-text-primary)]">{total}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-0">
        {segments.map((seg, i) => {
          const pct = Math.round((seg.count / total) * 100)
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-[var(--color-text-secondary)] truncate">{seg.label}</span>
              <span className="text-[var(--color-text-muted)] ml-auto text-xs font-medium">
                {seg.count} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Sessions List ────────────────────────────────────────────────

function SessionsList({ sessions }: { sessions: VocabSession[] }) {
  const toolMap = useMemo(() => {
    const map = new Map<string, { icon: string; label: string }>()
    for (const t of TOOLS) {
      map.set(t.id, { icon: t.icon, label: t.label })
    }
    return map
  }, [])

  return (
    <div className="divide-y divide-[var(--color-border)] -mx-4">
      {sessions.slice(0, 10).map((session, i) => {
        const tool = toolMap.get(session.tool_id)
        const total = session.words_reviewed
        const correct = session.correct
        const wrong = session.wrong
        const duration = session.duration_seconds

        return (
          <div
            key={session.id}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
              i % 2 === 1 ? 'bg-[var(--color-surface-alt)]' : ''
            }`}
          >
            {/* Tool icon + name */}
            <span className="text-base flex-shrink-0">{tool?.icon ?? '📝'}</span>
            <span className="font-medium text-[var(--color-text-primary)] min-w-[80px] truncate">
              {tool?.label ?? session.tool_id}
            </span>

            {/* Words reviewed */}
            <span className="text-[var(--color-text-secondary)] text-xs">
              {total} word{total !== 1 ? 's' : ''}
            </span>

            {/* Correct/Wrong */}
            <span className="flex items-center gap-1.5 text-xs ml-auto">
              <span className="text-[var(--color-correct)]">{correct}&#10003;</span>
              {wrong > 0 && (
                <span className="text-[var(--color-incorrect)]">{wrong}&#10007;</span>
              )}
            </span>

            {/* Duration */}
            {duration != null && duration > 0 && (
              <span className="text-xs text-[var(--color-text-muted)] min-w-[36px] text-right">
                {formatTime(duration)}
              </span>
            )}

            {/* Time ago */}
            <span className="text-xs text-[var(--color-text-muted)] min-w-[52px] text-right">
              {timeAgo(session.started_at)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hrs}h ${remainMins}m`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  const diffWeek = Math.floor(diffDay / 7)
  return `${diffWeek}w ago`
}
