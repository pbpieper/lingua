import { useState, useEffect, useCallback, useRef, type KeyboardEvent as ReactKB } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { getWords, startSession, endSession, submitReview } from '@/services/vocabApi'
import { isRTL } from '@/lib/csvParser'
import { fuzzyMatch } from '@/lib/textNormalize'
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty'
import { AdaptiveBanner } from '@/components/atoms/AdaptiveBanner'
import { ToggleableKeyboard } from '@/components/atoms/VirtualKeyboard'
import { useLearningLocales } from '@/hooks/useLearningLocales'
import { useXP } from '@/hooks/useXP'
import type { Word } from '@/types/word'

const QUESTIONS_PER_ROUND = 10
const AUTO_ADVANCE_MS = 1500

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Question {
  word: Word
  options: string[]
  correctIndex: number
  mode: 'forward' | 'reverse'
}

function buildQuestions(words: Word[], mode: 'forward' | 'reverse'): Question[] {
  const shuffled = shuffle(words)
  const count = Math.min(QUESTIONS_PER_ROUND, shuffled.length)
  const questions: Question[] = []

  for (let i = 0; i < count; i++) {
    const target = shuffled[i]
    const others = words.filter(w => w.id !== target.id)
    if (mode === 'forward') {
      const distractors = shuffle(others).slice(0, 3).map(w => w.translation)
      const allOptions = shuffle([target.translation, ...distractors])
      questions.push({
        word: target,
        options: allOptions,
        correctIndex: allOptions.indexOf(target.translation),
        mode: 'forward',
      })
    } else {
      const distractors = shuffle(others).slice(0, 3).map(w => w.lemma)
      const allOptions = shuffle([target.lemma, ...distractors])
      questions.push({
        word: target,
        options: allOptions,
        correctIndex: allOptions.indexOf(target.lemma),
        mode: 'reverse',
      })
    }
  }

  return questions
}

export function MultipleChoice() {
  const { userId, currentListId, activeStudyWords, activeStudyVersion } = useApp()
  const adaptive = useAdaptiveDifficulty()
  const { addXP } = useXP()
  const { targetLocale, nativeLocale } = useLearningLocales()
  const [words, setWords] = useState<Word[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [stats, setStats] = useState({ correct: 0, wrong: 0 })
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [quizDirection, setQuizDirection] = useState<'forward' | 'reverse'>('forward')
  const [quizMode, setQuizMode] = useState<'mc' | 'typing'>('mc')
  // Typing mode state
  const [typingInput, setTypingInput] = useState('')
  const [typingChecked, setTypingChecked] = useState(false)
  const [typingCorrect, setTypingCorrect] = useState<boolean | null>(null)
  const typingInputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef<number | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentQ = questions[qIndex] ?? null
  const answered = quizMode === 'mc' ? selected !== null : typingChecked

  // Determine the answer locale for virtual keyboard (the language of the expected answer)
  const answerLocale = quizDirection === 'forward' ? nativeLocale : targetLocale

  const fetchWords = useCallback(async () => {
    setLoading(true)
    try {
      let fetched: Word[]
      if (activeStudyWords && activeStudyWords.length > 0) {
        fetched = activeStudyWords.slice(0, 36)
      } else {
        fetched = await getWords(userId, { list_id: currentListId ?? undefined, limit: 30 })
      }
      setWords(fetched)
    } catch (e) {
      toast.error('Failed to load words')
    } finally {
      setLoading(false)
    }
  }, [userId, currentListId, activeStudyWords, activeStudyVersion])

  useEffect(() => {
    fetchWords()
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
  }, [fetchWords])

  useEffect(() => {
    if (words.length < 4) return
    let cancelled = false
    ;(async () => {
      try {
        const { session_id } = await startSession(userId, 'multichoice', currentListId ?? undefined)
        if (cancelled) return
        sessionRef.current = session_id
        setQuestions(buildQuestions(words, quizDirection))
        setQIndex(0)
        setSelected(null)
        setStats({ correct: 0, wrong: 0 })
        setFinished(false)
        setTypingInput('')
        setTypingChecked(false)
        setTypingCorrect(null)
      } catch {
        if (!cancelled) toast.error('Failed to start session')
      }
    })()
    return () => { cancelled = true }
  }, [words, quizDirection, userId, currentListId])

  // Focus typing input
  useEffect(() => {
    if (quizMode === 'typing' && !typingChecked && typingInputRef.current) {
      typingInputRef.current.focus()
    }
  }, [qIndex, typingChecked, quizMode])

  // Keyboard: 1-4 to select
  useEffect(() => {
    if (!currentQ || answered) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const num = parseInt(e.key)
      if (num >= 1 && num <= 4 && num <= currentQ.options.length) {
        handleSelect(num - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentQ, answered])

  const handleSelect = useCallback((optionIndex: number) => {
    if (answered || !currentQ) return
    setSelected(optionIndex)

    const isCorrect = optionIndex === currentQ.correctIndex
    adaptive.recordAnswer(isCorrect, 'meaning')

    // Update stats — need to use functional update since advance reads from state
    setStats(s => {
      const updated = {
        correct: s.correct + (isCorrect ? 1 : 0),
        wrong: s.wrong + (isCorrect ? 0 : 1),
      }
      // Schedule session end check with latest stats
      advanceTimer.current = setTimeout(() => {
        if (qIndex + 1 >= questions.length) {
          setFinished(true)
          addXP(15, 'game_round')
          if (sessionRef.current) {
            endSession(sessionRef.current, {
              words_reviewed: questions.length,
              correct: updated.correct,
              wrong: updated.wrong,
            }).catch(() => {})
          }
        } else {
          setQIndex(i => i + 1)
          setSelected(null)
        }
      }, AUTO_ADVANCE_MS)
      return updated
    })

    // Submit review
    submitReview({
      word_id: currentQ.word.id,
      quality: isCorrect ? 5 : 1,
      user_id: userId,
    }).catch(() => {})
  }, [answered, currentQ, qIndex, questions.length, userId])

  // --- Typing mode handlers ---
  const getExpectedAnswer = useCallback((q: Question): string => {
    return q.mode === 'forward' ? q.word.translation : q.word.lemma
  }, [])

  const handleTypingCheck = useCallback(() => {
    if (!currentQ || typingChecked) return
    const trimmed = typingInput.trim()
    if (!trimmed) return

    const expected = getExpectedAnswer(currentQ)
    const isCorrect = fuzzyMatch(trimmed, expected)
    adaptive.recordAnswer(isCorrect, 'spelling')
    setTypingChecked(true)
    setTypingCorrect(isCorrect)
    setStats(s => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      wrong: s.wrong + (isCorrect ? 0 : 1),
    }))

    submitReview({
      word_id: currentQ.word.id,
      quality: isCorrect ? 5 : 1,
      user_id: userId,
    }).catch(() => {})
  }, [currentQ, typingInput, typingChecked, userId, getExpectedAnswer, adaptive])

  const handleTypingNext = useCallback(() => {
    if (qIndex + 1 >= questions.length) {
      setFinished(true)
      addXP(15, 'game_round')
      if (sessionRef.current) {
        endSession(sessionRef.current, {
          words_reviewed: questions.length,
          correct: stats.correct,
          wrong: stats.wrong,
        }).catch(() => {})
      }
      return
    }
    setQIndex(i => i + 1)
    setTypingInput('')
    setTypingChecked(false)
    setTypingCorrect(null)
  }, [qIndex, questions.length, stats, addXP])

  const handleTypingKeyDown = (e: ReactKB<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!typingChecked) handleTypingCheck()
      else handleTypingNext()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading words...</span>
      </div>
    )
  }

  if (!finished && words.length >= 4 && questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Preparing quiz…</span>
      </div>
    )
  }

  if (words.length < 4) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="text-lg font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Not enough words
        </span>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Upload vocabulary first (need at least 4 words).
        </span>
      </div>
    )
  }

  if (finished) {
    const total = stats.correct + stats.wrong
    const pct = total > 0 ? Math.round((stats.correct / total) * 100) : 0

    // Build review list
    const reviewItems = questions.map((q) => ({
      lemma: q.word.lemma,
      translation: q.word.translation,
    }))

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-12 gap-6"
      >
        <h2
          className="text-3xl font-bold"
          style={{ color: pct >= 70 ? 'var(--color-correct)' : 'var(--color-primary-main)' }}
        >
          {pct >= 90 ? 'Excellent!' : pct >= 70 ? 'Well Done!' : pct >= 50 ? 'Keep Practicing' : 'Keep Going!'}
        </h2>

        <div
          className="rounded-2xl px-10 py-8 flex flex-col items-center gap-6 w-full max-w-md"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 text-center w-full">
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-correct)' }}>
                {stats.correct}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Correct</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-incorrect)' }}>
                {stats.wrong}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Wrong</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-primary-main)' }}>
                {pct}%
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Accuracy</div>
            </div>
          </div>

          {/* Review list */}
          <div className="w-full border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Words Reviewed
            </h3>
            <div className="flex flex-col gap-1.5">
              {reviewItems.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm px-2 py-1 rounded"
                  style={{ background: i % 2 === 0 ? 'var(--color-surface-alt)' : 'transparent' }}
                >
                  <span style={{ color: 'var(--color-text-primary)' }} dir={isRTL(questions[i]?.word.language_from ?? '') ? 'rtl' : undefined}>{item.lemma}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }} dir={isRTL(questions[i]?.word.language_to ?? '') ? 'rtl' : undefined}>{item.translation}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={fetchWords}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Play Again
        </button>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <AdaptiveBanner state={adaptive} />
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Quiz
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Recognition (pick translation) vs recall (pick target word)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setQuizDirection('forward')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors
              ${quizDirection === 'forward'
                ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'}`}
          >
            See target → pick meaning
          </button>
          <button
            type="button"
            onClick={() => setQuizDirection('reverse')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors
              ${quizDirection === 'reverse'
                ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'}`}
          >
            See meaning → pick target
          </button>

          {/* Separator */}
          <div className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />

          {/* Mode toggle: MC vs typing */}
          <button
            type="button"
            onClick={() => setQuizMode('mc')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors
              ${quizMode === 'mc'
                ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'}`}
          >
            Multiple Choice
          </button>
          <button
            type="button"
            onClick={() => setQuizMode('typing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors
              ${quizMode === 'typing'
                ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'}`}
          >
            Typing
          </button>
        </div>
        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs font-medium" style={{ color: 'var(--color-correct)' }}>
            {stats.correct}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/</span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-incorrect)' }}>
            {stats.wrong}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--color-gray-200)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--color-primary-main)' }}
          initial={false}
          animate={{ width: `${((qIndex + (answered ? 1 : 0)) / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question card */}
      {currentQ && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${qIndex}-${quizMode}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl px-8 py-10 flex flex-col items-center gap-8"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            {/* Question number */}
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Question {qIndex + 1} of {questions.length}
            </span>

            {/* Word to translate */}
            <div className="flex flex-col items-center gap-2">
              <h2
                className="text-3xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {currentQ.mode === 'forward' ? (
                  <span dir={isRTL(currentQ.word.language_from) ? 'rtl' : undefined}>{currentQ.word.lemma}</span>
                ) : (
                  <span dir={isRTL(currentQ.word.language_to) ? 'rtl' : undefined}>{currentQ.word.translation}</span>
                )}
              </h2>
              {currentQ.word.part_of_speech && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: 'var(--color-primary-faded)',
                    color: 'var(--color-primary-main)',
                  }}
                >
                  {currentQ.word.part_of_speech}
                </span>
              )}
            </div>

            {/* MC mode: options grid */}
            {quizMode === 'mc' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {currentQ.options.map((option, i) => {
                    const isCorrectOption = i === currentQ.correctIndex
                    const isSelected = selected === i

                    let bg = 'var(--color-surface-alt)'
                    let borderColor = 'var(--color-border)'
                    let textColor = 'var(--color-text-primary)'

                    if (selected !== null) {
                      if (isCorrectOption) {
                        bg = 'rgba(5, 150, 105, 0.1)'
                        borderColor = 'var(--color-correct)'
                        textColor = 'var(--color-correct)'
                      } else if (isSelected && !isCorrectOption) {
                        bg = 'rgba(239, 68, 68, 0.1)'
                        borderColor = 'var(--color-incorrect)'
                        textColor = 'var(--color-incorrect)'
                      }
                    }

                    return (
                      <motion.button
                        key={i}
                        onClick={() => handleSelect(i)}
                        disabled={selected !== null}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-left cursor-pointer disabled:cursor-default transition-colors"
                        style={{
                          background: bg,
                          border: `2px solid ${borderColor}`,
                          color: textColor,
                        }}
                        whileHover={selected === null ? { scale: 1.02 } : {}}
                        whileTap={selected === null ? { scale: 0.98 } : {}}
                      >
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            background: selected !== null && isCorrectOption
                              ? 'var(--color-correct)'
                              : selected !== null && isSelected && !isCorrectOption
                                ? 'var(--color-incorrect)'
                                : 'var(--color-primary-faded)',
                            color: selected !== null && (isCorrectOption || (isSelected && !isCorrectOption))
                              ? 'white'
                              : 'var(--color-primary-main)',
                          }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="text-sm font-medium"
                          dir={isRTL(
                            currentQ.mode === 'forward' ? currentQ.word.language_to : currentQ.word.language_from
                          ) ? 'rtl' : undefined}
                        >
                          {option}
                        </span>
                        {selected !== null && isCorrectOption && (
                          <svg className="ml-auto shrink-0" width="18" height="18" viewBox="0 0 20 20" fill="none">
                            <path d="M4 10l4 4 8-8" stroke="var(--color-correct)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {selected !== null && isSelected && !isCorrectOption && (
                          <svg className="ml-auto shrink-0" width="18" height="18" viewBox="0 0 20 20" fill="none">
                            <path d="M6 6l8 8M14 6l-8 8" stroke="var(--color-incorrect)" strokeWidth="2.5" strokeLinecap="round"/>
                          </svg>
                        )}
                      </motion.button>
                    )
                  })}
                </div>

                {/* Keyboard hint */}
                {selected === null && (
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Press 1-{currentQ.options.length} to select
                  </span>
                )}
              </>
            )}

            {/* Typing mode */}
            {quizMode === 'typing' && (
              <>
                {!typingChecked && (
                  <div className="flex flex-col items-center gap-2 w-full max-w-sm">
                    <div className="flex items-center gap-3 w-full">
                      <input
                        ref={typingInputRef}
                        type="text"
                        value={typingInput}
                        onChange={e => setTypingInput(e.target.value)}
                        onKeyDown={handleTypingKeyDown}
                        placeholder={`Type the ${currentQ.mode === 'forward' ? 'translation' : 'target word'}...`}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{
                          background: 'var(--color-surface-alt)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                        dir={isRTL(
                          currentQ.mode === 'forward' ? currentQ.word.language_to : currentQ.word.language_from
                        ) ? 'rtl' : undefined}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        onClick={handleTypingCheck}
                        disabled={!typingInput.trim()}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'var(--color-primary-main)' }}
                      >
                        Check
                      </button>
                    </div>
                    <ToggleableKeyboard
                      locale={answerLocale}
                      onChar={char => { setTypingInput(prev => prev + char); typingInputRef.current?.focus() }}
                      onBackspace={() => { setTypingInput(prev => prev.slice(0, -1)); typingInputRef.current?.focus() }}
                      onSpace={() => { setTypingInput(prev => prev + ' '); typingInputRef.current?.focus() }}
                    />
                  </div>
                )}

                {typingChecked && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="flex items-center gap-2">
                      {typingCorrect ? (
                        <>
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M4 10l4 4 8-8" stroke="var(--color-correct)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-sm font-semibold" style={{ color: 'var(--color-correct)' }}>
                            Correct!
                          </span>
                        </>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M6 6l8 8M14 6l-8 8" stroke="var(--color-incorrect)" strokeWidth="2.5" strokeLinecap="round"/>
                          </svg>
                          <span className="text-sm font-semibold" style={{ color: 'var(--color-incorrect)' }}>
                            Wrong — the answer was{' '}
                            <strong
                              dir={isRTL(
                                currentQ.mode === 'forward' ? currentQ.word.language_to : currentQ.word.language_from
                              ) ? 'rtl' : undefined}
                            >
                              {getExpectedAnswer(currentQ)}
                            </strong>
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={handleTypingNext}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                      style={{ background: 'var(--color-primary-main)' }}
                    >
                      {qIndex + 1 >= questions.length ? 'Finish' : 'Next'}
                    </button>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
