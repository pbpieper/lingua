import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Word } from '@/types/word'

// ─── Types ────────────────────────────────────────────────────────

interface JournalEntry {
  id: string
  date: string
  text: string
  wordCount: number
  knownWords: string[]
  unknownWords: string[]
  cefrEstimate: string
  durationSeconds: number
  language: string
}

// ─── Storage ──────────────────────────────────────────────────────

const STORAGE_KEY = 'lingua-dream-journal'

function loadEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveEntries(entries: JournalEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

// ─── Writing Prompts ──────────────────────────────────────────────

const PROMPTS: Record<string, string[]> = {
  es: [
    'Describe tu dia de hoy.',
    'Escribe sobre tu comida favorita.',
    'Describe a tu mejor amigo o amiga.',
    'Escribe sobre un lugar que quieres visitar.',
    'Describe lo que hiciste ayer.',
    'Escribe sobre tu hobby favorito.',
    'Describe el clima de hoy.',
  ],
  fr: [
    "Decrivez votre journee d'aujourd'hui.",
    'Ecrivez sur votre plat prefere.',
    'Decrivez votre meilleur(e) ami(e).',
    'Ecrivez sur un endroit que vous voulez visiter.',
    'Decrivez ce que vous avez fait hier.',
    'Ecrivez sur votre passe-temps favori.',
    "Decrivez le temps qu'il fait aujourd'hui.",
  ],
  de: [
    'Beschreiben Sie Ihren heutigen Tag.',
    'Schreiben Sie ueber Ihr Lieblingsessen.',
    'Beschreiben Sie Ihren besten Freund.',
    'Schreiben Sie ueber einen Ort, den Sie besuchen moechten.',
    'Beschreiben Sie, was Sie gestern gemacht haben.',
    'Schreiben Sie ueber Ihr Lieblingshobby.',
    'Beschreiben Sie das Wetter heute.',
  ],
  ar: [
    '\u0635\u0641 \u064A\u0648\u0645\u0643 \u0627\u0644\u064A\u0648\u0645.',
    '\u0627\u0643\u062A\u0628 \u0639\u0646 \u0637\u0639\u0627\u0645\u0643 \u0627\u0644\u0645\u0641\u0636\u0644.',
    '\u0635\u0641 \u0635\u062F\u064A\u0642\u0643 \u0627\u0644\u0645\u0642\u0631\u0628.',
    '\u0627\u0643\u062A\u0628 \u0639\u0646 \u0645\u0643\u0627\u0646 \u062A\u0631\u064A\u062F \u0632\u064A\u0627\u0631\u062A\u0647.',
  ],
  ja: [
    '\u4ECA\u65E5\u306E\u4E00\u65E5\u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002',
    '\u597D\u304D\u306A\u98DF\u3079\u7269\u306B\u3064\u3044\u3066\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002',
    '\u89AA\u53CB\u306B\u3064\u3044\u3066\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002',
    '\u884C\u304D\u305F\u3044\u5834\u6240\u306B\u3064\u3044\u3066\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002',
  ],
  ko: [
    '\uC624\uB298 \uD558\uB8E8\uB97C \uC124\uBA85\uD574 \uBCF4\uC138\uC694.',
    '\uC88B\uC544\uD558\uB294 \uC74C\uC2DD\uC5D0 \uB300\uD574 \uC368 \uBCF4\uC138\uC694.',
    '\uAC00\uC7A5 \uCE5C\uD55C \uCE5C\uAD6C\uB97C \uC124\uBA85\uD574 \uBCF4\uC138\uC694.',
    '\uAC00\uBCF4\uACE0 \uC2F6\uC740 \uC7A5\uC18C\uC5D0 \uB300\uD574 \uC368 \uBCF4\uC138\uC694.',
  ],
}

const DEFAULT_PROMPTS = [
  'Describe your day in the target language.',
  'Write about your favorite food.',
  'Describe your best friend.',
  'Write about a place you want to visit.',
  'Describe what you did yesterday.',
  'Write about your favorite hobby.',
  'Describe the weather today.',
]

function getTodayPrompt(lang: string): string {
  const dayIdx = Math.floor(Date.now() / 86400000)
  const pool = PROMPTS[lang] ?? DEFAULT_PROMPTS
  return pool[dayIdx % pool.length]
}

// ─── Text Analysis ────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0)
}

function estimateCEFR(wordCount: number, uniqueRatio: number, avgWordLen: number): string {
  // Rough heuristic based on text complexity
  if (wordCount < 10) return 'A1'
  const score = (wordCount / 20) + (uniqueRatio * 5) + (avgWordLen * 0.5)
  if (score < 3) return 'A1'
  if (score < 5) return 'A2'
  if (score < 8) return 'B1'
  if (score < 12) return 'B2'
  if (score < 16) return 'C1'
  return 'C2'
}

const CEFR_COLORS: Record<string, string> = {
  A1: '#22c55e', A2: '#16a34a',
  B1: '#3b82f6', B2: '#2563eb',
  C1: '#8b5cf6', C2: '#7c3aed',
}

// ─── Component ────────────────────────────────────────────────────

export function DreamJournal() {
  const { userId, activeLanguage } = useApp()
  const [text, setText] = useState('')
  const [entries, setEntries] = useState<JournalEntry[]>(loadEntries)
  const [userWords, setUserWords] = useState<Word[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [startTime] = useState(Date.now())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load user words for comparison
  useEffect(() => {
    api.getWords(userId, { limit: 5000 })
      .then(setUserWords)
      .catch(() => { /* offline mode: no words to compare */ })
  }, [userId])

  const prompt = useMemo(() => getTodayPrompt(activeLanguage), [activeLanguage])

  const knownLemmas = useMemo(() => {
    const set = new Set<string>()
    userWords.forEach(w => set.add(w.lemma.toLowerCase()))
    return set
  }, [userWords])

  const analysis = useMemo(() => {
    const tokens = tokenize(text)
    const wordCount = tokens.length
    const unique = new Set(tokens)
    const uniqueRatio = wordCount > 0 ? unique.size / wordCount : 0
    const avgLen = wordCount > 0 ? tokens.reduce((s, w) => s + w.length, 0) / wordCount : 0

    const known: string[] = []
    const unknown: string[] = []
    unique.forEach(w => {
      if (knownLemmas.has(w)) known.push(w)
      else unknown.push(w)
    })

    return {
      wordCount,
      uniqueWords: unique.size,
      uniqueRatio,
      avgWordLen: avgLen,
      known,
      unknown,
      cefr: estimateCEFR(wordCount, uniqueRatio, avgLen),
    }
  }, [text, knownLemmas])

  const handleSave = useCallback(() => {
    if (text.trim().length < 5) {
      toast.error('Write at least a few words first')
      return
    }
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      text: text.trim(),
      wordCount: analysis.wordCount,
      knownWords: analysis.known,
      unknownWords: analysis.unknown,
      cefrEstimate: analysis.cefr,
      durationSeconds: Math.floor((Date.now() - startTime) / 1000),
      language: activeLanguage,
    }
    const updated = [entry, ...entries].slice(0, 100) // keep last 100 entries
    setEntries(updated)
    saveEntries(updated)
    setShowAnalysis(true)
    toast.success('Journal entry saved!')
  }, [text, analysis, entries, startTime, activeLanguage])

  const handleAddToBank = useCallback((words: string[]) => {
    toast.success(`${words.length} words ready to add. Navigate to Upload to import them.`)
  }, [])

  const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000)

  const todayEntry = entries.find(e => e.date.slice(0, 10) === new Date().toISOString().slice(0, 10))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Dream Journal</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Daily writing practice in your target language</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-light)] transition-colors cursor-pointer"
        >
          {showHistory ? 'Write' : `History (${entries.length})`}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showHistory ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {entries.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3 opacity-40">&#128214;</div>
                <p className="text-sm text-[var(--color-text-muted)]">No entries yet. Start writing!</p>
              </div>
            ) : (
              entries.map(entry => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">
                      {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: CEFR_COLORS[entry.cefrEstimate] + '20', color: CEFR_COLORS[entry.cefrEstimate] }}>
                        {entry.cefrEstimate}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{entry.wordCount} words</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{Math.floor(entry.durationSeconds / 60)}m</span>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3 whitespace-pre-wrap">{entry.text}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-green-600">{entry.knownWords.length} known</span>
                    <span className="text-[10px] text-orange-600">{entry.unknownWords.length} new</span>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Today's Prompt */}
            <div className="rounded-xl border border-[var(--color-primary-light)] bg-[var(--color-primary-pale)] px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">&#128172;</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary-dark)]">Today's Prompt</span>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{prompt}</p>
            </div>

            {/* Editor */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => { setText(e.target.value); setShowAnalysis(false) }}
                placeholder="Start writing here..."
                rows={8}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-y focus:outline-none focus:border-[var(--color-primary-main)] transition-colors"
                style={{ minHeight: 180 }}
                autoFocus
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                <span>{analysis.wordCount} words</span>
                <span>{elapsedMinutes}m</span>
              </div>
            </div>

            {/* Live Stats Bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                <span className="text-[10px] text-[var(--color-text-muted)]">Words:</span>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">{analysis.wordCount}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                <span className="text-[10px] text-[var(--color-text-muted)]">Unique:</span>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">{analysis.uniqueWords}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                <span className="text-[10px] text-[var(--color-text-muted)]">CEFR:</span>
                <span className="text-xs font-bold" style={{ color: CEFR_COLORS[analysis.cefr] }}>{analysis.cefr}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                <span className="text-[10px] text-green-600">Known:</span>
                <span className="text-xs font-bold text-green-700 dark:text-green-300">{analysis.known.length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40">
                <span className="text-[10px] text-orange-600">New:</span>
                <span className="text-xs font-bold text-orange-700 dark:text-orange-300">{analysis.unknown.length}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={analysis.wordCount < 3}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary-main)] text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors border-none"
              >
                Save Entry
              </button>
              {todayEntry && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  You already wrote today ({todayEntry.wordCount} words)
                </span>
              )}
            </div>

            {/* Analysis Panel */}
            <AnimatePresence>
              {showAnalysis && analysis.wordCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
                >
                  <div className="p-4 space-y-4">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Writing Analysis</h3>

                    {/* Known Words */}
                    {analysis.known.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-2">
                          Words from your bank ({analysis.known.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.known.map(w => (
                            <span key={w} className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              {w}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unknown Words */}
                    {analysis.unknown.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                            New words ({analysis.unknown.length})
                          </p>
                          <button
                            onClick={() => handleAddToBank(analysis.unknown)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 cursor-pointer border-none transition-colors"
                          >
                            + Add to Word Bank
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.unknown.slice(0, 30).map(w => (
                            <span key={w} className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                              {w}
                            </span>
                          ))}
                          {analysis.unknown.length > 30 && (
                            <span className="px-2 py-0.5 text-xs text-[var(--color-text-muted)]">+{analysis.unknown.length - 30} more</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CEFR Estimate */}
                    <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-border)]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--color-text-muted)]">Estimated level:</span>
                        <span className="text-sm font-bold px-2.5 py-0.5 rounded-full" style={{ background: CEFR_COLORS[analysis.cefr] + '20', color: CEFR_COLORS[analysis.cefr] }}>
                          {analysis.cefr}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        Based on vocabulary diversity and complexity
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
