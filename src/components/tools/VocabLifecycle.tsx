import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/context/AppContext'
import { getWords, getDueWords, submitReview, startSession, endSession } from '@/services/vocabApi'
import { getLocalWords } from '@/lib/localStore'
import { fuzzyMatch } from '@/lib/textNormalize'
import { isRTL } from '@/lib/csvParser'
import { useXP } from '@/hooks/useXP'
import { useLearningLocales } from '@/hooks/useLearningLocales'
import type { Word } from '@/types/word'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stage = 'setup' | 'intro' | 'recognition' | 'production' | 'mastery' | 'results'
type WordSource = 'due' | 'newest' | 'custom'
type MasteryFormat = 'mc-forward' | 'mc-reverse' | 'type-word' | 'type-translation'

interface WordResult {
  word: Word
  introSeen: boolean
  recognitionCorrect: boolean
  productionCorrect: boolean
  masteryCorrect: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function speak(text: string, lang?: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  if (lang) u.lang = lang
  u.rate = 0.85
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

function pickDistractors(pool: Word[], exclude: Word, count: number, field: 'lemma' | 'translation'): string[] {
  const others = pool.filter(w => w.id !== exclude.id && w[field] !== exclude[field])
  return shuffle(others).slice(0, count).map(w => w[field])
}

const STAGE_ORDER: Stage[] = ['intro', 'recognition', 'production', 'mastery']
const STAGE_LABELS: Record<string, string> = {
  intro: 'Introduction',
  recognition: 'Recognition',
  production: 'Production',
  mastery: 'Mastery Test',
}

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25 },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VocabLifecycle() {
  const { userId, currentListId, activeStudyWords, hubAvailable } = useApp()
  const { addXP } = useXP()
  const { targetLocale } = useLearningLocales()

  // Setup state
  const [wordCount, setWordCount] = useState(10)
  const [wordSource, setWordSource] = useState<WordSource>('due')
  const [customInput, setCustomInput] = useState('')

  // Core state
  const [stage, setStage] = useState<Stage>('setup')
  const [words, setWords] = useState<Word[]>([])
  const [allPool, setAllPool] = useState<Word[]>([]) // larger pool for distractors
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<Map<number, WordResult>>(new Map())
  const [stageScore, setStageScore] = useState({ correct: 0, total: 0 })
  const [showStageSummary, setShowStageSummary] = useState(false)

  // Recognition state
  const [mcOptions, setMcOptions] = useState<string[]>([])
  const [mcSelected, setMcSelected] = useState<number | null>(null)
  const [mcCorrectIdx, setMcCorrectIdx] = useState(0)

  // Production state
  const [typingInput, setTypingInput] = useState('')
  const [typingChecked, setTypingChecked] = useState(false)
  const [typingCorrect, setTypingCorrect] = useState(false)

  // Mastery state
  const [masteryFormat, setMasteryFormat] = useState<MasteryFormat>('mc-forward')
  const [masteryOrder, setMasteryOrder] = useState<number[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef<number | null>(null)

  const currentWord = useMemo(() => {
    if (stage === 'mastery' && masteryOrder.length > 0) {
      return words[masteryOrder[currentIndex]] ?? null
    }
    return words[currentIndex] ?? null
  }, [words, currentIndex, stage, masteryOrder])

  const rtl = useMemo(() => isRTL(targetLocale), [targetLocale])
  const totalStageWords = stage === 'mastery' ? masteryOrder.length : words.length

  // ---------------------------------------------------------------------------
  // Setup: Load words
  // ---------------------------------------------------------------------------

  const loadWords = useCallback(async () => {
    let fetched: Word[] = []
    let pool: Word[] = []

    try {
      if (activeStudyWords && activeStudyWords.length > 0) {
        fetched = activeStudyWords.slice(0, wordCount)
        pool = activeStudyWords
      } else if (wordSource === 'custom') {
        // Parse custom input: "word = translation" per line
        const lines = customInput.split('\n').filter(l => l.includes('='))
        fetched = lines.slice(0, wordCount).map((line, i) => {
          const [lemma, translation] = line.split('=').map(s => s.trim())
          return {
            id: -(i + 1),
            user_id: userId,
            list_id: null,
            lemma: lemma || '',
            translation: translation || '',
            language_from: targetLocale,
            language_to: 'en',
            part_of_speech: null,
            gender: null,
            pronunciation: null,
            example_sentence: null,
            example_translation: null,
            tags: [],
            cefr_level: null,
            exposure_count: 0,
            last_seen: null,
            ease_factor: 2.5,
            interval_days: 0,
            next_review: null,
            stability: 0,
            difficulty: 0,
            reps: 0,
            created_at: new Date().toISOString(),
          } as Word
        })
        pool = fetched
      } else if (!hubAvailable) {
        const local = getLocalWords()
        if (wordSource === 'due') {
          const now = new Date().toISOString()
          const due = local.filter(w => !w.next_review || w.next_review <= now)
          fetched = shuffle(due).slice(0, wordCount)
        } else {
          fetched = [...local].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, wordCount)
        }
        pool = local
      } else {
        if (wordSource === 'due') {
          fetched = await getDueWords(userId, wordCount)
        } else {
          fetched = await getWords(userId, { list_id: currentListId ?? undefined, limit: wordCount })
          // Sort newest first
          fetched = [...fetched].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, wordCount)
        }
        // Get larger pool for distractors
        try {
          pool = await getWords(userId, { limit: 200 })
        } catch {
          pool = fetched
        }
      }
    } catch {
      // Fallback to local
      const local = getLocalWords()
      fetched = shuffle(local).slice(0, wordCount)
      pool = local
    }

    if (fetched.length === 0) return false

    // Ensure pool has enough for distractors
    if (pool.length < 4) pool = fetched

    setWords(fetched)
    setAllPool(pool)

    // Initialize results
    const r = new Map<number, WordResult>()
    fetched.forEach(w => {
      r.set(w.id, {
        word: w,
        introSeen: false,
        recognitionCorrect: false,
        productionCorrect: false,
        masteryCorrect: false,
      })
    })
    setResults(r)
    return true
  }, [wordCount, wordSource, customInput, userId, currentListId, activeStudyWords, hubAvailable, targetLocale])

  // ---------------------------------------------------------------------------
  // Stage transitions
  // ---------------------------------------------------------------------------

  const beginSession = useCallback(async () => {
    const ok = await loadWords()
    if (!ok) return
    // Start session for tracking
    if (hubAvailable) {
      try {
        const { session_id } = await startSession(userId, 'vocab-lifecycle', currentListId ?? undefined)
        sessionRef.current = session_id
      } catch { /* offline fallback */ }
    }
    setCurrentIndex(0)
    setStageScore({ correct: 0, total: 0 })
    setShowStageSummary(false)
    setStage('intro')
  }, [loadWords, hubAvailable, userId, currentListId])

  const advanceStage = useCallback(() => {
    const idx = STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number])
    if (idx < STAGE_ORDER.length - 1) {
      const next = STAGE_ORDER[idx + 1]
      setCurrentIndex(0)
      setStageScore({ correct: 0, total: 0 })
      setShowStageSummary(false)
      setTypingInput('')
      setTypingChecked(false)
      setMcSelected(null)

      if (next === 'mastery') {
        // Randomize order and assign formats
        setMasteryOrder(shuffle(words.map((_, i) => i)))
      }

      setStage(next)
    } else {
      finishSession()
    }
  }, [stage, words])

  const repeatStage = useCallback(() => {
    setCurrentIndex(0)
    setStageScore({ correct: 0, total: 0 })
    setShowStageSummary(false)
    setTypingInput('')
    setTypingChecked(false)
    setMcSelected(null)
  }, [])

  const finishSession = useCallback(async () => {
    // Submit reviews for mastered words
    const mastered: Word[] = []
    results.forEach(r => {
      if (r.recognitionCorrect && r.productionCorrect && r.masteryCorrect) {
        mastered.push(r.word)
      }
    })

    // Award XP
    if (mastered.length > 0) {
      addXP(mastered.length * 2, 'quick_practice')
    }

    // Submit reviews to backend
    if (hubAvailable) {
      for (const w of Array.from(results.values())) {
        const quality = (w.recognitionCorrect && w.productionCorrect && w.masteryCorrect) ? 5 : w.recognitionCorrect ? 3 : 1
        try {
          await submitReview({ word_id: w.word.id, quality, user_id: userId })
        } catch { /* ignore */ }
      }
      if (sessionRef.current) {
        try {
          const correct = Array.from(results.values()).filter(r => r.recognitionCorrect && r.productionCorrect && r.masteryCorrect).length
          await endSession(sessionRef.current, { words_reviewed: words.length, correct, wrong: words.length - correct })
        } catch { /* ignore */ }
      }
    }

    // Update local words exposure
    try {
      const raw = localStorage.getItem('lingua-local-words')
      if (raw) {
        const local = JSON.parse(raw) as Array<Record<string, unknown>>
        const now = new Date().toISOString()
        for (const lw of local) {
          const r = results.get(lw.id as number)
          if (r) {
            lw.exposure_count = ((lw.exposure_count as number) || 0) + 1
            lw.last_seen = now
            if (r.recognitionCorrect && r.productionCorrect && r.masteryCorrect) {
              lw.reps = ((lw.reps as number) || 0) + 1
              lw.interval_days = Math.max(1, ((lw.interval_days as number) || 0) * 2)
              const nextDate = new Date()
              nextDate.setDate(nextDate.getDate() + (lw.interval_days as number))
              lw.next_review = nextDate.toISOString()
            }
          }
        }
        localStorage.setItem('lingua-local-words', JSON.stringify(local))
      }
    } catch { /* ignore */ }

    setStage('results')
  }, [results, words, hubAvailable, userId, addXP])

  // ---------------------------------------------------------------------------
  // Stage: Recognition — build MC options
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (stage !== 'recognition' || !currentWord) return
    const correct = currentWord.translation
    const distractors = pickDistractors(allPool, currentWord, 3, 'translation')
    // Ensure we have enough options
    while (distractors.length < 3) distractors.push(`option ${distractors.length + 1}`)
    const opts = shuffle([correct, ...distractors])
    setMcOptions(opts)
    setMcCorrectIdx(opts.indexOf(correct))
    setMcSelected(null)
  }, [stage, currentIndex, currentWord, allPool])

  // ---------------------------------------------------------------------------
  // Stage: Mastery — pick random format per word
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (stage !== 'mastery' || !currentWord) return
    const formats: MasteryFormat[] = ['mc-forward', 'mc-reverse', 'type-word', 'type-translation']
    const fmt = formats[Math.floor(Math.random() * formats.length)]
    setMasteryFormat(fmt)
    setMcSelected(null)
    setTypingInput('')
    setTypingChecked(false)

    if (fmt === 'mc-forward') {
      const correct = currentWord.translation
      const distractors = pickDistractors(allPool, currentWord, 3, 'translation')
      while (distractors.length < 3) distractors.push(`option ${distractors.length + 1}`)
      const opts = shuffle([correct, ...distractors])
      setMcOptions(opts)
      setMcCorrectIdx(opts.indexOf(correct))
    } else if (fmt === 'mc-reverse') {
      const correct = currentWord.lemma
      const distractors = pickDistractors(allPool, currentWord, 3, 'lemma')
      while (distractors.length < 3) distractors.push(`option ${distractors.length + 1}`)
      const opts = shuffle([correct, ...distractors])
      setMcOptions(opts)
      setMcCorrectIdx(opts.indexOf(correct))
    }
  }, [stage, currentIndex, currentWord, allPool, masteryOrder])

  // Focus input when needed
  useEffect(() => {
    if (stage === 'production' || ((stage === 'mastery') && (masteryFormat === 'type-word' || masteryFormat === 'type-translation'))) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [stage, currentIndex, masteryFormat])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleIntroNext = useCallback(() => {
    if (!currentWord) return
    setResults(prev => {
      const next = new Map(prev)
      const r = next.get(currentWord.id)
      if (r) next.set(currentWord.id, { ...r, introSeen: true })
      return next
    })
    if (currentIndex < words.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      setShowStageSummary(true)
    }
  }, [currentWord, currentIndex, words.length])

  const handleMcSelect = useCallback((idx: number) => {
    if (mcSelected !== null) return // already answered
    setMcSelected(idx)
    const correct = idx === mcCorrectIdx
    if (stage === 'recognition' && currentWord) {
      setResults(prev => {
        const next = new Map(prev)
        const r = next.get(currentWord.id)
        if (r) next.set(currentWord.id, { ...r, recognitionCorrect: correct })
        return next
      })
    } else if (stage === 'mastery' && currentWord) {
      setResults(prev => {
        const next = new Map(prev)
        const r = next.get(currentWord.id)
        if (r) next.set(currentWord.id, { ...r, masteryCorrect: correct })
        return next
      })
    }
    setStageScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }))
  }, [mcSelected, mcCorrectIdx, stage, currentWord])

  const handleTypingSubmit = useCallback(() => {
    if (typingChecked || !currentWord) return
    const expected = stage === 'production'
      ? currentWord.lemma
      : masteryFormat === 'type-word'
        ? currentWord.lemma
        : currentWord.translation

    const correct = fuzzyMatch(typingInput, expected, targetLocale)
    setTypingChecked(true)
    setTypingCorrect(correct)

    if (stage === 'production') {
      setResults(prev => {
        const next = new Map(prev)
        const r = next.get(currentWord.id)
        if (r) next.set(currentWord.id, { ...r, productionCorrect: correct })
        return next
      })
    } else if (stage === 'mastery') {
      setResults(prev => {
        const next = new Map(prev)
        const r = next.get(currentWord.id)
        if (r) next.set(currentWord.id, { ...r, masteryCorrect: correct })
        return next
      })
    }
    setStageScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }))
  }, [typingChecked, typingInput, currentWord, stage, masteryFormat, targetLocale])

  const handleAdvance = useCallback(() => {
    setMcSelected(null)
    setTypingInput('')
    setTypingChecked(false)
    setTypingCorrect(false)

    if (currentIndex < totalStageWords - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      setShowStageSummary(true)
    }
  }, [currentIndex, totalStageWords])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (stage === 'intro') {
        handleIntroNext()
      } else if (stage === 'production' || ((stage === 'mastery') && (masteryFormat === 'type-word' || masteryFormat === 'type-translation'))) {
        if (!typingChecked) handleTypingSubmit()
        else handleAdvance()
      } else if ((stage === 'recognition' || stage === 'mastery') && mcSelected !== null) {
        handleAdvance()
      }
    } else if (e.key === ' ' && stage === 'intro') {
      e.preventDefault()
      handleIntroNext()
    }
  }, [stage, typingChecked, mcSelected, masteryFormat, handleIntroNext, handleTypingSubmit, handleAdvance])

  // Keyboard number shortcuts for MC
  useEffect(() => {
    if (stage !== 'recognition' && !(stage === 'mastery' && (masteryFormat === 'mc-forward' || masteryFormat === 'mc-reverse'))) return
    if (mcSelected !== null) return
    const handler = (e: KeyboardEvent) => {
      const n = parseInt(e.key)
      if (n >= 1 && n <= 4 && mcOptions.length >= n) {
        handleMcSelect(n - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [stage, masteryFormat, mcSelected, mcOptions, handleMcSelect])

  const practiceWeakWords = useCallback(() => {
    const weak = Array.from(results.values()).filter(r => !(r.recognitionCorrect && r.productionCorrect && r.masteryCorrect))
    if (weak.length === 0) return
    setWords(weak.map(r => r.word))
    setAllPool(prev => prev) // keep same pool
    const r = new Map<number, WordResult>()
    weak.forEach(w => {
      r.set(w.word.id, {
        word: w.word,
        introSeen: false,
        recognitionCorrect: false,
        productionCorrect: false,
        masteryCorrect: false,
      })
    })
    setResults(r)
    setCurrentIndex(0)
    setStageScore({ correct: 0, total: 0 })
    setShowStageSummary(false)
    setStage('intro')
  }, [results])

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const stageIndex = STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number])
  const masteredCount = useMemo(() => {
    return Array.from(results.values()).filter(r => r.recognitionCorrect && r.productionCorrect && r.masteryCorrect).length
  }, [results])

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderProgressBar = () => (
    <div className="mb-6">
      {/* Stage pills */}
      <div className="flex items-center gap-1 mb-3">
        {STAGE_ORDER.map((s, i) => {
          const active = s === stage
          const done = stageIndex > i
          return (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div
                className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
                  done ? 'bg-[var(--color-correct)]' :
                  active ? 'bg-[var(--color-primary-main)]' :
                  'bg-[var(--color-border)]'
                }`}
              />
              {i < STAGE_ORDER.length - 1 && <div className="w-1" />}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] font-medium">
        {STAGE_ORDER.map((s, i) => (
          <span key={s} className={stageIndex === i ? 'text-[var(--color-primary-main)] font-semibold' : ''}>
            {STAGE_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  )

  const renderWordProgress = () => (
    <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-4">
      <span>Word {currentIndex + 1} of {totalStageWords}</span>
      {(stage === 'recognition' || stage === 'production' || stage === 'mastery') && (
        <span>{stageScore.correct}/{stageScore.total} correct</span>
      )}
    </div>
  )

  // ---------------------------------------------------------------------------
  // RENDER: Setup
  // ---------------------------------------------------------------------------

  if (stage === 'setup') {
    return (
      <div className="max-w-lg mx-auto" onKeyDown={handleKeyDown}>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Vocab Lifecycle</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Take new words from first encounter to mastery through 4 stages of learning.
        </p>

        {/* Word count */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide">
            How many words?
          </label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map(n => (
              <button
                key={n}
                onClick={() => setWordCount(n)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border transition-all ${
                  wordCount === n
                    ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Word source */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide">
            Word source
          </label>
          <div className="flex flex-col gap-2">
            {([
              ['due', 'My due words', 'Words that need review'],
              ['newest', 'My newest words', 'Most recently added'],
              ['custom', 'Custom', 'Type your own word-translation pairs'],
            ] as const).map(([key, label, desc]) => (
              <button
                key={key}
                onClick={() => setWordSource(key)}
                className={`text-left px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                  wordSource === key
                    ? 'bg-[var(--color-primary-pale)] border-[var(--color-primary-main)]'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                }`}
              >
                <div className="text-sm font-medium text-[var(--color-text-primary)]">{label}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom input */}
        <AnimatePresence>
          {wordSource === 'custom' && (
            <motion.div {...fade} className="mb-5">
              <textarea
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder={"hola = hello\ngracias = thank you\ncasa = house"}
                rows={6}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-primary-main)]"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">One pair per line: word = translation</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={beginSession}
          disabled={wordSource === 'custom' && !customInput.includes('=')}
          className="w-full py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Begin
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Stage Summary (between stages)
  // ---------------------------------------------------------------------------

  if (showStageSummary && stage !== 'results') {
    const pct = stageScore.total > 0 ? Math.round((stageScore.correct / stageScore.total) * 100) : 100
    const needsRepeat = (stage === 'recognition' && pct < 70) || (stage === 'production' && pct < 60)
    const isIntro = stage === 'intro'

    return (
      <div className="max-w-lg mx-auto">
        {renderProgressBar()}
        <motion.div {...fade} className="text-center py-8">
          <div className="text-4xl mb-3">{isIntro ? '\u{1F4D6}' : pct >= 80 ? '\u{1F389}' : pct >= 60 ? '\u{1F44D}' : '\u{1F4AA}'}</div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
            {isIntro ? 'Introduction Complete' : `${STAGE_LABELS[stage]} Complete`}
          </h3>
          {!isIntro && (
            <p className="text-2xl font-bold mb-1" style={{ color: pct >= 70 ? 'var(--color-correct)' : 'var(--color-incorrect)' }}>
              {pct}%
            </p>
          )}
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            {isIntro
              ? `You've seen all ${words.length} words. Time to test your recognition.`
              : `${stageScore.correct} of ${stageScore.total} correct`
            }
          </p>

          {needsRepeat ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={repeatStage}
                className="w-full py-3 rounded-lg bg-[var(--color-accent)] text-white font-semibold text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
              >
                Repeat {STAGE_LABELS[stage]}
              </button>
              <button
                onClick={advanceStage}
                className="w-full py-2.5 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-secondary)] font-medium text-sm cursor-pointer border border-[var(--color-border)] hover:border-[var(--color-primary-light)] transition-colors"
              >
                Continue anyway
              </button>
            </div>
          ) : (
            <button
              onClick={stage === 'mastery' ? finishSession : advanceStage}
              className="w-full py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
            >
              {stage === 'mastery' ? 'See Results' : `Continue to ${STAGE_LABELS[STAGE_ORDER[stageIndex + 1]]}`}
            </button>
          )}
        </motion.div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Introduction
  // ---------------------------------------------------------------------------

  if (stage === 'intro' && currentWord) {
    return (
      <div className="max-w-lg mx-auto" onKeyDown={handleKeyDown} tabIndex={0}>
        {renderProgressBar()}
        {renderWordProgress()}
        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} {...fade}>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center">
              <div
                className="text-3xl font-bold text-[var(--color-text-primary)] mb-3"
                dir={rtl ? 'rtl' : undefined}
              >
                {currentWord.lemma}
              </div>
              <div className="text-lg text-[var(--color-text-secondary)] mb-2">
                {currentWord.translation}
              </div>
              {currentWord.pronunciation && (
                <div className="text-sm text-[var(--color-text-muted)] mb-2 italic">
                  {currentWord.pronunciation}
                </div>
              )}
              {currentWord.part_of_speech && (
                <span className="inline-block px-2 py-0.5 rounded text-xs bg-[var(--color-primary-pale)] text-[var(--color-primary-main)] font-medium mb-3">
                  {currentWord.part_of_speech}
                </span>
              )}
              {currentWord.example_sentence && (
                <div
                  className="text-sm text-[var(--color-text-muted)] mt-3 pt-3 border-t border-[var(--color-border)]"
                  dir={rtl ? 'rtl' : undefined}
                >
                  {currentWord.example_sentence}
                </div>
              )}

              <button
                onClick={() => speak(currentWord.lemma, targetLocale)}
                className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] cursor-pointer hover:border-[var(--color-primary-light)] transition-colors"
              >
                Listen
              </button>
            </div>

            <button
              onClick={handleIntroNext}
              className="w-full mt-4 py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
            >
              {currentIndex < words.length - 1 ? 'Next' : 'Ready to practice'}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Recognition (Multiple Choice)
  // ---------------------------------------------------------------------------

  if (stage === 'recognition' && currentWord) {
    const answered = mcSelected !== null
    return (
      <div className="max-w-lg mx-auto" onKeyDown={handleKeyDown} tabIndex={0}>
        {renderProgressBar()}
        {renderWordProgress()}
        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} {...fade}>
            <div className="text-center mb-6">
              <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">What does this mean?</p>
              <div
                className="text-2xl font-bold text-[var(--color-text-primary)]"
                dir={rtl ? 'rtl' : undefined}
              >
                {currentWord.lemma}
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              {mcOptions.map((opt, i) => {
                const isCorrect = i === mcCorrectIdx
                const isSelected = i === mcSelected
                let bg = 'bg-[var(--color-surface)]'
                let border = 'border-[var(--color-border)]'
                let text = 'text-[var(--color-text-primary)]'

                if (answered) {
                  if (isCorrect) {
                    bg = 'bg-[var(--color-correct-bg)]'
                    border = 'border-[var(--color-correct)]'
                    text = 'text-[var(--color-correct)]'
                  } else if (isSelected && !isCorrect) {
                    bg = 'bg-[var(--color-incorrect-bg)]'
                    border = 'border-[var(--color-incorrect)]'
                    text = 'text-[var(--color-incorrect)]'
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleMcSelect(i)}
                    disabled={answered}
                    className={`w-full text-left px-4 py-3 rounded-lg border cursor-pointer transition-all ${bg} ${border} ${text} font-medium text-sm disabled:cursor-default hover:border-[var(--color-primary-light)]`}
                    style={answered && isSelected && !isCorrect ? { animation: 'shake 0.4s ease-in-out' } : undefined}
                  >
                    <span className="text-[var(--color-text-muted)] mr-2 text-xs">{i + 1}</span>
                    {opt}
                  </button>
                )
              })}
            </div>

            {answered && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={handleAdvance}
                className="w-full py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
              >
                {currentIndex < words.length - 1 ? 'Next' : 'Continue'}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
          }
        `}</style>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Production (Type it)
  // ---------------------------------------------------------------------------

  if (stage === 'production' && currentWord) {
    return (
      <div className="max-w-lg mx-auto" onKeyDown={handleKeyDown} tabIndex={0}>
        {renderProgressBar()}
        {renderWordProgress()}
        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} {...fade}>
            <div className="text-center mb-6">
              <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Type the word for</p>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {currentWord.translation}
              </div>
            </div>

            {rtl && !typingChecked && (
              <p className="text-xs text-[var(--color-accent)] mb-2 text-center">
                Switch to {targetLocale.toUpperCase()} keyboard
              </p>
            )}

            <div className="relative mb-4">
              <input
                ref={inputRef}
                type="text"
                value={typingInput}
                onChange={e => setTypingInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    if (!typingChecked) handleTypingSubmit()
                    else handleAdvance()
                  }
                }}
                disabled={typingChecked}
                dir={rtl ? 'rtl' : undefined}
                placeholder="Type your answer..."
                className={`w-full px-4 py-3 rounded-lg border text-base text-center font-medium focus:outline-none transition-colors ${
                  typingChecked
                    ? typingCorrect
                      ? 'border-[var(--color-correct)] bg-[var(--color-correct-bg)] text-[var(--color-correct)]'
                      : 'border-[var(--color-incorrect)] bg-[var(--color-incorrect-bg)] text-[var(--color-incorrect)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]'
                } placeholder:text-[var(--color-text-muted)]`}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>

            {typingChecked && !typingCorrect && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-4">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Correct answer:</p>
                <p className="text-lg font-bold text-[var(--color-correct)]" dir={rtl ? 'rtl' : undefined}>
                  {currentWord.lemma}
                </p>
              </motion.div>
            )}

            {!typingChecked ? (
              <button
                onClick={handleTypingSubmit}
                disabled={!typingInput.trim()}
                className="w-full py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                Check
              </button>
            ) : (
              <button
                onClick={handleAdvance}
                className="w-full py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
              >
                {currentIndex < words.length - 1 ? 'Next' : 'Continue'}
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Mastery Test (Mixed)
  // ---------------------------------------------------------------------------

  if (stage === 'mastery' && currentWord) {
    const isMC = masteryFormat === 'mc-forward' || masteryFormat === 'mc-reverse'
    const isTypeWord = masteryFormat === 'type-word'
    const prompt = masteryFormat === 'mc-forward' ? currentWord.lemma
      : masteryFormat === 'mc-reverse' ? currentWord.translation
      : isTypeWord ? currentWord.translation
      : currentWord.lemma
    const promptLabel = masteryFormat === 'mc-forward' ? 'What does this mean?'
      : masteryFormat === 'mc-reverse' ? 'Which word means...'
      : isTypeWord ? 'Type the word for'
      : 'Type the translation for'
    const promptDir = (masteryFormat === 'mc-forward' || masteryFormat === 'type-translation') && rtl ? 'rtl' : undefined

    return (
      <div className="max-w-lg mx-auto" onKeyDown={handleKeyDown} tabIndex={0}>
        {renderProgressBar()}
        {renderWordProgress()}
        <AnimatePresence mode="wait">
          <motion.div key={`${currentIndex}-${masteryFormat}`} {...fade}>
            <div className="text-center mb-6">
              <p className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">{promptLabel}</p>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]" dir={promptDir}>
                {prompt}
              </div>
            </div>

            {isMC ? (
              <>
                <div className="flex flex-col gap-2 mb-4">
                  {mcOptions.map((opt, i) => {
                    const answered = mcSelected !== null
                    const isCorrect = i === mcCorrectIdx
                    const isSelected = i === mcSelected
                    let bg = 'bg-[var(--color-surface)]'
                    let border = 'border-[var(--color-border)]'
                    let text = 'text-[var(--color-text-primary)]'

                    if (answered) {
                      if (isCorrect) {
                        bg = 'bg-[var(--color-correct-bg)]'
                        border = 'border-[var(--color-correct)]'
                        text = 'text-[var(--color-correct)]'
                      } else if (isSelected && !isCorrect) {
                        bg = 'bg-[var(--color-incorrect-bg)]'
                        border = 'border-[var(--color-incorrect)]'
                        text = 'text-[var(--color-incorrect)]'
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleMcSelect(i)}
                        disabled={answered}
                        dir={masteryFormat === 'mc-reverse' && rtl ? 'rtl' : undefined}
                        className={`w-full text-left px-4 py-3 rounded-lg border cursor-pointer transition-all ${bg} ${border} ${text} font-medium text-sm disabled:cursor-default hover:border-[var(--color-primary-light)]`}
                        style={answered && isSelected && !isCorrect ? { animation: 'shake 0.4s ease-in-out' } : undefined}
                      >
                        <span className="text-[var(--color-text-muted)] mr-2 text-xs">{i + 1}</span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
                {mcSelected !== null && (
                  <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={handleAdvance}
                    className="w-full py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
                  >
                    {currentIndex < totalStageWords - 1 ? 'Next' : 'See Results'}
                  </motion.button>
                )}
              </>
            ) : (
              <>
                {rtl && isTypeWord && !typingChecked && (
                  <p className="text-xs text-[var(--color-accent)] mb-2 text-center">
                    Switch to {targetLocale.toUpperCase()} keyboard
                  </p>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={typingInput}
                  onChange={e => setTypingInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      if (!typingChecked) handleTypingSubmit()
                      else handleAdvance()
                    }
                  }}
                  disabled={typingChecked}
                  dir={isTypeWord && rtl ? 'rtl' : undefined}
                  placeholder="Type your answer..."
                  className={`w-full px-4 py-3 rounded-lg border text-base text-center font-medium mb-4 focus:outline-none transition-colors ${
                    typingChecked
                      ? typingCorrect
                        ? 'border-[var(--color-correct)] bg-[var(--color-correct-bg)] text-[var(--color-correct)]'
                        : 'border-[var(--color-incorrect)] bg-[var(--color-incorrect-bg)] text-[var(--color-incorrect)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]'
                  } placeholder:text-[var(--color-text-muted)]`}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {typingChecked && !typingCorrect && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-4">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">Correct answer:</p>
                    <p className="text-lg font-bold text-[var(--color-correct)]" dir={isTypeWord && rtl ? 'rtl' : undefined}>
                      {isTypeWord ? currentWord.lemma : currentWord.translation}
                    </p>
                  </motion.div>
                )}
                {!typingChecked ? (
                  <button
                    onClick={handleTypingSubmit}
                    disabled={!typingInput.trim()}
                    className="w-full py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    Check
                  </button>
                ) : (
                  <button
                    onClick={handleAdvance}
                    className="w-full py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
                  >
                    {currentIndex < totalStageWords - 1 ? 'Next' : 'See Results'}
                  </button>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
          }
        `}</style>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Results
  // ---------------------------------------------------------------------------

  if (stage === 'results') {
    const total = words.length
    const pct = total > 0 ? Math.round((masteredCount / total) * 100) : 0
    const weakWords = Array.from(results.values()).filter(r => !(r.recognitionCorrect && r.productionCorrect && r.masteryCorrect))

    return (
      <div className="max-w-lg mx-auto">
        <motion.div {...fade}>
          <div className="text-center py-6">
            <div className="text-5xl mb-3">{pct >= 80 ? '\u{1F31F}' : pct >= 50 ? '\u{1F44F}' : '\u{1F4AA}'}</div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Session Complete</h2>
            <p className="text-3xl font-bold mb-1" style={{ color: pct >= 70 ? 'var(--color-correct)' : 'var(--color-accent)' }}>
              {pct}% Mastered
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {masteredCount} of {total} words fully mastered
            </p>
            {masteredCount > 0 && (
              <p className="text-xs text-[var(--color-accent)] font-semibold mt-1">
                +{masteredCount * 2} XP earned
              </p>
            )}
          </div>

          {/* Per-word breakdown */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Word Breakdown</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {Array.from(results.values()).map(r => {
                const mastered = r.recognitionCorrect && r.productionCorrect && r.masteryCorrect
                return (
                  <div key={r.word.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base">{mastered ? '\u2713' : '\u2717'}</span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-[var(--color-text-primary)] block truncate" dir={rtl ? 'rtl' : undefined}>
                          {r.word.lemma}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] block truncate">
                          {r.word.translation}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <span className={`w-2 h-2 rounded-full ${r.recognitionCorrect ? 'bg-[var(--color-correct)]' : 'bg-[var(--color-incorrect)]'}`} title="Recognition" />
                      <span className={`w-2 h-2 rounded-full ${r.productionCorrect ? 'bg-[var(--color-correct)]' : 'bg-[var(--color-incorrect)]'}`} title="Production" />
                      <span className={`w-2 h-2 rounded-full ${r.masteryCorrect ? 'bg-[var(--color-correct)]' : 'bg-[var(--color-incorrect)]'}`} title="Mastery" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {weakWords.length > 0 && (
              <button
                onClick={practiceWeakWords}
                className="w-full py-3 rounded-lg bg-[var(--color-accent)] text-white font-semibold text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
              >
                Practice {weakWords.length} weak word{weakWords.length > 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={() => {
                setStage('setup')
                setWords([])
                setResults(new Map())
                setCurrentIndex(0)
                setShowStageSummary(false)
                setStageScore({ correct: 0, total: 0 })
              }}
              className="w-full py-3 rounded-lg bg-[var(--color-primary-main)] text-white font-semibold text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
            >
              New Set
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // Fallback (shouldn't reach)
  return null
}

export default VocabLifecycle
