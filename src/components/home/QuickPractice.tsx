import { motion } from 'framer-motion'
import type { LinguaToolId } from '@/types/tools'

interface QuickOption {
  id: string
  label: string
  icon: string
  toolId: LinguaToolId
  duration: string
  xpBonus: number
  description: string
}

const QUICK_OPTIONS: QuickOption[] = [
  {
    id: 'quick-cards',
    label: '5 Quick Cards',
    icon: '\u{1F0CF}',
    toolId: 'flashcards',
    duration: '2 min',
    xpBonus: 10,
    description: 'Review 5 flashcards',
  },
  {
    id: 'speed-match',
    label: 'Speed Match',
    icon: '\u{1F517}',
    toolId: 'match',
    duration: '3 min',
    xpBonus: 15,
    description: 'Fast word-translation matching',
  },
  {
    id: 'mini-quiz',
    label: '1 Min Quiz',
    icon: '\u2753',
    toolId: 'multichoice',
    duration: '1 min',
    xpBonus: 10,
    description: 'Quick multiple choice round',
  },
  {
    id: 'word-sprint',
    label: 'Word Sprint',
    icon: '\u{1F3C3}',
    toolId: 'fillblank',
    duration: '5 min',
    xpBonus: 20,
    description: 'Fill in the blank speed drill',
  },
]

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

interface Props {
  onStartPractice: (toolId: LinguaToolId) => void
  hasWords: boolean
}

export function QuickPractice({ onStartPractice, hasWords }: Props) {
  if (!hasWords) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">&#9889;</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Quick Practice
        </h3>
      </div>

      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {QUICK_OPTIONS.map(opt => (
          <motion.button
            key={opt.id}
            variants={item}
            type="button"
            onClick={() => onStartPractice(opt.toolId)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]
              px-3 py-3 cursor-pointer transition-all hover:border-[var(--color-primary-light)] hover:shadow-sm
              active:scale-[0.97]"
          >
            <span className="text-xl">{opt.icon}</span>
            <span className="text-xs font-semibold text-[var(--color-text-primary)] leading-tight text-center">
              {opt.label}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">{opt.duration}</span>
              <span className="text-[10px] font-semibold text-[var(--color-primary-main)]">+{opt.xpBonus} XP</span>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  )
}
