import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { getWords, startSession, endSession, submitReview } from '@/services/vocabApi'
import { isRTL } from '@/lib/csvParser'
import { getLocalWords, shuffle as shuffleLocal } from '@/lib/localStore'
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty'
import { AdaptiveBanner } from '@/components/atoms/AdaptiveBanner'
import { ToolOptionsBar } from '@/components/atoms/ToolOptionsBar'
import { useXP } from '@/hooks/useXP'
import { loadToolConfig, saveToolConfig } from '@/types/toolConfig'
import type { ToolVariable, ToolVariation } from '@/types/toolConfig'
import type { Word } from '@/types/word'

type CardSide = 'lemma' | 'translation'

// --- Variables & Variations config ---

const MATCH_VARIATIONS: ToolVariation[] = [
  { key: 'memory', label: 'Memory', description: 'Flip cards to find matching pairs', icon: '🃏' },
  { key: 'column', label: 'Connect', description: 'Match items from two columns', icon: '🔗' },
  { key: 'image', label: 'Image', description: 'Match words with emoji/image representations', icon: '🖼️' },
]

const MATCH_VARIABLES: ToolVariable[] = [
  {
    key: 'pairCount',
    label: 'Pairs',
    type: 'select',
    options: [
      { value: '4', label: '4' },
      { value: '6', label: '6' },
      { value: '8', label: '8' },
      { value: '12', label: '12' },
      { value: '16', label: '16' },
    ],
    default: '6',
  },
  {
    key: 'direction',
    label: 'Direction',
    type: 'select',
    options: [
      { value: 'l2-l1', label: 'Target → Native' },
      { value: 'l1-l2', label: 'Native → Target' },
    ],
    default: 'l2-l1',
  },
  { key: 'timer', label: 'Timer', type: 'toggle', default: true },
]

type MatchVars = { pairCount: string; direction: string; timer: boolean }
const DEFAULT_VARS: MatchVars = { pairCount: '6', direction: 'l2-l1', timer: true }

interface Card {
  id: string
  wordId: number
  text: string
  side: CardSide
  lang: string
  matched: boolean
  revealed: boolean
  flash: 'correct' | 'incorrect' | null
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildCards(words: Word[]): Card[] {
  const cards: Card[] = []
  for (const w of words) {
    cards.push({
      id: `lemma-${w.id}`,
      wordId: w.id,
      text: w.lemma,
      side: 'lemma',
      lang: w.language_from,
      matched: false,
      revealed: false,
      flash: null,
    })
    cards.push({
      id: `trans-${w.id}`,
      wordId: w.id,
      text: w.translation,
      side: 'translation',
      lang: w.language_to,
      matched: false,
      revealed: false,
      flash: null,
    })
  }
  return shuffle(cards)
}

// Placeholder emoji map for Image Match mode.
// Maps common English words/concepts to emoji representations.
// Proper image support coming later via Creative Hub image generation.
const WORD_EMOJI_MAP: Record<string, string> = {
  cat: '🐱', dog: '🐶', house: '🏠', tree: '🌳', sun: '☀️', moon: '🌙',
  water: '💧', fire: '🔥', book: '📖', car: '🚗', food: '🍽️', apple: '🍎',
  fish: '🐟', bird: '🐦', flower: '🌸', star: '⭐', heart: '❤️', eye: '👁️',
  hand: '✋', door: '🚪', key: '🔑', phone: '📱', clock: '🕐', rain: '🌧️',
  snow: '❄️', mountain: '⛰️', sea: '🌊', school: '🏫', pen: '🖊️', bread: '🍞',
  milk: '🥛', coffee: '☕', tea: '🍵', egg: '🥚', rice: '🍚', meat: '🥩',
  horse: '🐴', cow: '🐮', chicken: '🐔', sheep: '🐑', lion: '🦁', bear: '🐻',
  child: '👶', man: '👨', woman: '👩', baby: '👶', family: '👨‍👩‍👧', king: '👑',
  money: '💰', gift: '🎁', letter: '✉️', music: '🎵', ball: '⚽', airplane: '✈️',
  train: '🚂', boat: '⛵', bicycle: '🚲', bus: '🚌', hospital: '🏥', city: '🏙️',
}

const FALLBACK_EMOJIS = ['📝', '📌', '🔤', '🏷️', '💬', '📋', '🗂️', '🧩', '🎯', '📎',
  '📚', '🧪', '💡', '🔍', '📐', '📊', '🎨', '🪶', '🫧', '🧿']

function getEmojiForWord(word: Word): string {
  // Try direct translation match
  const trans = word.translation.toLowerCase().trim()
  if (WORD_EMOJI_MAP[trans]) return WORD_EMOJI_MAP[trans]
  // Try matching any word within the translation
  for (const part of trans.split(/\s+/)) {
    if (WORD_EMOJI_MAP[part]) return WORD_EMOJI_MAP[part]
  }
  // Fallback: deterministic pick based on word id
  return FALLBACK_EMOJIS[word.id % FALLBACK_EMOJIS.length]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MatchGame() {
  const { userId, currentListId, activeStudyWords, activeStudyVersion, hubAvailable } = useApp()
  const adaptive = useAdaptiveDifficulty()
  const { addXP } = useXP()

  // Tool config state
  const [toolCfg] = useState(() => loadToolConfig<MatchVars>('match', { variation: 'memory', variables: DEFAULT_VARS }))
  const [variation, setVariation] = useState(toolCfg.activeVariation)
  const [vars, setVars] = useState<MatchVars>(toolCfg.activeVariables)

  const handleVariationChange = useCallback((key: string) => {
    setVariation(key)
    saveToolConfig('match', key, vars)
  }, [vars])

  const handleVariableChange = useCallback((key: string, value: unknown) => {
    setVars(prev => {
      const next = { ...prev, [key]: value }
      saveToolConfig('match', variation, next)
      return next
    })
  }, [variation])

  const pairCount = Number(vars.pairCount) || 6

  const [words, setWords] = useState<Word[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [selected, setSelected] = useState<Card | null>(null)
  const [matchCount, setMatchCount] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [victory, setVictory] = useState(false)
  const [locked, setLocked] = useState(false)
  // Column matching state
  const [columnLeft, setColumnLeft] = useState<Card | null>(null)
  const [matchedIds, setMatchedIds] = useState<Set<number>>(new Set())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionRef = useRef<number | null>(null)

  const totalPairs = words.length

  const fetchWords = useCallback(async () => {
    setLoading(true)
    setMatchedIds(new Set())
    setColumnLeft(null)
    try {
      let fetched: Word[]
      if (activeStudyWords && activeStudyWords.length > 0) {
        fetched = activeStudyWords.slice(0, pairCount)
      } else if (!hubAvailable) {
        // Offline: use locally stored words
        fetched = shuffleLocal(getLocalWords()).slice(0, pairCount)
      } else {
        fetched = await getWords(userId, { list_id: currentListId ?? undefined, limit: pairCount })
      }
      setWords(fetched)
      if (fetched.length >= 4) {
        setCards(buildCards(fetched))
        if (hubAvailable) {
          const { session_id } = await startSession(userId, 'match', currentListId ?? undefined)
          sessionRef.current = session_id
        }
      }
    } catch {
      if (hubAvailable) toast.error('Failed to load words')
    } finally {
      setLoading(false)
    }
  }, [userId, currentListId, activeStudyWords, activeStudyVersion, hubAvailable, pairCount])

  useEffect(() => {
    fetchWords()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchWords])

  // Timer
  useEffect(() => {
    if (!loading && words.length >= 4 && !victory) {
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }
  }, [loading, words.length, victory])

  const handleNewGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSelected(null)
    setMatchCount(0)
    setAttempts(0)
    setElapsed(0)
    setVictory(false)
    setLocked(false)
    fetchWords()
  }, [fetchWords])

  const handleCardClick = useCallback(async (card: Card) => {
    if (locked || card.matched || card.revealed) return

    // Reveal the card
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, revealed: true } : c))

    if (!selected) {
      setSelected(card)
      return
    }

    // Second card selected — same side? Deselect first
    if (selected.side === card.side) {
      setCards(prev => prev.map(c => c.id === selected.id ? { ...c, revealed: false } : c))
      setSelected(card)
      return
    }

    setLocked(true)
    setAttempts(a => a + 1)

    const isMatch = selected.wordId === card.wordId

    if (isMatch) {
      adaptive.recordAnswer(true, 'meaning')
      // Flash green and mark matched
      setCards(prev => prev.map(c =>
        c.wordId === card.wordId
          ? { ...c, matched: true, revealed: true, flash: 'correct' }
          : c
      ))
      setMatchCount(m => {
        const next = m + 1
        if (next === totalPairs) {
          if (timerRef.current) clearInterval(timerRef.current)
          setVictory(true)
          addXP(15, 'game_round')
          // End session
          if (sessionRef.current) {
            endSession(sessionRef.current, {
              words_reviewed: totalPairs,
              correct: next,
              wrong: 0,
              score_data: { time: elapsed, attempts: attempts + 1 },
            }).catch(() => {})
          }
        }
        return next
      })
      // Submit positive review
      submitReview({ word_id: card.wordId, quality: 5, user_id: userId }).catch(() => {})
      // Clear flash after delay
      setTimeout(() => {
        setCards(prev => prev.map(c =>
          c.wordId === card.wordId ? { ...c, flash: null } : c
        ))
        setLocked(false)
      }, 600)
    } else {
      adaptive.recordAnswer(false, 'meaning')
      // Flash red then flip back
      setCards(prev => prev.map(c =>
        c.id === selected.id || c.id === card.id
          ? { ...c, flash: 'incorrect' }
          : c
      ))
      setTimeout(() => {
        setCards(prev => prev.map(c =>
          c.id === selected.id || c.id === card.id
            ? { ...c, revealed: false, flash: null }
            : c
        ))
        setLocked(false)
      }, 800)
    }

    setSelected(null)
  }, [selected, locked, totalPairs, elapsed, attempts, userId])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse py-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-36 rounded-lg bg-[var(--color-surface-alt)]" />
          <div className="h-5 w-20 rounded bg-[var(--color-surface-alt)]" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/2] rounded-xl bg-[var(--color-surface-alt)]" />
          ))}
        </div>
      </div>
    )
  }

  if (words.length < 4) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        {!hubAvailable ? (
          <>
            <div className="text-4xl opacity-40">&#9889;</div>
            <span className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Backend Offline
            </span>
            <span className="text-sm text-center max-w-sm" style={{ color: 'var(--color-text-muted)' }}>
              Match Game needs the Creative Hub backend to load your vocabulary.
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
              ~/Projects/creative-hub/scripts/start_services.sh all
            </span>
          </>
        ) : (
          <>
            <span className="text-lg font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Not enough words
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Upload vocabulary first (need at least 4 words).
            </span>
          </>
        )}
      </div>
    )
  }

  if (victory) {
    const timeBonus = Math.max(0, 120 - elapsed)
    const accuracyPct = Math.round((totalPairs / attempts) * 100)
    const score = totalPairs * 100 + timeBonus * 5

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16 gap-6"
      >
        <h2
          className="text-3xl font-bold"
          style={{ color: 'var(--color-correct)' }}
        >
          All Matched!
        </h2>

        <div
          className="rounded-2xl px-10 py-8 flex flex-col items-center gap-4"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {formatTime(elapsed)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Time</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {accuracyPct}%
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Accuracy</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-primary-main)' }}>
                {score}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Score</div>
            </div>
          </div>

          <div className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            {totalPairs} pairs in {attempts} attempts
          </div>
        </div>

        <button
          onClick={handleNewGame}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Play Again
        </button>
      </motion.div>
    )
  }

  // --- Column matching handlers ---
  const handleColumnClick = useCallback((card: Card) => {
    if (matchedIds.has(card.wordId)) return

    if (!columnLeft) {
      if (card.side === 'lemma') setColumnLeft(card)
      return
    }

    // Must pick from other side
    if (card.side === 'lemma') {
      setColumnLeft(card)
      return
    }

    setAttempts(a => a + 1)
    const isMatch = columnLeft.wordId === card.wordId

    if (isMatch) {
      adaptive.recordAnswer(true, 'meaning')
      setMatchedIds(prev => new Set(prev).add(card.wordId))
      setMatchCount(m => {
        const next = m + 1
        if (next === totalPairs) {
          if (timerRef.current) clearInterval(timerRef.current)
          setVictory(true)
          addXP(15, 'game_round')
          if (sessionRef.current) {
            endSession(sessionRef.current, {
              words_reviewed: totalPairs,
              correct: next,
              wrong: 0,
              score_data: { time: elapsed, attempts: attempts + 1 },
            }).catch(() => {})
          }
        }
        return next
      })
      submitReview({ word_id: card.wordId, quality: 5, user_id: userId }).catch(() => {})
    } else {
      adaptive.recordAnswer(false, 'meaning')
    }
    setColumnLeft(null)
  }, [columnLeft, matchedIds, totalPairs, elapsed, attempts, userId, adaptive])

  // --- Image match handlers ---
  const handleImageClick = useCallback((card: Card) => {
    if (matchedIds.has(card.wordId)) return

    if (!columnLeft) {
      // First pick — can be either emoji or word
      setColumnLeft(card)
      return
    }

    // Must pick from other side
    if (card.side === columnLeft.side) {
      setColumnLeft(card)
      return
    }

    setAttempts(a => a + 1)
    const isMatch = columnLeft.wordId === card.wordId

    if (isMatch) {
      adaptive.recordAnswer(true, 'meaning')
      setMatchedIds(prev => new Set(prev).add(card.wordId))
      setMatchCount(m => {
        const next = m + 1
        if (next === totalPairs) {
          if (timerRef.current) clearInterval(timerRef.current)
          setVictory(true)
          addXP(15, 'game_round')
          if (sessionRef.current) {
            endSession(sessionRef.current, {
              words_reviewed: totalPairs,
              correct: next,
              wrong: 0,
              score_data: { time: elapsed, attempts: attempts + 1 },
            }).catch(() => {})
          }
        }
        return next
      })
      submitReview({ word_id: card.wordId, quality: 5, user_id: userId }).catch(() => {})
    } else {
      adaptive.recordAnswer(false, 'meaning')
    }
    setColumnLeft(null)
  }, [columnLeft, matchedIds, totalPairs, elapsed, attempts, userId, adaptive])

  // Shuffled words for image match (stable across re-renders)
  const imageRightWords = useMemo(() => shuffle([...words]), [words])

  // Column data for connect variation
  const leftColumn = words.map(w => ({
    wordId: w.id,
    text: vars.direction === 'l1-l2' ? w.translation : w.lemma,
    lang: vars.direction === 'l1-l2' ? w.language_to : w.language_from,
    side: 'lemma' as CardSide,
  }))
  const rightColumn = words.map(w => ({
    wordId: w.id,
    text: vars.direction === 'l1-l2' ? w.lemma : w.translation,
    lang: vars.direction === 'l1-l2' ? w.language_from : w.language_to,
    side: 'translation' as CardSide,
  }))

  return (
    <div className="flex flex-col gap-5">
      <AdaptiveBanner state={adaptive} />

      {/* Options bar */}
      <ToolOptionsBar
        variations={MATCH_VARIATIONS}
        variables={MATCH_VARIABLES}
        activeVariation={variation}
        activeVariables={vars}
        onVariationChange={handleVariationChange}
        onVariableChange={handleVariableChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Match Game
          </h1>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: 'var(--color-primary-faded)',
              color: 'var(--color-primary-main)',
            }}
          >
            {matchCount} / {totalPairs} pairs
          </span>
        </div>
        <div className="flex items-center gap-3">
          {vars.timer && (
            <span
              className="text-sm font-mono tabular-nums"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {formatTime(elapsed)}
            </span>
          )}
          <button
            onClick={handleNewGame}
            className="px-4 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
            }}
          >
            New Game
          </button>
        </div>
      </div>

      {/* Memory variation (existing flip cards) */}
      {variation === 'memory' && (
        <div
          className={`grid gap-3 ${
            cards.length <= 8 ? 'grid-cols-4' : cards.length <= 12 ? 'grid-cols-4' : 'grid-cols-6'
          }`}
        >
          {cards.map(card => (
            <motion.button
              key={card.id}
              onClick={() => handleCardClick(card)}
              className="relative rounded-xl cursor-pointer select-none overflow-hidden"
              style={{
                height: 100,
                background: card.matched
                  ? 'var(--color-primary-faded)'
                  : card.flash === 'correct'
                    ? 'rgba(5, 150, 105, 0.12)'
                    : card.flash === 'incorrect'
                      ? 'rgba(239, 68, 68, 0.12)'
                      : card.revealed
                        ? 'var(--color-surface)'
                        : 'var(--color-primary-main)',
                border: `2px solid ${
                  card.flash === 'correct'
                    ? 'var(--color-correct)'
                    : card.flash === 'incorrect'
                      ? 'var(--color-incorrect)'
                      : card.matched
                        ? 'var(--color-correct)'
                        : card.revealed
                          ? 'var(--color-primary-main)'
                          : 'transparent'
                }`,
              }}
              whileHover={!card.matched && !card.revealed ? { scale: 1.03 } : {}}
              whileTap={!card.matched ? { scale: 0.97 } : {}}
            >
              <AnimatePresence mode="wait">
                {card.revealed || card.matched ? (
                  <motion.span
                    key="text"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 flex flex-col items-center justify-center px-2"
                  >
                    <span
                      className="text-sm font-semibold text-center leading-snug"
                      style={{
                        color: card.matched
                          ? 'var(--color-correct)'
                          : 'var(--color-text-primary)',
                      }}
                    >
                      <span dir={isRTL(card.lang) ? 'rtl' : undefined}>{card.text}</span>
                    </span>
                    <span
                      className="text-xs mt-1 uppercase tracking-wide font-medium"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {card.side === 'lemma' ? 'word' : 'translation'}
                    </span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="text-2xl text-white/80">?</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      )}

      {/* Column connect variation */}
      {variation === 'column' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Left column — words */}
          <div className="flex flex-col gap-2">
            {leftColumn.map(item => {
              const isMatched = matchedIds.has(item.wordId)
              const isSelected = columnLeft?.wordId === item.wordId && columnLeft?.side === 'lemma'
              return (
                <motion.button
                  key={`left-${item.wordId}`}
                  onClick={() => handleColumnClick({ ...item, id: `left-${item.wordId}`, matched: isMatched, revealed: true, flash: null })}
                  className="px-4 py-3 rounded-xl text-sm font-medium cursor-pointer text-left transition-colors"
                  style={{
                    background: isMatched
                      ? 'var(--color-primary-faded)'
                      : isSelected
                        ? 'var(--color-primary-main)'
                        : 'var(--color-surface)',
                    color: isMatched
                      ? 'var(--color-correct)'
                      : isSelected
                        ? '#fff'
                        : 'var(--color-text-primary)',
                    border: `2px solid ${
                      isMatched ? 'var(--color-correct)' : isSelected ? 'var(--color-primary-main)' : 'var(--color-border)'
                    }`,
                    opacity: isMatched ? 0.6 : 1,
                    textDecoration: isMatched ? 'line-through' : 'none',
                  }}
                  whileHover={!isMatched ? { scale: 1.02 } : {}}
                  whileTap={!isMatched ? { scale: 0.98 } : {}}
                >
                  <span dir={isRTL(item.lang) ? 'rtl' : undefined}>{item.text}</span>
                </motion.button>
              )
            })}
          </div>
          {/* Right column — translations */}
          <div className="flex flex-col gap-2">
            {rightColumn.map(item => {
              const isMatched = matchedIds.has(item.wordId)
              return (
                <motion.button
                  key={`right-${item.wordId}`}
                  onClick={() => handleColumnClick({ ...item, id: `right-${item.wordId}`, matched: isMatched, revealed: true, flash: null })}
                  className="px-4 py-3 rounded-xl text-sm font-medium cursor-pointer text-left transition-colors"
                  style={{
                    background: isMatched ? 'var(--color-primary-faded)' : 'var(--color-surface)',
                    color: isMatched ? 'var(--color-correct)' : 'var(--color-text-primary)',
                    border: `2px solid ${isMatched ? 'var(--color-correct)' : 'var(--color-border)'}`,
                    opacity: isMatched ? 0.6 : 1,
                    textDecoration: isMatched ? 'line-through' : 'none',
                  }}
                  whileHover={!isMatched ? { scale: 1.02 } : {}}
                  whileTap={!isMatched ? { scale: 0.98 } : {}}
                >
                  <span dir={isRTL(item.lang) ? 'rtl' : undefined}>{item.text}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* Image match variation */}
      {variation === 'image' && (
        <div className="flex flex-col gap-4">
          <p
            className="text-xs text-center italic"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Image Match uses emoji placeholders. Proper image support via Creative Hub coming later.
          </p>
          <div className="grid grid-cols-2 gap-6">
            {/* Left: emoji images */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-center mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Images
              </div>
              {words.map(w => {
                const isMatched = matchedIds.has(w.id)
                const isSelected = columnLeft?.wordId === w.id && columnLeft?.side === 'lemma'
                return (
                  <motion.button
                    key={`img-${w.id}`}
                    onClick={() => handleImageClick({
                      id: `img-${w.id}`, wordId: w.id, text: getEmojiForWord(w),
                      side: 'lemma', lang: w.language_from, matched: isMatched, revealed: true, flash: null,
                    })}
                    className="px-4 py-4 rounded-xl cursor-pointer text-center transition-colors"
                    style={{
                      background: isMatched
                        ? 'var(--color-primary-faded)'
                        : isSelected
                          ? 'var(--color-primary-main)'
                          : 'var(--color-surface)',
                      border: `2px solid ${
                        isMatched ? 'var(--color-correct)' : isSelected ? 'var(--color-primary-main)' : 'var(--color-border)'
                      }`,
                      opacity: isMatched ? 0.6 : 1,
                    }}
                    whileHover={!isMatched ? { scale: 1.03 } : {}}
                    whileTap={!isMatched ? { scale: 0.97 } : {}}
                  >
                    <span className="text-3xl">{getEmojiForWord(w)}</span>
                  </motion.button>
                )
              })}
            </div>
            {/* Right: words */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-center mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Words
              </div>
              {imageRightWords.map(w => {
                const isMatched = matchedIds.has(w.id)
                const isSelected = columnLeft?.wordId === w.id && columnLeft?.side === 'translation'
                const text = vars.direction === 'l1-l2' ? w.translation : w.lemma
                const lang = vars.direction === 'l1-l2' ? w.language_to : w.language_from
                return (
                  <motion.button
                    key={`word-${w.id}`}
                    onClick={() => handleImageClick({
                      id: `word-${w.id}`, wordId: w.id, text,
                      side: 'translation', lang, matched: isMatched, revealed: true, flash: null,
                    })}
                    className="px-4 py-4 rounded-xl text-sm font-medium cursor-pointer text-center transition-colors"
                    style={{
                      background: isMatched
                        ? 'var(--color-primary-faded)'
                        : isSelected
                          ? 'var(--color-primary-main)'
                          : 'var(--color-surface)',
                      color: isMatched
                        ? 'var(--color-correct)'
                        : isSelected
                          ? '#fff'
                          : 'var(--color-text-primary)',
                      border: `2px solid ${
                        isMatched ? 'var(--color-correct)' : isSelected ? 'var(--color-primary-main)' : 'var(--color-border)'
                      }`,
                      opacity: isMatched ? 0.6 : 1,
                      textDecoration: isMatched ? 'line-through' : 'none',
                    }}
                    whileHover={!isMatched ? { scale: 1.02 } : {}}
                    whileTap={!isMatched ? { scale: 0.98 } : {}}
                  >
                    <span dir={isRTL(lang) ? 'rtl' : undefined}>{text}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
