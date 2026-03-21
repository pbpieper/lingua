import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import {
  getWords,
  getDueWords,
  getClozeSet,
  generateSentences,
  submitReview,
  startSession,
  endSession,
} from '@/services/vocabApi'
import type { Sentence } from '@/services/vocabApi'
import type { Word } from '@/types/word'
import { isRTL } from '@/lib/csvParser'
import { fuzzyMatch, normalizeForComparison } from '@/lib/textNormalize'
import { ToggleableKeyboard } from '@/components/atoms/VirtualKeyboard'
import { useXP } from '@/hooks/useXP'
import { useLearningLocales } from '@/hooks/useLearningLocales'

type Phase = 'start' | 'generating' | 'practice' | 'finished'

export function ClozePractice() {
  const { userId, currentListId, lists, hubAvailable } = useApp()
  const { addXP } = useXP()
  const { targetLocale, nativeName } = useLearningLocales()
  const [phase, setPhase] = useState<Phase>('start')
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [words, setWords] = useState<Map<number, Word>>(new Map())
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [isFuzzy, setIsFuzzy] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [stats, setStats] = useState({ correct: 0, wrong: 0, streak: 0, bestStreak: 0 })
  const [existingCount, setExistingCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef<number | null>(null)

  // Determine target language RTL from current list
  const currentList = lists.find(l => l.id === currentListId)
  const targetLangRtl = currentList ? isRTL(currentList.language_to) : false

  // Check for existing sentences on mount
  useEffect(() => {
    getClozeSet(userId, 1).then(s => setExistingCount(s.length)).catch(() => {})
  }, [userId])

  const loadExisting = useCallback(async () => {
    try {
      const set = await getClozeSet(userId, 20)
      if (set.length === 0) {
        toast.error('No sentences found. Generate some first!')
        return
      }
      // Fetch word details for each sentence
      const allWords = await getWords(userId, { limit: 500 })
      const wordMap = new Map<number, Word>()
      for (const w of allWords) wordMap.set(w.id, w)
      setWords(wordMap)
      setSentences(set)
      setIndex(0)
      setInput('')
      setChecked(false)
      setIsCorrect(false)
      setIsFuzzy(false)
      setShowHint(false)
      setStats({ correct: 0, wrong: 0, streak: 0, bestStreak: 0 })
      const { session_id } = await startSession(userId, 'cloze', currentListId ?? undefined)
      sessionRef.current = session_id
      setPhase('practice')
    } catch {
      toast.error('Failed to load sentences')
    }
  }, [userId, currentListId])

  const handleGenerate = useCallback(async () => {
    setPhase('generating')
    try {
      // Get due/weak words to generate sentences for
      let targetWords: Word[]
      try {
        targetWords = await getDueWords(userId, 10)
      } catch {
        targetWords = []
      }
      // Fallback to all words if no due words
      if (targetWords.length === 0) {
        targetWords = await getWords(userId, { list_id: currentListId ?? undefined, limit: 10 })
      }
      if (targetWords.length === 0) {
        toast.error('No words in your vocabulary yet. Upload some first!')
        setPhase('start')
        return
      }

      const wordIds = targetWords.map(w => w.id)
      toast('Generating sentences with AI...', { icon: '🤖' })
      const generated = await generateSentences(userId, wordIds, 2, targetLocale, nativeName)

      if (generated.length === 0) {
        toast.error('Failed to generate sentences. Is the AI backend running?')
        setPhase('start')
        return
      }

      toast.success(`Generated ${generated.length} sentences!`)
      setExistingCount(prev => prev + generated.length)

      // Build word map
      const wordMap = new Map<number, Word>()
      for (const w of targetWords) wordMap.set(w.id, w)
      setWords(wordMap)

      // Shuffle and use
      const shuffled = [...generated].sort(() => Math.random() - 0.5)
      setSentences(shuffled)
      setIndex(0)
      setInput('')
      setChecked(false)
      setIsCorrect(false)
      setIsFuzzy(false)
      setShowHint(false)
      setStats({ correct: 0, wrong: 0, streak: 0, bestStreak: 0 })
      const { session_id } = await startSession(userId, 'cloze', currentListId ?? undefined)
      sessionRef.current = session_id
      setPhase('practice')
    } catch {
      toast.error('Generation failed. Check that the Creative Hub is running.')
      setPhase('start')
    }
  }, [userId, currentListId])

  const currentSentence = sentences[index] ?? null
  const currentWord = currentSentence ? words.get(currentSentence.word_id) : null

  /** Build the sentence display with the cloze word blanked out. */
  function buildClozeDisplay(sentence: string, clozeWord: string): { before: string; after: string; blankLen: number } | null {
    const lower = sentence.toLowerCase()
    const idx = lower.indexOf(clozeWord.toLowerCase())
    if (idx >= 0) {
      return {
        before: sentence.slice(0, idx),
        after: sentence.slice(idx + clozeWord.length),
        blankLen: clozeWord.length,
      }
    }
    return null
  }

  const cloze = currentSentence ? buildClozeDisplay(currentSentence.sentence, currentSentence.cloze_word) : null

  const handleCheck = useCallback(() => {
    if (!currentSentence || checked) return
    const trimmed = input.trim()
    if (!trimmed) return

    const answer = currentSentence.cloze_word
    const exact = normalizeForComparison(trimmed) === normalizeForComparison(answer)
    const fuzzy = !exact && fuzzyMatch(trimmed, answer)
    const correct = exact || fuzzy

    setChecked(true)
    setIsCorrect(correct)
    setIsFuzzy(fuzzy)
    setStats(s => {
      const newStreak = correct ? s.streak + 1 : 0
      return {
        correct: s.correct + (correct ? 1 : 0),
        wrong: s.wrong + (correct ? 0 : 1),
        streak: newStreak,
        bestStreak: Math.max(s.bestStreak, newStreak),
      }
    })

    // Submit FSRS review
    submitReview({
      word_id: currentSentence.word_id,
      quality: correct ? 4 : 1,
      user_id: userId,
    }).catch(() => {})
  }, [currentSentence, input, checked, userId])

  const handleNext = useCallback(() => {
    if (index + 1 >= sentences.length) {
      setPhase('finished')
      addXP(15, 'game_round')
      if (sessionRef.current) {
        endSession(sessionRef.current, {
          words_reviewed: sentences.length,
          correct: stats.correct + (isCorrect ? 0 : 0), // stats already updated
          wrong: stats.wrong,
        }).catch(() => {})
      }
      return
    }
    setIndex(i => i + 1)
    setInput('')
    setChecked(false)
    setIsCorrect(false)
    setIsFuzzy(false)
    setShowHint(false)
  }, [index, sentences.length, stats, isCorrect])

  useEffect(() => {
    if (phase === 'practice' && !checked && inputRef.current) {
      inputRef.current.focus()
    }
  }, [index, checked, phase])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!checked) handleCheck()
      else handleNext()
    }
  }

  // --- START SCREEN ---
  if (phase === 'start') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Sentence Cloze
        </h1>
        <p className="text-sm max-w-md text-center" style={{ color: 'var(--color-text-muted)' }}>
          Practice vocabulary in context. AI generates sentences with your words, then you fill in the blanks.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {!hubAvailable && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs"
              style={{
                background: 'var(--color-accent-light)',
                border: '1px solid var(--color-accent-dark)',
                color: 'var(--color-accent-dark)',
              }}
            >
              <span>&#9889;</span>
              <span>Backend offline. Generation requires the Creative Hub.</span>
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={!hubAvailable}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-primary-main)' }}
          >
            Generate New Sentences
          </button>
          {existingCount > 0 && (
            <button
              onClick={loadExisting}
              className="px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              Practice Existing ({existingCount} sentences)
            </button>
          )}
        </div>
      </div>
    )
  }

  // --- GENERATING ---
  if (phase === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div
          className="w-10 h-10 border-3 rounded-full animate-spin"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary-main)' }}
        />
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Generating sentences with AI...
        </span>
      </div>
    )
  }

  // --- FINISHED ---
  if (phase === 'finished') {
    const total = stats.correct + stats.wrong
    const pct = total > 0 ? Math.round((stats.correct / total) * 100) : 0

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 gap-6"
      >
        <h2 className="text-3xl font-bold" style={{ color: 'var(--color-primary-main)' }}>
          Session Complete
        </h2>

        <div
          className="rounded-2xl px-10 py-8 flex flex-col items-center gap-4"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          <div className="grid grid-cols-4 gap-6 text-center">
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
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                {stats.bestStreak}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Best Streak</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setPhase('start')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            Back
          </button>
          <button
            onClick={loadExisting}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ background: 'var(--color-primary-main)' }}
          >
            Play Again
          </button>
        </div>
      </motion.div>
    )
  }

  // --- PRACTICE ---
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Sentence Cloze
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: 'var(--color-correct)' }}>
            {stats.correct} correct
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/</span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-incorrect)' }}>
            {stats.wrong} wrong
          </span>
          {stats.streak > 1 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
            >
              {stats.streak} streak
            </span>
          )}
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: 'var(--color-primary-faded)',
              color: 'var(--color-primary-main)',
            }}
          >
            {index + 1} / {sentences.length}
          </span>
        </div>
      </div>

      {/* Question card */}
      {currentSentence && (
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl px-8 py-10 flex flex-col items-center gap-6"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            {/* Word info hint */}
            {currentWord && (
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                Word: <strong style={{ color: 'var(--color-accent-dark, var(--color-accent))' }} dir={targetLangRtl ? 'rtl' : undefined}>
                  {currentWord.lemma}
                </strong>
                {' '}&rarr;{' '}
                <span>{currentWord.translation}</span>
                {currentWord.part_of_speech && (
                  <span className="ml-2">({currentWord.part_of_speech})</span>
                )}
              </span>
            )}

            {/* Sentence with blank */}
            <p
              className="text-xl font-semibold text-center leading-relaxed max-w-lg"
              style={{ color: 'var(--color-text-primary)' }}
              dir={targetLangRtl ? 'rtl' : undefined}
            >
              {cloze ? (
                <>
                  {cloze.before}
                  <span
                    className="inline-block mx-1 border-b-2 min-w-[80px] text-center"
                    style={{
                      borderColor: checked
                        ? isCorrect
                          ? 'var(--color-correct)'
                          : 'var(--color-incorrect)'
                        : 'var(--color-primary-main)',
                    }}
                  >
                    {checked && (
                      <span
                        className="font-bold"
                        style={{
                          color: isCorrect ? 'var(--color-correct)' : 'var(--color-incorrect)',
                        }}
                      >
                        {isCorrect ? (isFuzzy ? currentSentence.cloze_word : input.trim()) : currentSentence.cloze_word}
                      </span>
                    )}
                    {!checked && (
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {'_'.repeat(Math.min(currentSentence.cloze_word.length, 12))}
                      </span>
                    )}
                  </span>
                  {cloze.after}
                </>
              ) : (
                // Fallback: just show the sentence with a generic blank prompt
                <span>{currentSentence.sentence}</span>
              )}
            </p>

            {/* Translation hint (togglable) */}
            {currentSentence.translation && (
              <div className="flex flex-col items-center gap-1">
                {showHint ? (
                  <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                    {currentSentence.translation}
                  </p>
                ) : (
                  <button
                    onClick={() => setShowHint(true)}
                    className="text-xs cursor-pointer underline"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Show translation hint
                  </button>
                )}
              </div>
            )}

            {/* Input */}
            {!checked && (
              <div className="flex flex-col items-center gap-2 w-full max-w-sm">
                <div className="flex items-center gap-3 w-full">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type the missing word..."
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: 'var(--color-surface-alt, var(--color-surface))',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    dir={targetLangRtl ? 'rtl' : undefined}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    onClick={handleCheck}
                    disabled={!input.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--color-primary-main)' }}
                  >
                    Check
                  </button>
                </div>
                <ToggleableKeyboard
                  locale={targetLocale}
                  onChar={char => { setInput(prev => prev + char); inputRef.current?.focus() }}
                  onBackspace={() => { setInput(prev => prev.slice(0, -1)); inputRef.current?.focus() }}
                  onSpace={() => { setInput(prev => prev + ' '); inputRef.current?.focus() }}
                />
              </div>
            )}

            {/* Feedback */}
            {checked && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M4 10l4 4 8-8" stroke="var(--color-correct)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-correct)' }}>
                        {isFuzzy ? (
                          <>Almost! The exact form is <strong>{currentSentence.cloze_word}</strong></>
                        ) : (
                          'Correct!'
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="var(--color-incorrect)" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-incorrect)' }}>
                        Wrong — the answer was <strong>{currentSentence.cloze_word}</strong>
                      </span>
                    </>
                  )}
                </div>

                {/* Full sentence and word details */}
                <div
                  className="w-full max-w-md rounded-xl px-5 py-4 text-sm space-y-2"
                  style={{
                    background: 'var(--color-primary-pale, var(--color-primary-faded))',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <p className="font-medium" dir={targetLangRtl ? 'rtl' : undefined}>
                    {currentSentence.sentence}
                  </p>
                  {currentSentence.translation && (
                    <p className="italic" style={{ color: 'var(--color-text-muted)' }}>
                      {currentSentence.translation}
                    </p>
                  )}
                  {currentWord && (
                    <p style={{ color: 'var(--color-text-muted)' }}>
                      {currentWord.lemma} = {currentWord.translation}
                      {currentWord.part_of_speech && ` (${currentWord.part_of_speech})`}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                  style={{ background: 'var(--color-primary-main)' }}
                >
                  {index + 1 >= sentences.length ? 'Finish' : 'Next'}
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
