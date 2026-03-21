import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadLearningPrefs, saveLearningPrefs } from '@/services/clientStore'

interface SessionDebriefProps {
  open: boolean
  onClose: () => void
  completedCount: number
  totalCount: number
}

/**
 * Evening-style debrief after full daily plan completion.
 * Quick feedback via toggle buttons — not lengthy.
 * Adjusts local prefs to influence the next day's plan.
 */
export function SessionDebrief({ open, onClose, completedCount, totalCount }: SessionDebriefProps) {
  const prefs = loadLearningPrefs()
  const [wordsFeedback, setWordsFeedback] = useState<-1 | 0 | 1 | null>(null)
  const [toolsFeedback, setToolsFeedback] = useState<boolean | null>(null)
  const [tomorrowFocus, setTomorrowFocus] = useState<'same' | 'new' | 'surprise' | null>(null)

  const handleSave = () => {
    let nextTarget = prefs.targetNewWordsPerDay
    if (wordsFeedback === 1) nextTarget = Math.max(5, nextTarget - 5)
    if (wordsFeedback === -1) nextTarget = Math.min(60, nextTarget + 5)

    saveLearningPrefs({
      ...prefs,
      targetNewWordsPerDay: nextTarget,
      lastNewWordsFeedback: wordsFeedback ?? prefs.lastNewWordsFeedback,
      lastToolsFeedback: toolsFeedback ?? prefs.lastToolsFeedback,
      lastTomorrowFocus: tomorrowFocus ?? prefs.lastTomorrowFocus,
    })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-labelledby="debrief-title"
            className="max-w-md w-full rounded-2xl p-6 shadow-xl"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">{'\u{1F389}'}</div>
              <h2
                id="debrief-title"
                className="text-lg font-bold text-[var(--color-text-primary)]"
              >
                Session Complete!
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {completedCount} of {totalCount} tasks done today. Great work!
              </p>
            </div>

            {/* Q1: New Words Amount */}
            <div className="mb-4">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Was {prefs.targetNewWordsPerDay} new words the right amount?
              </p>
              <div className="flex gap-2">
                {([
                  { value: 1 as const, label: 'Fewer', icon: '\u{1F4C9}' },
                  { value: 0 as const, label: 'Just right', icon: '\u{1F44D}' },
                  { value: -1 as const, label: 'More', icon: '\u{1F4C8}' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWordsFeedback(opt.value)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors
                      ${wordsFeedback === opt.value
                        ? 'border-2 border-[var(--color-primary-main)] bg-[var(--color-primary-faded)] text-[var(--color-primary-dark)]'
                        : 'border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-pale)]'
                      }`}
                  >
                    <span className="block text-base mb-0.5">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Tools Enjoyment */}
            <div className="mb-4">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Did you enjoy today&apos;s tools?
              </p>
              <div className="flex gap-2">
                {([
                  { value: true, label: 'Yes!', icon: '\u{1F44D}' },
                  { value: false, label: 'Not really', icon: '\u{1F44E}' },
                ] as const).map(opt => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setToolsFeedback(opt.value)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors
                      ${toolsFeedback === opt.value
                        ? 'border-2 border-[var(--color-primary-main)] bg-[var(--color-primary-faded)] text-[var(--color-primary-dark)]'
                        : 'border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-pale)]'
                      }`}
                  >
                    <span className="block text-base mb-0.5">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: Tomorrow Focus */}
            <div className="mb-5">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Tomorrow&apos;s focus?
              </p>
              <div className="flex gap-2">
                {([
                  { value: 'same' as const, label: 'Same topic' },
                  { value: 'new' as const, label: 'New topic' },
                  { value: 'surprise' as const, label: 'Surprise me' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTomorrowFocus(opt.value)}
                    className={`flex-1 py-2 rounded-full text-xs font-medium cursor-pointer transition-colors
                      ${tomorrowFocus === opt.value
                        ? 'border-2 border-[var(--color-primary-main)] bg-[var(--color-primary-faded)] text-[var(--color-primary-dark)]'
                        : 'border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-pale)]'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <button
              type="button"
              onClick={handleSave}
              className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer border-none
                bg-[var(--color-primary-main)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Save & Continue
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full text-xs text-[var(--color-text-muted)] cursor-pointer bg-transparent border-none underline"
            >
              Skip for now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
