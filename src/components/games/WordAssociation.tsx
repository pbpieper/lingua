import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { getWords, startSession, endSession, submitReview } from '@/services/vocabApi'
import { isRTL } from '@/lib/csvParser'
import { useXP } from '@/hooks/useXP'
import type { Word } from '@/types/word'

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type RelationType = 'same_tag' | 'same_pos' | 'same_list' | 'random'

interface Question {
  word: Word
  correctAnswer: Word
  options: Word[]
  relation: RelationType
  relationLabel: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

/** Find a related word from the pool based on shared attributes */
function findRelatedWord(target: Word, pool: Word[]): { related: Word; relation: RelationType; label: string } | null {
  const candidates = pool.filter(w => w.id !== target.id)
  if (candidates.length === 0) return null

  // Try same tags first
  if (target.tags.length > 0) {
    const sameTag = candidates.filter(w =>
      w.tags.some(t => target.tags.includes(t))
    )
    if (sameTag.length > 0) {
      const related = sameTag[Math.floor(Math.random() * sameTag.length)]
      const sharedTag = related.tags.find(t => target.tags.includes(t)) ?? 'related'
      return { related, relation: 'same_tag', label: `Same category: ${sharedTag}` }
    }
  }

  // Try same part of speech
  if (target.part_of_speech) {
    const samePOS = candidates.filter(w => w.part_of_speech === target.part_of_speech)
    if (samePOS.length > 0) {
      const related = samePOS[Math.floor(Math.random() * samePOS.length)]
      return { related, relation: 'same_pos', label: `Same type: ${target.part_of_speech}` }
    }
  }

  // Fallback: random from same list
  const related = candidates[Math.floor(Math.random() * candidates.length)]
  return { related, relation: 'same_list', label: 'From the same list' }
}

/** Build a question: pick a target word, find a related word, add 3 distractors */
function buildQuestion(words: Word[], usedIds: Set<number>): Question | null {
  const available = words.filter(w => !usedIds.has(w.id))
  if (available.length < 5) return null

  const target = available[Math.floor(Math.random() * available.length)]
  const result = findRelatedWord(target, available)
  if (!result) return null

  const { related, relation, label } = result

  // Pick 3 distractors (not the target or related word)
  const distractors = pickRandom(
    available.filter(w => w.id !== target.id && w.id !== related.id),
    3
  )

  if (distractors.length < 3) return null

  const options = shuffle([related, ...distractors])

  return {
    word: target,
    correctAnswer: related,
    options,
    relation,
    relationLabel: label,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TOTAL_QUESTIONS = 10

export function WordAssociation() {
  const { userId, currentListId, activeStudyWords, activeStudyVersion } = useApp()
  const { addXP } = useXP()

  const [, setWords] = useState<Word[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null) // word id
  const [checked, setChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<'playing' | 'results'>('playing')

  const sessionRef = useRef<number | null>(null)

  // Load words and build questions
  const loadGame = useCallback(async () => {
    setLoading(true)
    try {
      let fetched: Word[]
      if (activeStudyWords && activeStudyWords.length > 0) {
        fetched = activeStudyWords
      } else {
        fetched = await getWords(userId, { list_id: currentListId ?? undefined, limit: 100 })
      }

      if (fetched.length < 8) {
        toast.error('Need at least 8 words to play Word Association')
        setLoading(false)
        return
      }

      setWords(fetched)

      // Build questions
      const qs: Question[] = []
      const usedIds = new Set<number>()
      for (let i = 0; i < TOTAL_QUESTIONS && qs.length < TOTAL_QUESTIONS; i++) {
        const q = buildQuestion(fetched, usedIds)
        if (q) {
          qs.push(q)
          usedIds.add(q.word.id)
        }
      }

      if (qs.length < 3) {
        toast.error('Not enough word variety to build questions')
        setLoading(false)
        return
      }

      setQuestions(qs)
      setCurrentIndex(0)
      setSelected(null)
      setChecked(false)
      setStreak(0)
      setBestStreak(0)
      setTotalCorrect(0)
      setPhase('playing')

      const { session_id } = await startSession(userId, 'word-association', currentListId ?? undefined)
      sessionRef.current = session_id
    } catch {
      toast.error('Failed to load words')
    } finally {
      setLoading(false)
    }
  }, [userId, currentListId, activeStudyWords, activeStudyVersion])

  useEffect(() => {
    loadGame()
  }, [loadGame])

  // Handle option selection
  const handleSelect = useCallback((wordId: number) => {
    if (checked) return
    setSelected(wordId)
  }, [checked])

  // Check answer
  const handleCheck = useCallback(() => {
    if (selected === null || checked) return
    const q = questions[currentIndex]
    if (!q) return

    const correct = selected === q.correctAnswer.id
    setIsCorrect(correct)
    setChecked(true)

    if (correct) {
      setTotalCorrect(c => c + 1)
      setStreak(s => {
        const next = s + 1
        setBestStreak(b => Math.max(b, next))
        return next
      })
      submitReview({ word_id: q.word.id, quality: 5, user_id: userId }).catch(() => {})
    } else {
      setStreak(0)
      submitReview({ word_id: q.word.id, quality: 1, user_id: userId }).catch(() => {})
    }
  }, [selected, checked, questions, currentIndex, userId])

  // Next question
  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= questions.length) {
      // Finish game
      setPhase('results')
      const xp = Math.max(5, totalCorrect * 3)
      addXP(xp, 'game_round')

      if (sessionRef.current) {
        endSession(sessionRef.current, {
          words_reviewed: questions.length,
          correct: totalCorrect + (isCorrect ? 1 : 0),
          wrong: questions.length - (totalCorrect + (isCorrect ? 1 : 0)),
          score_data: { bestStreak },
        }).catch(() => {})
      }
    } else {
      setCurrentIndex(i => i + 1)
      setSelected(null)
      setChecked(false)
      setIsCorrect(false)
    }
  }, [currentIndex, questions, totalCorrect, isCorrect, bestStreak, addXP])

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (checked) handleNext()
      else if (selected !== null) handleCheck()
    }
  }, [checked, selected, handleNext, handleCheck])

  // --- LOADING ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading words...</span>
      </div>
    )
  }

  if (questions.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="text-lg font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Not enough words
        </span>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Upload more vocabulary (need at least 8 words with variety).
        </span>
      </div>
    )
  }

  // --- RESULTS ---
  if (phase === 'results') {
    const finalCorrect = totalCorrect + (isCorrect ? 1 : 0)
    const pct = Math.round((finalCorrect / questions.length) * 100)

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12 gap-6"
      >
        <h2
          className="text-3xl font-bold"
          style={{ color: pct >= 70 ? 'var(--color-correct)' : 'var(--color-primary-main)' }}
        >
          {pct >= 90 ? 'Amazing!' : pct >= 70 ? 'Well Done!' : pct >= 50 ? 'Keep Practicing' : 'Keep Going!'}
        </h2>

        <div
          className="rounded-2xl px-10 py-8 flex flex-col items-center gap-5 w-full max-w-md"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-correct)' }}>{finalCorrect}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Correct</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-incorrect)' }}>{questions.length - finalCorrect}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Wrong</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-accent-main)' }}>{bestStreak}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Best Streak</div>
            </div>
          </div>
        </div>

        <button
          onClick={loadGame}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Play Again
        </button>
      </motion.div>
    )
  }

  // --- PLAYING ---
  const q = questions[currentIndex]
  if (!q) return null
  const progress = ((currentIndex + (checked ? 1 : 0)) / questions.length) * 100

  return (
    <div className="flex flex-col gap-5" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Word Association
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {currentIndex + 1} / {questions.length}
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

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-gray-200)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--color-primary-main)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl px-8 py-8 flex flex-col items-center gap-6"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          {/* Prompt */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Which word is related to
            </span>
            <span
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
              dir={isRTL(q.word.language_from) ? 'rtl' : undefined}
            >
              {q.word.lemma}
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              ({q.word.translation})
            </span>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
            {q.options.map(opt => {
              const isSelected = selected === opt.id
              const isAnswer = opt.id === q.correctAnswer.id
              let bg = 'var(--color-surface-alt)'
              let border = 'var(--color-border)'
              let color = 'var(--color-text-primary)'

              if (checked) {
                if (isAnswer) {
                  bg = 'rgba(5,150,105,0.1)'
                  border = 'var(--color-correct)'
                  color = 'var(--color-correct)'
                } else if (isSelected && !isAnswer) {
                  bg = 'rgba(239,68,68,0.1)'
                  border = 'var(--color-incorrect)'
                  color = 'var(--color-incorrect)'
                }
              } else if (isSelected) {
                bg = 'var(--color-primary-faded)'
                border = 'var(--color-primary-main)'
                color = 'var(--color-primary-main)'
              }

              return (
                <motion.button
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className="px-4 py-3 rounded-xl text-sm font-medium cursor-pointer text-left transition-all"
                  style={{ background: bg, border: `2px solid ${border}`, color }}
                  whileHover={!checked ? { scale: 1.02 } : {}}
                  whileTap={!checked ? { scale: 0.98 } : {}}
                >
                  <span dir={isRTL(opt.language_from) ? 'rtl' : undefined}>{opt.lemma}</span>
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', opacity: 0.8 }}>
                    {opt.translation}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {/* Relation explanation (after check) */}
          {checked && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <span
                className="text-sm font-semibold"
                style={{ color: isCorrect ? 'var(--color-correct)' : 'var(--color-incorrect)' }}
              >
                {isCorrect ? 'Correct!' : 'Not quite'}
              </span>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {q.relationLabel}
              </div>
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!checked ? (
              <button
                onClick={handleCheck}
                disabled={selected === null}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--color-primary-main)' }}
              >
                Check
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ background: 'var(--color-primary-main)' }}
              >
                {currentIndex + 1 >= questions.length ? 'See Results' : 'Next'}
              </button>
            )}
          </div>

          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Press Enter to {checked ? 'continue' : 'check'}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
