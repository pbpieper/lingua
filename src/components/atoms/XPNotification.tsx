import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { onXPGain, type XPSource } from '@/hooks/useXP'

// ---------------------------------------------------------------------------
// Source labels for display
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<XPSource, string> = {
  flashcard_review: 'Flashcard Review',
  daily_task_category: 'Daily Task',
  daily_all_complete: 'All Tasks Complete',
  new_word: 'New Word',
  master_word: 'Word Mastered',
  game_round: 'Game Round',
  streak_bonus: 'Streak Bonus',
  writing_practice: 'Writing Practice',
  speaking_practice: 'Speaking Practice',
  reading_story: 'Reading',
  quick_practice: 'Quick Practice',
  milestone_bonus: 'Milestone',
}

interface Toast {
  id: number
  amount: number
  source: XPSource
}

let nextId = 0

/**
 * Mount this component once at the app root level.
 * It listens for XP gain events and displays stacking toasts.
 */
export function XPNotificationHost() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  useEffect(() => {
    const unsub = onXPGain((amount, source) => {
      const id = ++nextId
      setToasts(prev => [...prev.slice(-4), { id, amount, source }]) // max 5 visible

      const timer = setTimeout(() => dismiss(id), 2000)
      timers.current.set(id, timer)
    })

    return () => {
      unsub()
      for (const timer of timers.current.values()) clearTimeout(timer)
      timers.current.clear()
    }
  }, [dismiss])

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.9 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 pointer-events-auto"
            style={{
              background: 'var(--color-primary-main)',
              color: 'white',
              boxShadow: '0 4px 16px color-mix(in srgb, var(--color-primary-main) 30%, transparent)',
            }}
          >
            <span className="text-sm font-bold">+{t.amount} XP</span>
            <span className="text-xs opacity-80">
              {SOURCE_LABELS[t.source]}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
