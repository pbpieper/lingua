import { motion } from 'framer-motion'
import type { LevelInfo } from '@/hooks/useXP'

// ---------------------------------------------------------------------------
// Level badge color map
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Novice:       { bg: 'var(--color-gray-100)',        text: 'var(--color-gray-600)',        bar: 'var(--color-gray-400)' },
  Bronze:       { bg: '#FEF3C7',                      text: '#92400E',                      bar: '#D97706' },
  Silver:       { bg: 'var(--color-gray-200)',        text: 'var(--color-gray-700)',        bar: 'var(--color-gray-500)' },
  Gold:         { bg: '#FEF3C7',                      text: '#B45309',                      bar: '#F59E0B' },
  Platinum:     { bg: '#E0F2FE',                      text: '#0369A1',                      bar: '#0EA5E9' },
  Diamond:      { bg: '#EDE9FE',                      text: '#6D28D9',                      bar: '#8B5CF6' },
  Master:       { bg: '#FCE7F3',                      text: '#BE185D',                      bar: '#EC4899' },
  Grandmaster:  { bg: '#FEE2E2',                      text: '#991B1B',                      bar: '#EF4444' },
  Legend:       { bg: 'var(--color-accent-faded)',    text: 'var(--color-accent-dark)',     bar: 'var(--color-accent)' },
}

function colorsFor(name: string) {
  return LEVEL_COLORS[name] ?? LEVEL_COLORS.Novice
}

// ---------------------------------------------------------------------------
// Compact mode — just XP number + level badge (for header)
// ---------------------------------------------------------------------------

interface CompactProps {
  totalXP: number
  level: LevelInfo
}

export function XPBadgeCompact({ totalXP, level }: CompactProps) {
  const c = colorsFor(level.name)
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs font-bold tabular-nums"
        style={{ color: 'var(--color-primary-main)' }}
      >
        {totalXP.toLocaleString()} XP
      </span>
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: c.bg, color: c.text }}
      >
        {level.name}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full display — XP, level, progress bar to next level
// ---------------------------------------------------------------------------

interface FullProps {
  totalXP: number
  todayXP: number
  level: LevelInfo
}

export function XPDisplay({ totalXP, todayXP, level }: FullProps) {
  const c = colorsFor(level.name)
  const xpInLevel = level.nextThreshold
    ? totalXP - level.threshold
    : totalXP
  const xpNeeded = level.nextThreshold
    ? level.nextThreshold - level.threshold
    : null

  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-2"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Top row: level + XP */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: c.bg, color: c.text }}
          >
            {level.name}
          </span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {totalXP.toLocaleString()} XP
          </span>
        </div>
        {todayXP > 0 && (
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--color-correct)' }}
          >
            +{todayXP} today
          </span>
        )}
      </div>

      {/* Progress bar */}
      {xpNeeded !== null && (
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--color-gray-200)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: c.bar }}
              initial={{ width: 0 }}
              animate={{ width: `${level.progress * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span
            className="text-[10px] font-medium tabular-nums shrink-0"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {xpInLevel} / {xpNeeded}
          </span>
        </div>
      )}
    </div>
  )
}
