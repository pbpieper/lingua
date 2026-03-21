import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { onLevelUp, type LevelInfo } from '@/hooks/useXP'

const LEVEL_EMOJIS: Record<string, string> = {
  Novice: '\u{1F331}',
  Bronze: '\u{1F949}',
  Silver: '\u{1F948}',
  Gold: '\u{1F947}',
  Platinum: '\u{1F48E}',
  Diamond: '\u2728',
  Master: '\u{1F451}',
  Grandmaster: '\u{1F525}',
  Legend: '\u{1F31F}',
}

const CONFETTI = ['\u{1F389}', '\u2B50', '\u{1F31F}', '\u{1F4AB}', '\u2728', '\u{1F388}', '\u{1F38A}', '\u{1F386}']

/**
 * Full-screen level-up celebration overlay.
 * Mount once at the app root — listens to the level-up event bus.
 */
export function LevelUpCelebration() {
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null)

  useEffect(() => {
    const unsub = onLevelUp((newLevel) => {
      setLevelInfo(newLevel)
    })
    return unsub
  }, [])

  const dismiss = useCallback(() => setLevelInfo(null), [])

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!levelInfo) return
    const timer = setTimeout(dismiss, 4000)
    return () => clearTimeout(timer)
  }, [levelInfo, dismiss])

  return (
    <AnimatePresence>
      {levelInfo && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={dismiss}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Confetti particles */}
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute text-2xl pointer-events-none select-none"
              initial={{
                opacity: 0,
                x: 0,
                y: 0,
                scale: 0,
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: (Math.random() - 0.5) * 500,
                y: (Math.random() - 0.5) * 400 - 100,
                scale: [0, 1.2, 1, 0.5],
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: 2.5,
                delay: 0.1 + i * 0.08,
                ease: 'easeOut',
              }}
              style={{
                left: '50%',
                top: '50%',
              }}
            >
              {CONFETTI[i % CONFETTI.length]}
            </motion.span>
          ))}

          {/* Card */}
          <motion.div
            className="relative z-10 rounded-3xl px-10 py-8 text-center max-w-sm mx-4"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-main), var(--color-primary-dark))',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
            initial={{ scale: 0.3, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{
              type: 'spring',
              stiffness: 250,
              damping: 20,
              delay: 0.1,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Level emoji */}
            <motion.div
              className="text-6xl mb-3"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.3 }}
            >
              {LEVEL_EMOJIS[levelInfo.name] || '\u{1F3C6}'}
            </motion.div>

            <motion.p
              className="text-white/70 text-sm font-medium uppercase tracking-widest mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Level Up!
            </motion.p>

            <motion.h2
              className="text-white text-3xl font-bold mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {levelInfo.name}
            </motion.h2>

            <motion.p
              className="text-white/80 text-lg font-semibold mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              Level {levelInfo.level}
            </motion.p>

            <motion.button
              onClick={dismiss}
              className="px-6 py-2 rounded-full text-sm font-semibold cursor-pointer border-none
                bg-white/20 text-white hover:bg-white/30 transition-colors backdrop-blur-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              Keep going!
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
