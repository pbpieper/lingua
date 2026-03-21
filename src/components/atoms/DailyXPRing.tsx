import { motion } from 'framer-motion'

interface Props {
  todayXP: number
  dailyGoal: number
  size?: number
}

/**
 * Circular progress ring showing daily XP progress toward the goal.
 */
export function DailyXPRing({ todayXP, dailyGoal, size = 64 }: Props) {
  const progress = Math.min(1, todayXP / dailyGoal)
  const complete = progress >= 1
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background circle */}
      <svg width={size} height={size} className="absolute" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={complete ? 'var(--color-correct)' : 'var(--color-primary-main)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>

      {/* Center text */}
      <div className="flex flex-col items-center z-10">
        {complete ? (
          <span className="text-lg">&#10003;</span>
        ) : (
          <>
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {todayXP}
            </span>
            <span className="text-[8px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
              /{dailyGoal}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
