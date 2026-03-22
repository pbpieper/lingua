import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Word } from '@/types/word'

// ─── Types ────────────────────────────────────────────────────────

type Level = 'chars' | 'short' | 'words' | 'phrases'

interface TypingStats {
  correct: number
  wrong: number
  totalChars: number
  startTime: number | null
  charErrors: Record<string, number>     // char -> error count
  charAttempts: Record<string, number>    // char -> attempt count
}

// ─── Keyboard Layouts ─────────────────────────────────────────────

const KEYBOARD_LAYOUTS: Record<string, string[][]> = {
  ar: [
    ['\u0636', '\u0635', '\u062B', '\u0642', '\u0641', '\u063A', '\u0639', '\u0647', '\u062E', '\u062D', '\u062C', '\u062F'],
    ['\u0634', '\u0633', '\u064A', '\u0628', '\u0644', '\u0627', '\u062A', '\u0646', '\u0645', '\u0643', '\u0637'],
    ['\u0626', '\u0621', '\u0624', '\u0631', '\u0644\u0627', '\u0649', '\u0629', '\u0648', '\u0632', '\u0638'],
  ],
  ru: [
    ['\u0439', '\u0446', '\u0443', '\u043A', '\u0435', '\u043D', '\u0433', '\u0448', '\u0449', '\u0437', '\u0445', '\u044A'],
    ['\u0444', '\u044B', '\u0432', '\u0430', '\u043F', '\u0440', '\u043E', '\u043B', '\u0434', '\u0436', '\u044D'],
    ['\u044F', '\u0447', '\u0441', '\u043C', '\u0438', '\u0442', '\u044C', '\u0431', '\u044E'],
  ],
  ja: [
    ['\u3042', '\u3044', '\u3046', '\u3048', '\u304A', '\u304B', '\u304D', '\u304F', '\u3051', '\u3053'],
    ['\u3055', '\u3057', '\u3059', '\u305B', '\u305D', '\u305F', '\u3061', '\u3064', '\u3066', '\u3068'],
    ['\u306A', '\u306B', '\u306C', '\u306D', '\u306E', '\u306F', '\u3072', '\u3075', '\u3078', '\u307B'],
  ],
  ko: [
    ['\u3142', '\u3148', '\u3137', '\u3131', '\u3145', '\u315B', '\u3155', '\u3151', '\u3150', '\u3154'],
    ['\u3141', '\u3134', '\u3147', '\u3139', '\u3160', '\u314F', '\u3153', '\u3157', '\u3161'],
    ['\u314B', '\u314C', '\u314A', '\u314D', '\u3163', '\u3152', '\u3156', '\u315C'],
  ],
  de: [
    ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', '\u00FC'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '\u00F6', '\u00E4'],
    ['y', 'x', 'c', 'v', 'b', 'n', 'm', '\u00DF'],
  ],
  es: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '\u00F1'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '\u00E1', '\u00E9', '\u00ED', '\u00F3', '\u00FA'],
  ],
  fr: [
    ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
    ['w', 'x', 'c', 'v', 'b', 'n', '\u00E9', '\u00E8', '\u00EA', '\u00E0', '\u00E7'],
  ],
}

// Default QWERTY for unsupported languages
const DEFAULT_LAYOUT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

// ─── Sample Characters / Words ───────────────────────────────────

function getCharsForLanguage(lang: string): string[] {
  const layout = KEYBOARD_LAYOUTS[lang] ?? DEFAULT_LAYOUT
  return layout.flat()
}

function getShortWordsForLanguage(lang: string): string[] {
  const WORDS: Record<string, string[]> = {
    ar: ['\u0628\u064A\u062A', '\u0643\u062A\u0627\u0628', '\u0642\u0644\u0645', '\u0628\u0627\u0628', '\u0646\u0648\u0631', '\u0645\u0627\u0621', '\u0634\u0645\u0633'],
    ja: ['\u306D\u3053', '\u3044\u306C', '\u3055\u304B\u306A', '\u3084\u307E', '\u305D\u3089', '\u3046\u307F'],
    ko: ['\uC0AC\uB78C', '\uC9D1', '\uD558\uB298', '\uBB3C', '\uBD88', '\uB098\uBB34'],
    de: ['Haus', 'Buch', 'Welt', 'Kind', 'Tisch', 'Stuhl', 'gr\u00FC\u00DF', 'f\u00FCnf'],
    es: ['hola', 'casa', 'gato', 'ni\u00F1o', 'a\u00F1o', 'ma\u00F1ana'],
    fr: ['chat', 'lune', 'eau', '\u00E9cole', 'fr\u00E8re', 'gar\u00E7on'],
    ru: ['\u0434\u043E\u043C', '\u043A\u043E\u0442', '\u043C\u0438\u0440', '\u0434\u0435\u043D\u044C', '\u0432\u043E\u0434\u0430'],
  }
  return WORDS[lang] ?? ['hello', 'world', 'book', 'house', 'water']
}

// ─── Component ────────────────────────────────────────────────────

export function KeyboardTrainer() {
  const { userId, activeLanguage } = useApp()
  const [level, setLevel] = useState<Level>('chars')
  const [target, setTarget] = useState('')
  const [input, setInput] = useState('')
  const [stats, setStats] = useState<TypingStats>({
    correct: 0, wrong: 0, totalChars: 0, startTime: null,
    charErrors: {}, charAttempts: {},
  })
  const [isComplete, setIsComplete] = useState(false)
  const [round, setRound] = useState(0)
  const [words, setWords] = useState<Word[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const layout = KEYBOARD_LAYOUTS[activeLanguage] ?? DEFAULT_LAYOUT

  // Load user words for 'words' and 'phrases' levels
  useEffect(() => {
    api.getWords(userId, { limit: 200 })
      .then(w => setWords(w.sort(() => Math.random() - 0.5)))
      .catch(() => {})
  }, [userId])

  // Generate next target
  const generateTarget = useCallback(() => {
    let newTarget = ''
    switch (level) {
      case 'chars': {
        const chars = getCharsForLanguage(activeLanguage)
        newTarget = chars[Math.floor(Math.random() * chars.length)]
        break
      }
      case 'short': {
        const shortWords = getShortWordsForLanguage(activeLanguage)
        newTarget = shortWords[Math.floor(Math.random() * shortWords.length)]
        break
      }
      case 'words': {
        if (words.length > 0) {
          newTarget = words[Math.floor(Math.random() * words.length)].lemma
        } else {
          const shortWords = getShortWordsForLanguage(activeLanguage)
          newTarget = shortWords[Math.floor(Math.random() * shortWords.length)]
        }
        break
      }
      case 'phrases': {
        if (words.length >= 2) {
          const w1 = words[Math.floor(Math.random() * words.length)]
          const w2 = words[Math.floor(Math.random() * words.length)]
          newTarget = `${w1.lemma} ${w2.lemma}`
        } else {
          newTarget = getShortWordsForLanguage(activeLanguage).slice(0, 2).join(' ')
        }
        break
      }
    }
    setTarget(newTarget)
    setInput('')
    setIsComplete(false)
  }, [level, activeLanguage, words])

  // Start first round
  useEffect(() => {
    generateTarget()
  }, [generateTarget, round])

  // Focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [target])

  const handleInput = useCallback((value: string) => {
    setInput(value)

    if (!stats.startTime) {
      setStats(prev => ({ ...prev, startTime: Date.now() }))
    }

    // Track character accuracy
    const newCharAttempts = { ...stats.charAttempts }
    const newCharErrors = { ...stats.charErrors }
    let correct = 0
    let wrong = 0

    for (let i = 0; i < value.length; i++) {
      const expected = target[i]
      const actual = value[i]
      if (expected) {
        newCharAttempts[expected] = (newCharAttempts[expected] ?? 0) + 1
        if (actual !== expected) {
          newCharErrors[expected] = (newCharErrors[expected] ?? 0) + 1
          wrong++
        } else {
          correct++
        }
      }
    }

    setStats(prev => ({
      ...prev,
      charAttempts: newCharAttempts,
      charErrors: newCharErrors,
    }))

    // Check completion
    if (value === target) {
      setStats(prev => ({
        ...prev,
        correct: prev.correct + 1,
        totalChars: prev.totalChars + target.length,
      }))
      setIsComplete(true)
      setTimeout(() => {
        setRound(r => r + 1)
      }, 600)
    } else if (value.length >= target.length && value !== target) {
      setStats(prev => ({
        ...prev,
        wrong: prev.wrong + 1,
        totalChars: prev.totalChars + target.length,
      }))
    }
  }, [target, stats.startTime, stats.charAttempts, stats.charErrors])

  // Calculate speed
  const wpm = useMemo(() => {
    if (!stats.startTime || stats.totalChars === 0) return 0
    const elapsed = (Date.now() - stats.startTime) / 60000
    if (elapsed < 0.01) return 0
    return Math.round((stats.totalChars / 5) / elapsed)
  }, [stats.startTime, stats.totalChars])

  const accuracy = useMemo(() => {
    const total = stats.correct + stats.wrong
    if (total === 0) return 100
    return Math.round((stats.correct / total) * 100)
  }, [stats.correct, stats.wrong])

  // Keyboard heatmap data
  const keyHeat = useMemo(() => {
    const heat: Record<string, { attempts: number; errors: number; errorRate: number }> = {}
    layout.flat().forEach(key => {
      const attempts = stats.charAttempts[key] ?? 0
      const errors = stats.charErrors[key] ?? 0
      heat[key] = { attempts, errors, errorRate: attempts > 0 ? errors / attempts : 0 }
    })
    return heat
  }, [layout, stats.charAttempts, stats.charErrors])

  const handleReset = useCallback(() => {
    setStats({ correct: 0, wrong: 0, totalChars: 0, startTime: null, charErrors: {}, charAttempts: {} })
    setRound(0)
  }, [])

  // Color for key heat
  function getKeyColor(errorRate: number, attempts: number): string {
    if (attempts === 0) return 'var(--color-surface-alt)'
    if (errorRate > 0.5) return '#fca5a5'
    if (errorRate > 0.25) return '#fed7aa'
    if (errorRate > 0) return '#fef08a'
    return '#bbf7d0'
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Keyboard Trainer</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Master typing in your target language</p>
        </div>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-light)] transition-colors cursor-pointer"
        >
          Reset Stats
        </button>
      </div>

      {/* Level Selector */}
      <div className="flex items-center gap-2">
        {([
          { key: 'chars' as Level, label: 'Characters', icon: 'A' },
          { key: 'short' as Level, label: 'Short Words', icon: 'Ab' },
          { key: 'words' as Level, label: 'Words', icon: 'Abc' },
          { key: 'phrases' as Level, label: 'Phrases', icon: 'A b c' },
        ]).map(l => (
          <button
            key={l.key}
            onClick={() => { setLevel(l.key); setRound(r => r + 1) }}
            className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
              level === l.key
                ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
            }`}
          >
            <span className="font-mono mr-1">{l.icon}</span> {l.label}
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-center">
          <div className="text-base font-bold text-[var(--color-text-primary)]">{stats.correct}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Correct</div>
        </div>
        <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-center">
          <div className="text-base font-bold text-red-600">{stats.wrong}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Wrong</div>
        </div>
        <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-center">
          <div className="text-base font-bold text-green-600">{accuracy}%</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Accuracy</div>
        </div>
        <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-center">
          <div className="text-base font-bold text-blue-600">{wpm}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">WPM</div>
        </div>
      </div>

      {/* Target Display */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Type this:</p>
        <div className="flex items-center justify-center gap-0.5 text-3xl font-bold mb-4 flex-wrap">
          {target.split('').map((char, i) => {
            let color = 'var(--color-text-primary)'
            if (i < input.length) {
              color = input[i] === char ? 'var(--color-correct)' : '#ef4444'
            }
            const isCurrent = i === input.length
            return (
              <span
                key={i}
                style={{ color }}
                className={`inline-block transition-colors ${isCurrent ? 'underline decoration-[var(--color-primary-main)] decoration-2' : ''}`}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            )
          })}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => handleInput(e.target.value)}
          className="w-full max-w-md mx-auto text-center text-xl py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-main)] transition-colors"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
        />

        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-green-600 font-bold text-sm"
            >
              Correct! Loading next...
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard Heat Map */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-xs font-bold text-[var(--color-text-primary)] mb-3">Keyboard Accuracy Map</h3>
        <div className="flex flex-col items-center gap-1">
          {layout.map((row, ri) => (
            <div key={ri} className="flex gap-1" style={{ paddingLeft: ri * 12 }}>
              {row.map(key => {
                const heat = keyHeat[key]
                const bgColor = heat ? getKeyColor(heat.errorRate, heat.attempts) : 'var(--color-surface-alt)'
                return (
                  <div
                    key={key}
                    className="flex items-center justify-center rounded-md text-xs font-medium border border-[var(--color-border)] transition-colors"
                    style={{
                      width: 36, height: 36,
                      background: bgColor,
                      color: heat && heat.attempts > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    }}
                    title={heat ? `${key}: ${heat.attempts} attempts, ${heat.errors} errors` : key}
                  >
                    {key}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 justify-center text-[9px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: '#bbf7d0' }} /> No errors</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: '#fef08a' }} /> Some errors</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: '#fed7aa' }} /> Many errors</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: '#fca5a5' }} /> Struggle</span>
        </div>
      </div>
    </div>
  )
}
