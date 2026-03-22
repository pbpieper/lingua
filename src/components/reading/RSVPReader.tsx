import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Word } from '@/types/word'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RSVPState = 'idle' | 'playing' | 'paused' | 'done'

interface TokenInfo {
  raw: string
  normalized: string
  isWord: boolean
  isUnknown: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(w: string): string {
  return w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()
}

function tokenize(text: string): TokenInfo[] {
  // Split into words and whitespace/punctuation
  const parts = text.split(/(\s+)/).filter(Boolean)
  return parts.flatMap(part => {
    if (/^\s+$/.test(part)) return [] // skip whitespace
    // Split punctuation-attached tokens
    const subParts = part.split(/\b/).filter(Boolean)
    return subParts.map(raw => {
      const normalized = normalize(raw)
      const isWord = /[\p{L}]/u.test(raw)
      return { raw, normalized, isWord, isUnknown: false }
    })
  })
}

/** Calculate pause duration: longer words get slightly more time */
function wordDelay(word: string, baseMs: number): number {
  const len = word.length
  if (len > 10) return baseMs * 1.4
  if (len > 6) return baseMs * 1.15
  return baseMs
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RSVPReader() {
  const { userId, hubAvailable } = useApp()

  // Text input
  const [inputText, setInputText] = useState('')
  const [tokens, setTokens] = useState<TokenInfo[]>([])

  // Known words set (from word bank)
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set())
  const [allWords, setAllWords] = useState<Word[]>([])
  const [_loadingWords, setLoadingWords] = useState(false)

  // Playback state
  const [state, setState] = useState<RSVPState>('idle')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [wpm, setWpm] = useState(200)
  const [unknownPauseMs, setUnknownPauseMs] = useState(1500)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Encountered unknown words
  const [unknownEncountered, setUnknownEncountered] = useState<Set<string>>(new Set())
  const [showPopup, setShowPopup] = useState(false)
  const [popupWord, setPopupWord] = useState('')

  // Load known words from word bank
  useEffect(() => {
    if (!hubAvailable) return
    setLoadingWords(true)
    api.getWords(userId, { limit: 5000 }).then(words => {
      setAllWords(words)
      const known = new Set(words.map(w => w.lemma.toLowerCase()))
      // Also add translations as known
      words.forEach(w => known.add(w.translation.toLowerCase()))
      setKnownWords(known)
      setLoadingWords(false)
    }).catch(() => setLoadingWords(false))
  }, [userId, hubAvailable])

  // Tokenize and mark unknown
  const processedTokens = useMemo(() => {
    if (!inputText.trim()) return []
    const toks = tokenize(inputText)
    return toks.map(t => ({
      ...t,
      isUnknown: t.isWord && t.normalized.length > 1 && !knownWords.has(t.normalized),
    }))
  }, [inputText, knownWords])

  const wordTokens = useMemo(() => processedTokens.filter(t => t.isWord), [processedTokens])

  const startReading = useCallback(() => {
    if (wordTokens.length === 0) return
    setTokens(wordTokens)
    setCurrentIndex(0)
    setUnknownEncountered(new Set())
    setState('playing')
    setShowPopup(false)
  }, [wordTokens])

  const pauseReading = useCallback(() => {
    setState('paused')
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const resumeReading = useCallback(() => {
    setState('playing')
  }, [])

  const stopReading = useCallback(() => {
    setState('done')
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const resetReader = useCallback(() => {
    setState('idle')
    setCurrentIndex(0)
    setShowPopup(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  // Advance word
  useEffect(() => {
    if (state !== 'playing' || tokens.length === 0) return

    const token = tokens[currentIndex]
    if (!token) {
      setState('done')
      return
    }

    // If unknown word, pause longer and track it
    if (token.isUnknown) {
      setUnknownEncountered(prev => new Set([...prev, token.normalized]))
      setShowPopup(true)
      setPopupWord(token.raw)
    } else {
      setShowPopup(false)
    }

    const baseMs = (60 / wpm) * 1000
    const delay = token.isUnknown ? unknownPauseMs : wordDelay(token.raw, baseMs)

    timerRef.current = setTimeout(() => {
      if (stateRef.current !== 'playing') return
      if (currentIndex + 1 >= tokens.length) {
        setState('done')
      } else {
        setCurrentIndex(i => i + 1)
      }
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state, currentIndex, tokens, wpm, unknownPauseMs])

  const progress = tokens.length > 0 ? ((currentIndex + 1) / tokens.length) * 100 : 0
  const currentToken = tokens[currentIndex]

  // Find translation for unknown word
  const unknownTranslation = useMemo(() => {
    if (!popupWord) return ''
    const w = allWords.find(w => w.lemma.toLowerCase() === normalize(popupWord))
    return w?.translation || ''
  }, [popupWord, allWords])

  // Collect unknown words for "add to word bank" feature
  const unknownWordsList = useMemo(() => {
    return Array.from(unknownEncountered).filter(w => w.length > 1)
  }, [unknownEncountered])

  // Stats
  const totalWordCount = wordTokens.length
  const unknownCount = wordTokens.filter(t => t.isUnknown).length
  const knownCount = totalWordCount - unknownCount

  // Speed adjustment
  const slower = () => setWpm(w => Math.max(50, w - 25))
  const faster = () => setWpm(w => Math.min(800, w + 25))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <span className="text-2xl">&#x26A1;</span> RSVP Speed Reader
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Rapid Serial Visual Presentation for language learning
          </p>
        </div>
      </div>

      {state === 'idle' && (
        <div className="space-y-4">
          {/* Input area */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Paste text to speed-read
            </label>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              rows={8}
              placeholder="Paste any text in your target language here. Unknown words will be highlighted during reading..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
            />

            {/* Preview stats */}
            {inputText.trim() && (
              <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                <span>{totalWordCount} words</span>
                <span className="text-green-500">{knownCount} known</span>
                <span className="text-orange-500">{unknownCount} unknown</span>
                <span>~{Math.ceil(totalWordCount / wpm)} min at {wpm} WPM</span>
              </div>
            )}
          </div>

          {/* Speed setting */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
              Reading Speed
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={50}
                max={600}
                step={25}
                value={wpm}
                onChange={e => setWpm(Number(e.target.value))}
                className="flex-1 accent-[var(--color-primary-main)]"
              />
              <span className="text-lg font-bold text-[var(--color-text-primary)] min-w-[80px] text-right">
                {wpm} WPM
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1 px-1">
              <span>Slow (50)</span>
              <span>Fast (600)</span>
            </div>
          </div>

          {/* Unknown word pause */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
              Pause on Unknown Words
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={500}
                max={5000}
                step={250}
                value={unknownPauseMs}
                onChange={e => setUnknownPauseMs(Number(e.target.value))}
                className="flex-1 accent-[var(--color-primary-main)]"
              />
              <span className="text-sm font-medium text-[var(--color-text-primary)] min-w-[60px] text-right">
                {(unknownPauseMs / 1000).toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={startReading}
            disabled={!inputText.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all
              bg-[var(--color-primary-main)] text-white hover:opacity-90
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Reading
          </button>

          {!hubAvailable && (
            <p className="text-xs text-center text-[var(--color-text-muted)]">
              Connect your AI backend to highlight unknown words from your word bank
            </p>
          )}
        </div>
      )}

      {/* --- Reading Mode --- */}
      {(state === 'playing' || state === 'paused') && currentToken && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--color-primary-main)' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.15 }}
            />
          </div>

          {/* WPM & progress display */}
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>{currentIndex + 1} / {tokens.length}</span>
            <span>{wpm} WPM</span>
            <span>{Math.ceil(progress)}%</span>
          </div>

          {/* Main display */}
          <div
            className="flex items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            style={{ minHeight: 240 }}
          >
            <div className="text-center px-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.08 }}
                >
                  <span
                    className="text-5xl md:text-6xl font-bold select-none"
                    style={{
                      color: currentToken.isUnknown
                        ? 'var(--color-warning, #f59e0b)'
                        : 'var(--color-text-primary)',
                    }}
                  >
                    {currentToken.raw}
                  </span>
                </motion.div>
              </AnimatePresence>

              {/* Popup translation for unknown words */}
              {showPopup && currentToken.isUnknown && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30"
                >
                  <span className="text-sm text-orange-400 font-medium">
                    {unknownTranslation || 'Unknown word'}
                  </span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={slower}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              Slower
            </button>
            <button
              onClick={state === 'playing' ? pauseReading : resumeReading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity"
            >
              {state === 'playing' ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={faster}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              Faster
            </button>
          </div>

          <button
            onClick={stopReading}
            className="w-full py-2 rounded-lg text-xs font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {/* --- Done State --- */}
      {state === 'done' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
            <div className="text-4xl mb-3">&#x2705;</div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">Reading Complete!</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {tokens.length} words at {wpm} WPM
            </p>
          </div>

          {/* Unknown words summary */}
          {unknownWordsList.length > 0 && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
              <h4 className="text-sm font-semibold text-orange-500 mb-3">
                {unknownWordsList.length} Unknown Words Encountered
              </h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {unknownWordsList.map(w => (
                  <span
                    key={w}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  >
                    {w}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Go to Upload or Word Bank to add these words to your vocabulary
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
              <div className="text-lg font-bold text-[var(--color-text-primary)]">{tokens.length}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Total Words</div>
            </div>
            <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
              <div className="text-lg font-bold text-green-500">{tokens.length - unknownWordsList.length}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Known</div>
            </div>
            <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
              <div className="text-lg font-bold text-orange-500">{unknownWordsList.length}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Unknown</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetReader}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              New Text
            </button>
            <button
              onClick={() => { setCurrentIndex(0); setState('playing'); setShowPopup(false) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity"
            >
              Read Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
