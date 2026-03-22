import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VocabStats } from '@/types/word'

// ─── Types ────────────────────────────────────────────────────────

interface DayData {
  date: string
  reviews: number
  correct: number
  newWords: number
  timeSeconds: number
}

interface HeatMapProps {
  stats: VocabStats | null
}

// ─── Helpers ──────────────────────────────────────────────────────

function getLast90Days(): string[] {
  const days: string[] = []
  const now = new Date()
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function getIntensity(reviews: number, maxReviews: number): number {
  if (reviews === 0) return 0
  if (maxReviews === 0) return 1
  const ratio = reviews / maxReviews
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

const INTENSITY_COLORS = [
  'var(--color-surface-alt)',     // 0: no activity
  '#9be9a8',                      // 1: light
  '#40c463',                      // 2: medium
  '#30a14e',                      // 3: strong
  '#216e39',                      // 4: max
]

const DARK_INTENSITY_COLORS = [
  'var(--color-surface-alt)',
  '#0e4429',
  '#006d32',
  '#26a641',
  '#39d353',
]

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// ─── Additional data from localStorage ───────────────────────────

function loadLocalActivityData(): Map<string, DayData> {
  const map = new Map<string, DayData>()

  // Try to read session history from localStorage
  try {
    const raw = localStorage.getItem('lingua-xp-history')
    if (raw) {
      const xpHistory: { date: string; xp: number; source: string }[] = JSON.parse(raw)
      xpHistory.forEach(entry => {
        const existing = map.get(entry.date) ?? { date: entry.date, reviews: 0, correct: 0, newWords: 0, timeSeconds: 0 }
        existing.reviews += 1
        map.set(entry.date, existing)
      })
    }
  } catch { /* ignore */ }

  return map
}

// ─── Component ────────────────────────────────────────────────────

export function VocabHeatMap({ stats }: HeatMapProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const isDark = document.documentElement.classList.contains('dark')

  const days = useMemo(() => getLast90Days(), [])

  // Merge API stats with local data
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>()

    // Initialize from API daily_stats
    if (stats?.daily_stats) {
      stats.daily_stats.forEach(d => {
        map.set(d.date, {
          date: d.date,
          reviews: d.reviews,
          correct: d.correct,
          newWords: d.new_words,
          timeSeconds: d.time_seconds,
        })
      })
    }

    // Merge local data
    const localData = loadLocalActivityData()
    localData.forEach((data, date) => {
      const existing = map.get(date)
      if (existing) {
        existing.reviews += data.reviews
      } else {
        map.set(date, data)
      }
    })

    return map
  }, [stats])

  const maxReviews = useMemo(() => {
    let max = 0
    dayDataMap.forEach(d => { if (d.reviews > max) max = d.reviews })
    return max
  }, [dayDataMap])

  const selectedData = selectedDay ? dayDataMap.get(selectedDay) : null

  // Group days into weeks (columns) for grid layout
  const weeks = useMemo(() => {
    const result: string[][] = []
    let currentWeek: string[] = []

    // Pad the start to align with day-of-week
    const firstDate = new Date(days[0] + 'T12:00:00')
    const startPad = firstDate.getDay()
    for (let i = 0; i < startPad; i++) currentWeek.push('')

    days.forEach(day => {
      currentWeek.push(day)
      if (currentWeek.length === 7) {
        result.push(currentWeek)
        currentWeek = []
      }
    })
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push('')
      result.push(currentWeek)
    }
    return result
  }, [days])

  const handleDayClick = useCallback((day: string) => {
    if (!day) return
    setSelectedDay(prev => prev === day ? null : day)
  }, [])

  const totalReviews = useMemo(() => {
    let sum = 0
    dayDataMap.forEach(d => sum += d.reviews)
    return sum
  }, [dayDataMap])

  const activeDays = useMemo(() => {
    let count = 0
    days.forEach(d => { if (dayDataMap.has(d)) count++ })
    return count
  }, [days, dayDataMap])

  const colors = isDark ? DARK_INTENSITY_COLORS : INTENSITY_COLORS

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Activity Heat Map</h3>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Last 90 days</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
          <span>{activeDays} active days</span>
          <span>{totalReviews} reviews</span>
        </div>
      </div>

      {/* Heat Map Grid */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 overflow-x-auto">
        {/* Day labels */}
        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5 mr-1 shrink-0">
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, i) => (
              <div key={i} className="h-[14px] flex items-center text-[9px] text-[var(--color-text-muted)] leading-none">{label}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="w-[14px] h-[14px]" />
                const data = dayDataMap.get(day)
                const intensity = getIntensity(data?.reviews ?? 0, maxReviews)
                const isSelected = selectedDay === day
                return (
                  <button
                    key={di}
                    onClick={() => handleDayClick(day)}
                    className={`w-[14px] h-[14px] rounded-[3px] cursor-pointer border-none transition-all ${isSelected ? 'ring-2 ring-[var(--color-primary-main)] scale-125' : 'hover:scale-110'}`}
                    style={{ background: colors[intensity] }}
                    title={`${formatDate(day)}: ${data?.reviews ?? 0} reviews`}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 justify-end">
          <span className="text-[9px] text-[var(--color-text-muted)]">Less</span>
          {colors.map((color, i) => (
            <div key={i} className="w-[12px] h-[12px] rounded-[2px]" style={{ background: color }} />
          ))}
          <span className="text-[9px] text-[var(--color-text-muted)]">More</span>
        </div>
      </div>

      {/* Selected Day Details */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-[var(--color-primary-light)] bg-[var(--color-primary-pale)] overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{formatDate(selectedDay)}</h4>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer border-none bg-transparent"
                >
                  Close
                </button>
              </div>
              {selectedData ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-center">
                    <div className="text-base font-bold text-[var(--color-text-primary)]">{selectedData.reviews}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">Reviews</div>
                  </div>
                  <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-center">
                    <div className="text-base font-bold text-green-600">{selectedData.correct}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">Correct</div>
                  </div>
                  <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-center">
                    <div className="text-base font-bold text-purple-600">{selectedData.newWords}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">New Words</div>
                  </div>
                  <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-center">
                    <div className="text-base font-bold text-blue-600">{formatTime(selectedData.timeSeconds)}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">Time Spent</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No activity recorded on this day.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
