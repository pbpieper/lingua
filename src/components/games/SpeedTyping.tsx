import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { getWords, startSession, endSession, submitReview } from '@/services/vocabApi'
import { normalizeForComparison } from '@/lib/textNormalize'
import { isRTL } from '@/lib/csvParser'
import { useXP } from '@/hooks/useXP'
import type { Word } from '@/types/word'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_DURATION = 60 // seconds
const SPEED_BONUS_THRESHOLD = 3 // seconds — if answered within this, get speed bonus
const HIGH_SCORE_KEY = 'lingua-speed-typing-highscore'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0
  } catch {
    return 0
  }
}

function saveHighScore(score: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score))
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = 'setup' | 'playing' | 'results'

export function SpeedTyping() {
  const { userId, currentListId, activeStudyWords, activeStudyVersion } = useApp()
  const { addXP } = useXP()

  const [phase, setPhase] = useState<Phase>('setup')
  const [words, setWords] = useState<Word[]>([])
  const [queue, setQueue] = useState<Word[]>([])
  const [currentWord, setCurrentWord] = useState<Word | null>(null)
  const [userInput, setUserInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [highScore, setHighScore] = useState(loadHighScore)
  const [loading, setLoading] = useState(false)
  const [flash, setFlash] = useState<'correct' | 'incorrect' | null>(null)
  const [wordStartTime, setWordStartTime] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionRef = useRef<number | null>(null)

  // Load words
  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      let fetched: Word[]
      if (activeStudyWords && activeStudyWords.length > 0) {
        fetched = activeStudyWords
      } else {
        fetched = await getWords(userId, { list_id: currentListId ?? undefined, limit: 100 })
      }
      if (fetched.length < 4) {
        toast.error('Need at least 4 words to play')
        setLoading(false)
        return
      }
      setWords(fetched)
      setLoading(false)
    } catch {
      toast.error('Failed to load words')
      setLoading(false)
    }
  }, [userId, currentListId, activeStudyWords, activeStudyVersion])

  useEffect(() => {
    loadWords()
  }, [loadWords])

  // Build a fresh queue from words
  const buildQueue = useCallback(() => {
    // Repeat and shuffle so there's always enough words
    const pool = [...words, ...words, ...words]
    return shuffle(pool)
  }, [words])

  // Start the game
  const startGame = useCallback(async () => {
    const q = buildQueue()
    const first = q.pop()!
    setQueue(q)
    setCurrentWord(first)
    setUserInput('')
    setTimeLeft(GAME_DURATION)
    setScore(0)
    setCorrect(0)
    setWrong(0)
    setStreak(0)
    setBestStreak(0)
    setFlash(null)
    setWordStartTime(Date.now())
    setPhase('playing')

    try {
      const { session_id } = await startSession(userId, 'speed-typing', currentListId ?? undefined)
      sessionRef.current = session_id
    } catch { /* continue anyway */ }

    setTimeout(() => inputRef.current?.focus(), 100)
  }, [buildQueue, userId, currentListId])

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing') return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  // End game when timer hits 0
  useEffect(() => {
    if (phase === 'playing' && timeLeft === 0) {
      finishGame()
    }
  }, [timeLeft, phase])

  const finishGame = useCallback(() => {
    setPhase('results')
    if (timerRef.current) clearInterval(timerRef.current)

    // Calculate final score with streak bonus
    const finalScore = score
    const xpEarned = Math.min(50, Math.floor(finalScore / 20))
    if (xpEarned > 0) addXP(xpEarned, 'game_round')

    // Save high score
    if (finalScore > highScore) {
      setHighScore(finalScore)
      saveHighScore(finalScore)
    }

    // End session
    if (sessionRef.current) {
      endSession(sessionRef.current, {
        words_reviewed: correct + wrong,
        correct,
        wrong,
        score_data: { score: finalScore, time: GAME_DURATION },
      }).catch(() => {})
    }
  }, [score, correct, wrong, highScore, addXP])

  // Advance to next word
  const nextWord = useCallback(() => {
    let q = [...queue]
    if (q.length === 0) q = buildQueue()
    const next = q.pop()!
    setQueue(q)
    setCurrentWord(next)
    setUserInput('')
    setWordStartTime(Date.now())
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [queue, buildQueue])

  // Check answer
  const handleSubmit = useCallback(() => {
    if (!currentWord || !userInput.trim()) return

    const expected = normalizeForComparison(currentWord.translation)
    const answer = normalizeForComparison(userInput)
    const elapsed = (Date.now() - wordStartTime) / 1000
    const isCorrect = answer === expected

    if (isCorrect) {
      const speedBonus = elapsed <= SPEED_BONUS_THRESHOLD ? 2 : 1
      const streakBonus = Math.floor(streak / 5) + 1
      const points = 10 * speedBonus * streakBonus
      setScore(s => s + points)
      setCorrect(c => c + 1)
      setStreak(s => {
        const next = s + 1
        setBestStreak(b => Math.max(b, next))
        return next
      })
      setFlash('correct')
      submitReview({ word_id: currentWord.id, quality: 5, user_id: userId }).catch(() => {})
    } else {
      setWrong(w => w + 1)
      setStreak(0)
      setFlash('incorrect')
      submitReview({ word_id: currentWord.id, quality: 1, user_id: userId }).catch(() => {})
    }

    setTimeout(() => {
      setFlash(null)
      nextWord()
    }, 400)
  }, [currentWord, userInput, wordStartTime, streak, userId, nextWord])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // --- LOADING ---
  if (loading || words.length < 4) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="text-lg font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {loading ? 'Loading words...' : 'Not enough words'}
        </span>
        {!loading && (
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Upload vocabulary first (need at least 4 words).
          </span>
        )}
      </div>
    )
  }

  // --- SETUP ---
  if (phase === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Speed Typing Challenge
        </h1>
        <p className="text-sm text-center max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
          Translate words as fast as you can! You have {GAME_DURATION} seconds.
          Faster answers and streaks multiply your score.
        </p>

        {highScore > 0 && (
          <div
            className="rounded-xl px-6 py-3 flex items-center gap-3"
            style={{
              background: 'var(--color-accent-faded)',
              border: '1px solid var(--color-accent-light)',
            }}
          >
            <span className="text-lg">&#127942;</span>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>High Score</div>
              <div className="text-xl font-bold" style={{ color: 'var(--color-accent-main)' }}>{highScore}</div>
            </div>
          </div>
        )}

        <button
          onClick={startGame}
          className="px-8 py-3 rounded-xl text-base font-semibold text-white cursor-pointer"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Start Game
        </button>
      </div>
    )
  }

  // --- PLAYING ---
  if (phase === 'playing') {
    const timerPct = (timeLeft / GAME_DURATION) * 100
    const timerColor = timeLeft > 15 ? 'var(--color-primary-main)' : timeLeft > 5 ? 'var(--color-accent-main)' : 'var(--color-incorrect)'

    return (
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Speed Typing
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Score: <strong style={{ color: 'var(--color-primary-main)' }}>{score}</strong>
            </span>
            {streak >= 3 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'var(--color-accent-faded)', color: 'var(--color-accent-main)' }}
              >
                {streak} streak!
              </span>
            )}
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-gray-200)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: timerColor }}
            animate={{ width: `${timerPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span>{correct} correct / {wrong} wrong</span>
          <span className="font-mono tabular-nums font-semibold" style={{ color: timerColor }}>
            {timeLeft}s
          </span>
        </div>

        {/* Word card */}
        <AnimatePresence mode="wait">
          {currentWord && (
            <motion.div
              key={currentWord.id + '-' + correct + wrong}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl px-8 py-10 flex flex-col items-center gap-6"
              style={{
                background: flash === 'correct'
                  ? 'rgba(5,150,105,0.08)'
                  : flash === 'incorrect'
                    ? 'rgba(239,68,68,0.08)'
                    : 'var(--color-surface)',
                border: `2px solid ${
                  flash === 'correct' ? 'var(--color-correct)'
                    : flash === 'incorrect' ? 'var(--color-incorrect)'
                      : 'var(--color-border)'
                }`,
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              {/* The word to translate */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Translate this word
                </span>
                <span
                  className="text-3xl font-bold"
                  style={{ color: 'var(--color-text-primary)' }}
                  dir={isRTL(currentWord.language_from) ? 'rtl' : undefined}
                >
                  {currentWord.lemma}
                </span>
                {currentWord.part_of_speech && (
                  <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                    {currentWord.part_of_speech}
                  </span>
                )}
              </div>

              {/* Input */}
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type the translation..."
                autoComplete="off"
                className="w-full max-w-sm px-4 py-3 rounded-xl text-center text-lg"
                style={{
                  background: 'var(--color-surface-alt)',
                  border: '2px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />

              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Press Enter to submit
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // --- RESULTS ---
  const isNewHighScore = score >= highScore && score > 0
  const xpEarned = Math.min(50, Math.floor(score / 20))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 gap-6"
    >
      <h2
        className="text-3xl font-bold"
        style={{ color: isNewHighScore ? 'var(--color-accent-main)' : 'var(--color-primary-main)' }}
      >
        {isNewHighScore ? 'New High Score!' : 'Time\'s Up!'}
      </h2>

      <div
        className="rounded-2xl px-10 py-8 flex flex-col items-center gap-5 w-full max-w-md"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Big score */}
        <div className="text-center">
          <div className="text-5xl font-bold" style={{ color: 'var(--color-primary-main)' }}>
            {score}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>points</div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4 text-center w-full">
          <div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-correct)' }}>{correct}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Correct</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-incorrect)' }}>{wrong}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Wrong</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-accent-main)' }}>{bestStreak}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Best Streak</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary-main)' }}>+{xpEarned}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>XP</div>
          </div>
        </div>

        {/* High score comparison */}
        {!isNewHighScore && highScore > 0 && (
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            High score: {highScore}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={startGame}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Play Again
        </button>
      </div>
    </motion.div>
  )
}
