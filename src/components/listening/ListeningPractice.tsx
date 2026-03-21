import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import { isRTL } from '@/lib/csvParser'
import { normalizeForComparison } from '@/lib/textNormalize'
import type { Word } from '@/types/word'
import type { VocabList } from '@/types/word'

// ── BCP-47 language tag map ──

const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
  pt: 'pt-BR', nl: 'nl-NL', ru: 'ru-RU', ar: 'ar-SA', ja: 'ja-JP',
  ko: 'ko-KR', zh: 'zh-CN', tr: 'tr-TR',
}

// ── Types ──

type Mode = 'word' | 'translation' | 'dictation'
type DictationSpeed = 'slow' | 'normal' | 'fast'
type Phase = 'setup' | 'exercise' | 'results'
type TtsEngine = 'hub' | 'browser' | 'none'

interface ExerciseWord {
  word: Word
  userAnswer: string
  correct: boolean | null
  /** For dictation mode: per-word scoring */
  wordScores?: { word: string; correct: boolean }[]
}

/** Score a dictation answer word-by-word against the expected sentence */
function scoreDictation(userAnswer: string, expected: string): { wordScores: { word: string; correct: boolean }[]; accuracy: number } {
  const expectedWords = expected.trim().split(/\s+/)
  const userWords = userAnswer.trim().split(/\s+/)
  const wordScores = expectedWords.map((ew, i) => {
    const uw = userWords[i] ?? ''
    return {
      word: ew,
      correct: normalizeForComparison(uw) === normalizeForComparison(ew),
    }
  })
  const correctCount = wordScores.filter(w => w.correct).length
  return { wordScores, accuracy: expectedWords.length > 0 ? correctCount / expectedWords.length : 0 }
}

function speakWithBrowserAtRate(text: string, lang: string, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('SpeechSynthesis not supported'))
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = LANG_TO_BCP47[lang] ?? lang
    utterance.rate = rate
    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(e)
    speechSynthesis.speak(utterance)
  })
}

// ── Helpers ──

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function pollJobUntilDone(jobId: number, maxAttempts = 30): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const job = await api.getJobStatus(jobId)
    if (job.status === 'completed') return api.getJobOutputUrl(jobId)
    if (job.status === 'failed' || job.status === 'error') return null
    await new Promise(r => setTimeout(r, 2000))
  }
  return null
}

/** Speak without rate control (kept for fallback) */
export function speakWithBrowser(text: string, lang: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('SpeechSynthesis not supported'))
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = LANG_TO_BCP47[lang] ?? lang
    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(e)
    speechSynthesis.speak(utterance)
  })
}

// ── Component ──

export function ListeningPractice() {
  const { userId, lists, hubAvailable } = useApp()

  // Setup state
  const [phase, setPhase] = useState<Phase>('setup')
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('word')
  const [wordCount, setWordCount] = useState(10)
  const [dictationSpeed, setDictationSpeed] = useState<DictationSpeed>('normal')

  // Exercise state
  const [exerciseWords, setExerciseWords] = useState<ExerciseWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>('none')
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // What text to speak and what the correct answer is
  const getExerciseData = useCallback((ew: ExerciseWord) => {
    if (mode === 'dictation') {
      // Dictation mode: speak the example sentence, user types the full sentence
      const sentence = ew.word.example_sentence || ew.word.lemma
      return {
        speakText: sentence,
        speakLang: ew.word.language_from,
        correctAnswer: sentence,
        answerLang: ew.word.language_from,
        hintLabel: 'Translation',
        hintText: ew.word.example_translation || ew.word.translation,
      }
    } else if (mode === 'word') {
      // Speak the lemma (in language_from), user types the lemma
      return {
        speakText: ew.word.lemma,
        speakLang: ew.word.language_from,
        correctAnswer: ew.word.lemma,
        answerLang: ew.word.language_from,
        hintLabel: 'Translation',
        hintText: ew.word.translation,
      }
    } else {
      // Speak the translation (in language_to), user types the target word (lemma)
      return {
        speakText: ew.word.translation,
        speakLang: ew.word.language_to,
        correctAnswer: ew.word.lemma,
        answerLang: ew.word.language_from,
        hintLabel: 'You heard',
        hintText: ew.word.translation,
      }
    }
  }, [mode])

  // ── TTS playback ──

  const speedRateMap: Record<DictationSpeed, number> = { slow: 0.6, normal: 1.0, fast: 1.4 }

  const playAudio = useCallback(async (text: string, lang: string) => {
    if (speaking) return
    setSpeaking(true)

    const rate = mode === 'dictation' ? speedRateMap[dictationSpeed] : 1.0

    // Try Hub TTS first (non-dictation or normal speed)
    if (hubAvailable && rate === 1.0) {
      try {
        const { job_id } = await api.generateSpeech(text)
        const url = await pollJobUntilDone(job_id)
        if (url) {
          setTtsEngine('hub')
          const audio = new Audio(url)
          audioRef.current = audio
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve()
            audio.onerror = () => reject(new Error('Audio playback failed'))
            audio.play().catch(reject)
          })
          setSpeaking(false)
          return
        }
      } catch {
        // Fall through to browser TTS
      }
    }

    // Fallback to browser SpeechSynthesis (supports rate control)
    try {
      setTtsEngine('browser')
      await speakWithBrowserAtRate(text, lang, rate)
    } catch {
      setTtsEngine('none')
      toast.error('No TTS available')
    }
    setSpeaking(false)
  }, [speaking, hubAvailable, mode, dictationSpeed])

  // ── Start exercise ──

  const startExercise = useCallback(async () => {
    if (!selectedListId) {
      toast.error('Select a vocabulary list')
      return
    }
    setLoading(true)
    try {
      const words = await api.getWords(userId, { list_id: selectedListId })
      if (words.length === 0) {
        toast.error('This list has no words')
        setLoading(false)
        return
      }
      const selected = shuffle(words).slice(0, wordCount)
      const items: ExerciseWord[] = selected.map(w => ({
        word: w,
        userAnswer: '',
        correct: null,
      }))
      setExerciseWords(items)
      setCurrentIndex(0)
      setUserInput('')
      setChecked(false)
      setPhase('exercise')

      const { session_id } = await api.startSession(userId, 'listening', selectedListId)
      setSessionId(session_id)
    } catch {
      toast.error('Failed to load words')
    } finally {
      setLoading(false)
    }
  }, [selectedListId, userId, wordCount])

  // Auto-focus input when moving to next word
  useEffect(() => {
    if (phase === 'exercise' && !checked) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [phase, currentIndex, checked])

  // ── Check answer ──

  const checkAnswer = useCallback(() => {
    if (!exerciseWords[currentIndex]) return
    const data = getExerciseData(exerciseWords[currentIndex])

    let isCorrect: boolean
    let wordScores: { word: string; correct: boolean }[] | undefined

    if (mode === 'dictation') {
      const result = scoreDictation(userInput, data.correctAnswer)
      wordScores = result.wordScores
      isCorrect = result.accuracy >= 0.7 // 70% word accuracy = pass
    } else {
      isCorrect = normalizeForComparison(userInput) === normalizeForComparison(data.correctAnswer)
    }

    setExerciseWords(prev => {
      const updated = [...prev]
      updated[currentIndex] = {
        ...updated[currentIndex],
        userAnswer: userInput.trim(),
        correct: isCorrect,
        wordScores,
      }
      return updated
    })
    setChecked(true)

    // Submit SM-2 review
    api.submitReview({
      word_id: exerciseWords[currentIndex].word.id,
      quality: isCorrect ? 4 : 1,
      user_id: userId,
    }).catch(() => {})
  }, [currentIndex, exerciseWords, getExerciseData, userInput, userId, mode])

  // ── Next word / finish ──

  const nextWord = useCallback(() => {
    if (currentIndex + 1 >= exerciseWords.length) {
      // Finish
      const correct = exerciseWords.filter(w => w.correct === true).length
      const wrong = exerciseWords.filter(w => w.correct === false).length
      if (sessionId) {
        api.endSession(sessionId, {
          words_reviewed: exerciseWords.length,
          correct,
          wrong,
        }).catch(() => {})
      }
      setPhase('results')
    } else {
      setCurrentIndex(i => i + 1)
      setUserInput('')
      setChecked(false)
    }
  }, [currentIndex, exerciseWords, sessionId])

  // ── Handle Enter key ──

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (checked) {
        nextWord()
      } else if (userInput.trim()) {
        checkAnswer()
      }
    }
  }, [checked, checkAnswer, nextWord, userInput])

  // ── No lists ──

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="text-lg font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          No vocabulary lists
        </span>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Upload vocabulary first to use listening practice.
        </span>
      </div>
    )
  }

  // ── SETUP PHASE ──

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Listening Practice
        </h1>

        {!hubAvailable && (
          <div
            className="rounded-lg px-4 py-3 text-xs"
            style={{
              background: 'var(--color-accent-faded)',
              border: '1px solid var(--color-accent-light)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <strong>Offline Mode:</strong> Audio will use your browser's built-in speech synthesis.
            Vocabulary lists must be loaded from the backend to start a session.
          </div>
        )}

        <div
          className="rounded-2xl px-8 py-8 flex flex-col gap-6 max-w-lg"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          {/* List selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Vocabulary List
            </label>
            <select
              value={selectedListId ?? ''}
              onChange={e => setSelectedListId(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">Select a list...</option>
              {lists.map((l: VocabList) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.word_count} words) — {l.language_from} → {l.language_to}
                </option>
              ))}
            </select>
          </div>

          {/* Mode selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Mode
            </label>
            <div className="flex gap-2">
              {(['word', 'translation', 'dictation'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  style={{
                    background: mode === m ? 'var(--color-primary-main)' : 'var(--color-surface-alt)',
                    color: mode === m ? 'white' : 'var(--color-text-secondary)',
                    border: `1px solid ${mode === m ? 'var(--color-primary-main)' : 'var(--color-border)'}`,
                  }}
                >
                  {m === 'word' ? 'Word' : m === 'translation' ? 'Translation' : 'Sentence'}
                </button>
              ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {mode === 'word'
                ? 'Hear a word spoken aloud, type what you hear.'
                : mode === 'translation'
                  ? 'Hear the translation, type the target language word.'
                  : 'Hear a full sentence, type the entire sentence. Scored word-by-word.'}
            </span>
          </div>

          {/* Dictation speed (only in dictation mode) */}
          {mode === 'dictation' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Speed
              </label>
              <div className="flex gap-2">
                {(['slow', 'normal', 'fast'] as DictationSpeed[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setDictationSpeed(s)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors capitalize"
                    style={{
                      background: dictationSpeed === s ? 'var(--color-primary-main)' : 'var(--color-surface-alt)',
                      color: dictationSpeed === s ? 'white' : 'var(--color-text-secondary)',
                      border: `1px solid ${dictationSpeed === s ? 'var(--color-primary-main)' : 'var(--color-border)'}`,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Word count */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Number of Words
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map(n => (
                <button
                  key={n}
                  onClick={() => setWordCount(n)}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  style={{
                    background: wordCount === n ? 'var(--color-primary-main)' : 'var(--color-surface-alt)',
                    color: wordCount === n ? 'white' : 'var(--color-text-secondary)',
                    border: `1px solid ${wordCount === n ? 'var(--color-primary-main)' : 'var(--color-border)'}`,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={startExercise}
            disabled={!selectedListId || loading}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-primary-main)' }}
          >
            {loading ? 'Loading...' : 'Start'}
          </button>
        </div>
      </div>
    )
  }

  // ── EXERCISE PHASE ──

  if (phase === 'exercise') {
    const current = exerciseWords[currentIndex]
    if (!current) return null
    const data = getExerciseData(current)
    const progress = ((currentIndex + (checked ? 1 : 0)) / exerciseWords.length) * 100

    return (
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Listening Practice
          </h1>
          <div className="flex items-center gap-2">
            {ttsEngine !== 'none' && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  background: ttsEngine === 'hub' ? 'var(--color-primary-faded)' : 'var(--color-surface-alt)',
                  color: ttsEngine === 'hub' ? 'var(--color-primary-main)' : 'var(--color-text-muted)',
                }}
              >
                TTS: {ttsEngine === 'hub' ? 'Creative Hub' : 'Browser'}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-gray-200)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--color-primary-main)' }}
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Exercise card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl px-8 py-10 flex flex-col items-center gap-6"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            {/* Counter */}
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {currentIndex + 1} / {exerciseWords.length}
            </span>

            {/* Play button */}
            <button
              onClick={() => playAudio(data.speakText, data.speakLang)}
              disabled={speaking}
              className="w-24 h-24 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50 transition-transform hover:scale-105 active:scale-95"
              style={{
                background: 'var(--color-primary-main)',
                color: 'white',
                boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
              }}
            >
              {speaking ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
                  </path>
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.49 4.49 0 0 0 2.5-3.5zM14 3.23v2.06a6.51 6.51 0 0 1 0 13.42v2.06A8.51 8.51 0 0 0 14 3.23z" />
                </svg>
              )}
            </button>

            {/* Play again (secondary) */}
            <button
              onClick={() => playAudio(data.speakText, data.speakLang)}
              disabled={speaking}
              className="text-xs font-medium cursor-pointer disabled:opacity-50"
              style={{ color: 'var(--color-primary-main)' }}
            >
              Play Again
            </button>

            {/* Mode hint */}
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {mode === 'word'
                ? 'Type the word you hear'
                : mode === 'translation'
                  ? 'Type the target language word for what you hear'
                  : 'Type the full sentence you hear'}
            </span>

            {/* Input */}
            <div className="w-full max-w-sm flex flex-col gap-3">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={checked}
                placeholder="Type your answer..."
                className="w-full px-4 py-3 rounded-xl text-center text-lg disabled:opacity-60"
                style={{
                  background: 'var(--color-surface-alt)',
                  border: checked
                    ? `2px solid ${current.correct ? 'var(--color-correct)' : 'var(--color-incorrect)'}`
                    : '2px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
                dir={isRTL(data.answerLang) ? 'rtl' : undefined}
              />

              {/* Check / Next button */}
              {!checked ? (
                <button
                  onClick={checkAnswer}
                  disabled={!userInput.trim()}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--color-primary-main)' }}
                >
                  Check
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  {/* Result feedback */}
                  <div className="flex items-center gap-2">
                    {current.correct ? (
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-correct)' }}>
                        {mode === 'dictation' ? 'Good enough!' : 'Correct!'}
                      </span>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--color-incorrect)' }}>
                          {mode === 'dictation' ? 'Needs work' : 'Incorrect'}
                        </span>
                        {mode !== 'dictation' && (
                          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            Correct answer: <strong style={{ color: 'var(--color-correct)' }} dir={isRTL(data.answerLang) ? 'rtl' : undefined}>{data.correctAnswer}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dictation word-by-word scoring */}
                  {mode === 'dictation' && current.wordScores && (
                    <div className="flex flex-wrap gap-1 justify-center max-w-md">
                      {current.wordScores.map((ws, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-sm font-medium"
                          style={{
                            background: ws.correct ? 'rgba(5,150,105,0.12)' : 'rgba(239,68,68,0.12)',
                            color: ws.correct ? 'var(--color-correct)' : 'var(--color-incorrect)',
                            textDecoration: ws.correct ? 'none' : 'underline',
                          }}
                          dir={isRTL(data.answerLang) ? 'rtl' : undefined}
                        >
                          {ws.word}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={nextWord}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                    style={{ background: 'var(--color-primary-main)' }}
                  >
                    {currentIndex + 1 >= exerciseWords.length ? 'See Results' : 'Next'}
                  </button>
                </div>
              )}
            </div>

            {/* Keyboard hint */}
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Press Enter to {checked ? 'continue' : 'check'}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  // ── RESULTS PHASE ──

  const correctCount = exerciseWords.filter(w => w.correct === true).length
  const totalCount = exerciseWords.length
  const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

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
        className="rounded-2xl px-10 py-8 flex flex-col items-center gap-6 w-full max-w-lg"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Score stats */}
        <div className="grid grid-cols-3 gap-8 text-center w-full">
          <div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-correct)' }}>{correctCount}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Correct</div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-incorrect)' }}>{totalCount - correctCount}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Wrong</div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: pct >= 70 ? 'var(--color-correct)' : pct >= 50 ? 'var(--color-primary-main)' : 'var(--color-incorrect)' }}>
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
            Results
          </h3>
          <div className="flex flex-col gap-1.5">
            {exerciseWords.map((ew, i) => {
              const data = getExerciseData(ew)
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm px-3 py-2 rounded"
                  style={{ background: i % 2 === 0 ? 'var(--color-surface-alt)' : 'transparent' }}
                >
                  {/* Indicator */}
                  <span style={{ color: ew.correct ? 'var(--color-correct)' : 'var(--color-incorrect)' }}>
                    {ew.correct ? (
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    )}
                  </span>
                  {/* Word */}
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }} dir={isRTL(data.answerLang) ? 'rtl' : undefined}>
                    {data.correctAnswer}
                  </span>
                  {/* User answer */}
                  <span className="ml-auto text-xs" style={{ color: ew.correct ? 'var(--color-correct)' : 'var(--color-incorrect)' }}>
                    {ew.userAnswer || '(no answer)'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setCurrentIndex(0)
            setUserInput('')
            setChecked(false)
            setExerciseWords(prev => shuffle(prev).map(ew => ({ ...ew, userAnswer: '', correct: null })))
            setPhase('exercise')
            api.startSession(userId, 'listening', selectedListId ?? undefined)
              .then(({ session_id }) => setSessionId(session_id))
              .catch(() => {})
          }}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          Practice Again
        </button>
        <button
          onClick={() => setPhase('setup')}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Back to Setup
        </button>
      </div>
    </motion.div>
  )
}
