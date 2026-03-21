import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { FlashcardCard } from './FlashcardCard'
import * as api from '@/services/vocabApi'
import { useXP } from '@/hooks/useXP'
import { fuzzyMatch } from '@/lib/textNormalize'
import { isRTL } from '@/lib/csvParser'
import { getLocalWords } from '@/lib/localStore'
import type { Word } from '@/types/word'

type FlashcardMode = 'recognition' | 'production'
type StudyStyle = 'classic' | 'typing' | 'pronunciation'
type SessionPhase = 'loading' | 'reviewing' | 'summary' | 'empty'

interface SessionStats {
  reviewed: number
  correct: number
  wrong: number
  startTime: number
}

const RATING_BUTTONS = [
  { label: 'Didn\'t know', subtitle: 'See again soon', quality: 1, key: '1', color: 'var(--color-incorrect)', bg: '#FEE2E2' },
  { label: 'Almost', subtitle: 'Review tomorrow', quality: 3, key: '2', color: 'var(--color-accent-dark)', bg: 'var(--color-accent-light)' },
  { label: 'Got it', subtitle: 'Review in a few days', quality: 4, key: '3', color: 'var(--color-correct)', bg: '#D1FAE5' },
  { label: 'Too easy', subtitle: 'Review later', quality: 5, key: '4', color: 'var(--color-primary-main)', bg: 'var(--color-primary-faded)' },
] as const

const LANG_BCP47: Record<string, string> = {
  ar: 'ar-SA', de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR',
  it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', nl: 'nl-NL', pt: 'pt-BR',
  ru: 'ru-RU', tr: 'tr-TR', zh: 'zh-CN',
}

function speakWord(text: string, lang: string) {
  if (!window.speechSynthesis) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = LANG_BCP47[lang] ?? lang
  u.rate = 0.85
  speechSynthesis.speak(u)
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function FlashcardDeck() {
  const { userId, currentListId, lists, hubAvailable, activeStudyWords, activeStudyVersion } = useApp()
  const { addXP } = useXP()

  const [phase, setPhase] = useState<SessionPhase>('loading')
  const [words, setWords] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [stats, setStats] = useState<SessionStats>({ reviewed: 0, correct: 0, wrong: 0, startTime: Date.now() })
  const [elapsed, setElapsed] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<FlashcardMode>('recognition')
  const [studyStyle, setStudyStyle] = useState<StudyStyle>('classic')
  const [cramMode, setCramMode] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)
  const [allFetchedWords, setAllFetchedWords] = useState<Word[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [practiceMode, setPracticeMode] = useState(false)

  // Typing mode state
  const [typingInput, setTypingInput] = useState('')
  const [typingChecked, setTypingChecked] = useState(false)
  const [typingCorrect, setTypingCorrect] = useState<boolean | null>(null)
  const typingInputRef = useRef<HTMLInputElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pronunciation mode state
  const [pronPlayed, setPronPlayed] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Collect unique tags from fetched words
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const w of allFetchedWords) {
      for (const t of w.tags) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
  }, [allFetchedWords])

  // Check if current list has a deadline
  const currentList = lists.find(l => l.id === currentListId)
  const deadline = currentList?.deadline ?? null
  const daysLeft = deadline ? (() => {
    const target = new Date(deadline)
    const now = new Date()
    target.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  })() : null

  // Fetch due words and start session
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        let fetchedWords: Word[]
        if (activeStudyWords && activeStudyWords.length > 0) {
          fetchedWords = activeStudyWords.slice(0, 40)
        } else if (!hubAvailable) {
          // Offline: use locally stored words from starter pack
          fetchedWords = shuffle(getLocalWords()).slice(0, 20)
        } else if (practiceMode && currentListId) {
          // Practice mode: load random words from the word bank
          fetchedWords = await api.getWords(userId, { list_id: currentListId, limit: 20 })
          if (fetchedWords.length === 0) {
            fetchedWords = await api.getWords(userId, { limit: 20 })
          }
          fetchedWords = shuffle(fetchedWords)
        } else if (practiceMode) {
          fetchedWords = await api.getWords(userId, { limit: 20 })
          fetchedWords = shuffle(fetchedWords)
        } else if (cramMode && currentListId) {
          fetchedWords = await api.getCramWords(userId, currentListId)
        } else {
          fetchedWords = await api.getDueWords(userId, 20)
        }
        if (cancelled) return

        setAllFetchedWords(fetchedWords)

        // Apply tag filter if active
        const filtered = activeTag
          ? fetchedWords.filter(w => w.tags.includes(activeTag))
          : fetchedWords

        if (filtered.length === 0) {
          setPhase('empty')
          return
        }

        // Start a session (skip if offline — no backend to track it)
        let sid: number | null = null
        if (hubAvailable) {
          const { session_id } = await api.startSession(userId, 'flashcards', currentListId ?? undefined)
          sid = session_id
        }
        if (cancelled) return

        setWords(filtered)
        setSessionId(sid)
        setStats({ reviewed: 0, correct: 0, wrong: 0, startTime: Date.now() })
        setCurrentIndex(0)
        setFlipped(false)
        setTypingInput('')
        setTypingChecked(false)
        setTypingCorrect(null)
        setPronPlayed(false)
        setPhase('reviewing')
      } catch {
        if (!cancelled) {
          if (!hubAvailable) {
            // Silently go to empty state
          } else {
            toast.error('Failed to load flashcards')
          }
          setPhase('empty')
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [userId, currentListId, cramMode, sessionKey, activeTag, hubAvailable, activeStudyWords, activeStudyVersion, practiceMode])

  // Session timer
  useEffect(() => {
    if (phase === 'reviewing') {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - stats.startTime)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, stats.startTime])

  // Focus typing input when card changes
  useEffect(() => {
    if (studyStyle === 'typing' && !typingChecked && typingInputRef.current) {
      typingInputRef.current.focus()
    }
  }, [currentIndex, typingChecked, studyStyle])

  // Cleanup typing auto-advance timer
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    }
  }, [])

  const handleFlip = useCallback(() => {
    if (phase === 'reviewing' && studyStyle === 'classic') setFlipped(f => !f)
  }, [phase, studyStyle])

  const handleRate = useCallback(async (quality: number) => {
    if (isSubmitting || phase !== 'reviewing') return
    const word = words[currentIndex]
    if (!word) return

    setIsSubmitting(true)
    const isCorrect = quality >= 3

    if (hubAvailable) {
      try {
        await api.submitReview({ word_id: word.id, quality, user_id: userId })
      } catch {
        // non-critical in offline-capable mode
      }
    }

    addXP(1, 'flashcard_review')

    const newStats = {
      ...stats,
      reviewed: stats.reviewed + 1,
      correct: stats.correct + (isCorrect ? 1 : 0),
      wrong: stats.wrong + (isCorrect ? 0 : 1),
    }
    setStats(newStats)

    const nextIndex = currentIndex + 1
    if (nextIndex >= words.length) {
      if (timerRef.current) clearInterval(timerRef.current)
      setElapsed(Date.now() - stats.startTime)

      if (sessionId !== null) {
        try {
          await api.endSession(sessionId, {
            words_reviewed: newStats.reviewed,
            correct: newStats.correct,
            wrong: newStats.wrong,
          })
        } catch {
          // non-critical
        }
      }
      setPhase('summary')
    } else {
      setCurrentIndex(nextIndex)
      setFlipped(false)
      setTypingInput('')
      setTypingChecked(false)
      setTypingCorrect(null)
      setPronPlayed(false)
    }

    setIsSubmitting(false)
  }, [isSubmitting, phase, words, currentIndex, userId, stats, sessionId])

  // --- Typing mode handlers ---
  const handleTypingCheck = useCallback(() => {
    if (typingChecked || !typingInput.trim()) return
    const word = words[currentIndex]
    if (!word) return

    const expected = mode === 'production' ? word.lemma : word.translation
    const isCorrect = fuzzyMatch(typingInput.trim(), expected)
    setTypingChecked(true)
    setTypingCorrect(isCorrect)

    // Auto-rate: correct = 4 (Got it), wrong = 1 (Didn't know)
    const quality = isCorrect ? 4 : 1
    // Auto-advance after 1.5s
    typingTimerRef.current = setTimeout(() => {
      handleRate(quality)
    }, 1500)
  }, [typingInput, typingChecked, words, currentIndex, mode, handleRate])

  const handleTypingKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTypingCheck()
    }
  }, [handleTypingCheck])

  // --- Pronunciation mode handlers ---
  const handlePronListen = useCallback(() => {
    const word = words[currentIndex]
    if (!word) return
    speakWord(word.lemma, word.language_from)
    setPronPlayed(true)
  }, [words, currentIndex])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (phase !== 'reviewing') return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (studyStyle === 'classic') {
        if (e.code === 'Space') {
          e.preventDefault()
          handleFlip()
          return
        }

        if (flipped) {
          const btn = RATING_BUTTONS.find(b => b.key === e.key)
          if (btn) {
            e.preventDefault()
            handleRate(btn.quality)
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, flipped, handleFlip, handleRate, studyStyle])

  const handleEnrich = useCallback(async (wordId: number) => {
    try {
      await api.enrichWords([wordId])
      const updated = await api.getWord(wordId)
      setWords(prev => prev.map(w => w.id === wordId ? updated : w))
      toast.success('Word enriched!')
    } catch {
      toast.error('Enrichment failed')
    }
  }, [])

  // --- Loading ---
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div
          className="w-8 h-8 rounded-full border-3 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary-main)', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Loading flashcards...
        </p>
      </div>
    )
  }

  // --- Empty ---
  if (phase === 'empty') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        {!hubAvailable ? (
          <>
            <div className="text-5xl opacity-40">&#128218;</div>
            <h2
              className="text-xl font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              No words yet
            </h2>
            <p className="text-sm text-center max-w-sm" style={{ color: 'var(--color-text-muted)' }}>
              Add some vocabulary first! Go to the Word Bank or upload a word list to start practicing with flashcards.
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl">🎉</div>
            <h2
              className="text-xl font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              All caught up!
            </h2>
            <p className="text-sm text-center max-w-sm" style={{ color: 'var(--color-text-muted)' }}>
              No words are due for review right now. Great job staying on top of your studies!
            </p>
            <button
              onClick={() => {
                setPracticeMode(true)
                setPhase('loading')
                setSessionKey(k => k + 1)
              }}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
              style={{
                background: 'var(--color-primary-faded)',
                color: 'var(--color-primary-main)',
                border: '1px solid var(--color-primary-main)',
              }}
            >
              Practice anyway
            </button>
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
              Load random words from your vocabulary bank for extra practice.
            </p>
          </>
        )}
      </div>
    )
  }

  // --- Summary ---
  if (phase === 'summary') {
    const accuracy = stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0
    return (
      <div className="flex flex-col items-center py-16 gap-6">
        <div className="text-5xl">
          {accuracy >= 80 ? '🏆' : accuracy >= 50 ? '👍' : '💪'}
        </div>
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Session Complete
        </h2>

        <div
          className="rounded-xl p-6 w-full max-w-sm flex flex-col gap-3"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <SummaryRow label="Cards reviewed" value={String(stats.reviewed)} />
          <SummaryRow label="Correct" value={String(stats.correct)} color="var(--color-correct)" />
          <SummaryRow label="Wrong" value={String(stats.wrong)} color="var(--color-incorrect)" />
          <SummaryRow label="Accuracy" value={`${accuracy}%`} />
          <SummaryRow label="Time" value={formatElapsed(elapsed)} />
        </div>

        <button
          className="mt-4 px-6 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer"
          style={{ background: 'var(--color-primary-main)' }}
          onClick={() => {
            setPhase('loading')
            setPracticeMode(false)
            setSessionKey(k => k + 1)
          }}
        >
          Start New Session
        </button>
      </div>
    )
  }

  // --- Reviewing ---
  const currentWord = words[currentIndex]
  const progress = ((currentIndex) / words.length) * 100

  return (
    <div className="flex flex-col gap-6">
      {/* Cram mode banner */}
      {deadline && currentListId && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-2.5 text-sm"
          style={{
            background: daysLeft !== null && daysLeft < 0 ? '#FEE2E2' : 'var(--color-accent-light)',
            border: `1px solid ${daysLeft !== null && daysLeft < 0 ? '#ef4444' : 'var(--color-accent-dark)'}`,
            color: daysLeft !== null && daysLeft < 0 ? '#ef4444' : 'var(--color-accent-dark)',
          }}
        >
          <span className="font-medium">
            {daysLeft !== null && daysLeft < 0
              ? `Exam was ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`
              : daysLeft === 0
                ? 'Exam is today!'
                : `Exam in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — Cram Mode available`
            }
          </span>
          <button
            onClick={() => setCramMode(c => !c)}
            className="px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors"
            style={{
              background: cramMode ? 'var(--color-primary-main)' : 'transparent',
              color: cramMode ? '#fff' : 'var(--color-accent-dark)',
              border: cramMode ? 'none' : '1px solid var(--color-accent-dark)',
            }}
          >
            {cramMode ? 'Cram ON' : 'Enable Cram'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1
          className="text-lg font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Flashcards{cramMode ? ' — Cram Mode' : practiceMode ? ' — Practice' : ''}
        </h1>
        <div className="flex items-center gap-4">
          {/* Mode toggle (recognition/production) */}
          <div
            className="flex rounded-full p-0.5 text-xs font-medium"
            style={{ background: 'var(--color-gray-100)', border: '1px solid var(--color-border)' }}
          >
            {(['recognition', 'production'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-2.5 py-1 rounded-full capitalize cursor-pointer border-none transition-all"
                style={{
                  background: mode === m ? 'var(--color-primary-main)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--color-text-muted)',
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {formatElapsed(elapsed)}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {currentIndex + 1} / {words.length}
          </span>
        </div>
      </div>

      {/* Study style tabs */}
      <div
        className="flex rounded-xl p-1 text-xs font-medium self-start"
        style={{ background: 'var(--color-gray-100)', border: '1px solid var(--color-border)' }}
      >
        {([
          { key: 'classic' as const, label: 'Classic', icon: '🃏' },
          { key: 'typing' as const, label: 'Typing', icon: '⌨️' },
          { key: 'pronunciation' as const, label: 'Pronunciation', icon: '🔊' },
        ]).map(s => (
          <button
            key={s.key}
            onClick={() => {
              setStudyStyle(s.key)
              setFlipped(false)
              setTypingInput('')
              setTypingChecked(false)
              setTypingCorrect(null)
              setPronPlayed(false)
            }}
            className="px-3 py-1.5 rounded-lg cursor-pointer border-none transition-all flex items-center gap-1.5"
            style={{
              background: studyStyle === s.key ? 'var(--color-primary-main)' : 'transparent',
              color: studyStyle === s.key ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Tag filter chips */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Filter:</span>
          <button
            onClick={() => { setActiveTag(null); setSessionKey(k => k + 1) }}
            className="px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border-none transition-colors"
            style={{
              background: activeTag === null ? 'var(--color-primary-main)' : 'var(--color-primary-faded)',
              color: activeTag === null ? '#fff' : 'var(--color-primary-main)',
            }}
          >
            All
          </button>
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => { setActiveTag(tag === activeTag ? null : tag); setSessionKey(k => k + 1) }}
              className="px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border-none transition-colors"
              style={{
                background: activeTag === tag ? 'var(--color-primary-main)' : 'var(--color-primary-faded)',
                color: activeTag === tag ? '#fff' : 'var(--color-primary-main)',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-gray-200)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--color-primary-main)' }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Score pills */}
      <div className="flex items-center gap-3 justify-center">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#D1FAE5', color: 'var(--color-correct)' }}>
          {stats.correct} correct
        </span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#FEE2E2', color: 'var(--color-incorrect)' }}>
          {stats.wrong} wrong
        </span>
      </div>

      {/* ======== Classic Mode ======== */}
      {studyStyle === 'classic' && (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="max-w-lg mx-auto w-full"
            >
              <FlashcardCard
                word={currentWord}
                flipped={flipped}
                onFlip={handleFlip}
                reversed={mode === 'production'}
                onEnrich={handleEnrich}
              />
            </motion.div>
          </AnimatePresence>

          {/* Rating buttons */}
          <AnimatePresence>
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center gap-3 mt-2"
              >
                {RATING_BUTTONS.map(btn => (
                  <button
                    key={btn.quality}
                    disabled={isSubmitting}
                    onClick={() => handleRate(btn.quality)}
                    className="flex flex-col items-center gap-1 px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    style={{ background: btn.bg, color: btn.color, border: 'none' }}
                  >
                    <span>{btn.label}</span>
                    <span className="text-[10px] font-normal opacity-70">{btn.subtitle}</span>
                    <kbd
                      className="text-[10px] font-mono opacity-50 px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,0,0,0.06)' }}
                    >
                      {btn.key}
                    </kbd>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {!flipped && (
            <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Press <kbd className="font-mono px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-gray-100)', border: '1px solid var(--color-border)' }}>Space</kbd> to flip
            </p>
          )}
        </>
      )}

      {/* ======== Typing Mode ======== */}
      {studyStyle === 'typing' && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentWord.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="max-w-lg mx-auto w-full"
          >
            <div
              className="rounded-2xl px-8 py-10 flex flex-col items-center gap-6 min-h-[320px]"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              }}
            >
              {/* Show the "front" word */}
              <span
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-primary-main)' }}
              >
                {mode === 'production' ? currentWord.language_to : currentWord.language_from}
              </span>
              <h2
                className="text-4xl font-bold text-center leading-tight"
                style={{ color: 'var(--color-text-primary)' }}
                dir={isRTL(mode === 'production' ? currentWord.language_to : currentWord.language_from) ? 'rtl' : undefined}
              >
                {mode === 'production' ? currentWord.translation : currentWord.lemma}
              </h2>

              {!typingChecked && currentWord.pronunciation && mode !== 'production' && (
                <span className="text-base italic" style={{ color: 'var(--color-text-muted)' }}>
                  {currentWord.pronunciation}
                </span>
              )}

              {/* Audio button */}
              {mode !== 'production' && (
                <button
                  onClick={() => speakWord(currentWord.lemma, currentWord.language_from)}
                  className="p-2 rounded-full border-none cursor-pointer transition-colors"
                  style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
                  aria-label="Listen"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
              )}

              <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                Type the {mode === 'production' ? 'target word' : 'translation'}:
              </div>

              {/* Input */}
              <div className="flex items-center gap-3 w-full max-w-sm">
                <input
                  ref={typingInputRef}
                  type="text"
                  value={typingInput}
                  onChange={e => setTypingInput(e.target.value)}
                  onKeyDown={handleTypingKeyDown}
                  disabled={typingChecked}
                  placeholder={mode === 'production' ? 'Type the word...' : 'Type the translation...'}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none disabled:opacity-60"
                  style={{
                    background: typingChecked
                      ? typingCorrect ? '#D1FAE5' : '#FEE2E2'
                      : 'var(--color-surface-alt)',
                    border: `2px solid ${typingChecked
                      ? typingCorrect ? 'var(--color-correct)' : 'var(--color-incorrect)'
                      : 'var(--color-border)'}`,
                    color: 'var(--color-text-primary)',
                  }}
                  dir={isRTL(mode === 'production' ? currentWord.language_from : currentWord.language_to) ? 'rtl' : undefined}
                  autoComplete="off"
                  spellCheck={false}
                />
                {!typingChecked && (
                  <button
                    onClick={handleTypingCheck}
                    disabled={!typingInput.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--color-primary-main)' }}
                  >
                    Check
                  </button>
                )}
              </div>

              {/* Feedback */}
              {typingChecked && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-2"
                >
                  {typingCorrect ? (
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-correct)' }}>
                      Correct!
                    </span>
                  ) : (
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-incorrect)' }}>
                      Wrong — answer: <strong>{mode === 'production' ? currentWord.lemma : currentWord.translation}</strong>
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Advancing...
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ======== Pronunciation Mode ======== */}
      {studyStyle === 'pronunciation' && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentWord.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="max-w-lg mx-auto w-full"
          >
            <div
              className="rounded-2xl px-8 py-10 flex flex-col items-center gap-6 min-h-[320px]"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              }}
            >
              {/* Language label */}
              <span
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-primary-main)' }}
              >
                {currentWord.language_from}
              </span>

              {/* Word */}
              <h2
                className="text-4xl font-bold text-center leading-tight"
                style={{ color: 'var(--color-text-primary)' }}
                dir={isRTL(currentWord.language_from) ? 'rtl' : undefined}
              >
                {currentWord.lemma}
              </h2>

              {currentWord.pronunciation && (
                <span className="text-base italic" style={{ color: 'var(--color-text-muted)' }}>
                  {currentWord.pronunciation}
                </span>
              )}

              {/* Translation */}
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {currentWord.translation}
              </span>

              {/* Listen button */}
              <button
                onClick={handlePronListen}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-transform hover:scale-105 active:scale-95"
                style={{
                  background: pronPlayed ? 'var(--color-primary-faded)' : 'var(--color-primary-main)',
                  color: pronPlayed ? 'var(--color-primary-main)' : '#fff',
                  border: pronPlayed ? '1px solid var(--color-primary-main)' : 'none',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                {pronPlayed ? 'Listen again' : 'Listen'}
              </button>

              {/* Try to say it prompt */}
              {pronPlayed && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                    Try saying it yourself, then rate how it went:
                  </p>

                  {/* Self-rating buttons */}
                  <div className="flex items-center gap-3">
                    {RATING_BUTTONS.map(btn => (
                      <button
                        key={btn.quality}
                        disabled={isSubmitting}
                        onClick={() => handleRate(btn.quality)}
                        className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                        style={{ background: btn.bg, color: btn.color, border: 'none' }}
                      >
                        <span>{btn.label}</span>
                        <span className="text-[10px] font-normal opacity-70">{btn.subtitle}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {!pronPlayed && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Click Listen to hear the pronunciation
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: color ?? 'var(--color-text-primary)' }}>{value}</span>
    </div>
  )
}
