import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Word } from '@/types/word'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocType = 'lease' | 'email' | 'menu' | 'instructions' | 'letter' | 'medical' | 'other'

interface DocTypeOption {
  value: DocType
  label: string
  icon: string
  keywords: string[]
}

const DOC_TYPES: DocTypeOption[] = [
  { value: 'lease', label: 'Lease / Rental', icon: '\uD83C\uDFE0', keywords: ['tenant', 'landlord', 'rent', 'deposit', 'lease', 'property'] },
  { value: 'email', label: 'Email / Letter', icon: '\u2709\uFE0F', keywords: ['dear', 'sincerely', 'regards', 'subject', 'hi', 'hello'] },
  { value: 'menu', label: 'Menu / Food', icon: '\uD83C\uDF7D\uFE0F', keywords: ['appetizer', 'dessert', 'drink', 'entree', 'salad', 'soup'] },
  { value: 'instructions', label: 'Instructions', icon: '\uD83D\uDCCB', keywords: ['step', 'warning', 'caution', 'assemble', 'install', 'press'] },
  { value: 'letter', label: 'Official Letter', icon: '\uD83D\uDCE8', keywords: ['hereby', 'notice', 'regarding', 'please', 'office', 'department'] },
  { value: 'medical', label: 'Medical', icon: '\uD83C\uDFE5', keywords: ['patient', 'dose', 'medication', 'symptom', 'treatment', 'doctor'] },
  { value: 'other', label: 'Other', icon: '\uD83D\uDCC4', keywords: [] },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(w: string): string {
  return w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()
}

function detectDocType(text: string): DocType {
  const lower = text.toLowerCase()
  let bestType: DocType = 'other'
  let bestScore = 0

  for (const dt of DOC_TYPES) {
    if (dt.value === 'other') continue
    const score = dt.keywords.filter(kw => lower.includes(kw)).length
    if (score > bestScore) {
      bestScore = score
      bestType = dt.value
    }
  }
  return bestType
}

function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5)
}

function extractKeyPhrases(text: string): string[] {
  const sentences = extractSentences(text)
  // Heuristic: longer sentences with important keywords are "key phrases"
  const importantWords = ['must', 'should', 'required', 'important', 'please', 'note', 'warning',
    'deadline', 'pay', 'sign', 'agree', 'contact', 'emergency', 'immediately', 'attention']

  return sentences
    .map(s => ({ sentence: s, score: importantWords.filter(w => s.toLowerCase().includes(w)).length + (s.length > 80 ? 1 : 0) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.sentence)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentReader() {
  const { userId, hubAvailable } = useApp()

  const [inputText, setInputText] = useState('')
  const [isReading, setIsReading] = useState(false)
  const [docType, setDocType] = useState<DocType>('other')
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set())
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [wordTranslation, setWordTranslation] = useState<string>('')
  const [allWords, setAllWords] = useState<Word[]>([])

  // Load known words
  useEffect(() => {
    if (!hubAvailable) return
    api.getWords(userId, { limit: 5000 }).then(words => {
      setAllWords(words)
      const known = new Set<string>()
      words.forEach(w => {
        known.add(w.lemma.toLowerCase())
        known.add(w.translation.toLowerCase())
      })
      setKnownWords(known)
    }).catch(() => {})
  }, [userId, hubAvailable])

  const startReading = useCallback(() => {
    if (!inputText.trim()) return
    const detected = detectDocType(inputText)
    setDocType(detected)
    setIsReading(true)
    setSelectedWord(null)
  }, [inputText])

  // Tokenize text into renderable segments
  const segments = useMemo(() => {
    if (!inputText.trim()) return []
    return inputText.split(/(\s+)/).map((segment, i) => {
      const cleaned = normalize(segment)
      const isWord = /[\p{L}]/u.test(segment)
      const isUnknown = isWord && cleaned.length > 1 && !knownWords.has(cleaned)
      return { id: i, raw: segment, cleaned, isWord, isUnknown }
    })
  }, [inputText, knownWords])

  // Key phrases
  const keyPhrases = useMemo(() => extractKeyPhrases(inputText), [inputText])

  // Stats
  const totalWords = segments.filter(s => s.isWord).length
  const unknownWords = segments.filter(s => s.isUnknown)
  const unknownCount = unknownWords.length
  const knownPct = totalWords > 0 ? Math.round(((totalWords - unknownCount) / totalWords) * 100) : 0

  const handleWordClick = useCallback((word: string) => {
    const cleaned = normalize(word)
    setSelectedWord(cleaned)
    // Look up translation from known words
    const match = allWords.find(w => w.lemma.toLowerCase() === cleaned)
    setWordTranslation(match?.translation || '')
  }, [allWords])

  const docTypeInfo = DOC_TYPES.find(d => d.value === docType)

  if (!isReading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <span className="text-2xl">\uD83D\uDCC4</span> Document Reader
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Paste real-world documents and learn the vocabulary you need
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Paste your document
          </label>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            rows={10}
            placeholder="Paste a lease agreement, email, restaurant menu, medical form, official letter, instructions, or any real-world document..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
          />

          {inputText.trim() && (
            <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
              <span>{totalWords} words</span>
              <span className="text-green-500">{knownPct}% known</span>
              <span className="text-orange-500">{unknownCount} to learn</span>
            </div>
          )}

          <button
            onClick={startReading}
            disabled={!inputText.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer bg-[var(--color-primary-main)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            Analyze Document
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsReading(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
          >
            &larr; Back
          </button>
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              {docTypeInfo?.icon} {docTypeInfo?.label || 'Document'}
            </h2>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
          <div className="text-lg font-bold text-[var(--color-text-primary)]">{totalWords}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Total Words</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
          <div className="text-lg font-bold text-green-500">{knownPct}%</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Known</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
          <div className="text-lg font-bold text-orange-500">{unknownCount}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">To Learn</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main document display */}
        <div className="md:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Document Text
          </h3>
          <div className="text-sm leading-relaxed text-[var(--color-text-primary)]">
            {segments.map(seg => {
              if (!seg.isWord) return <span key={seg.id}>{seg.raw}</span>
              const isSelected = selectedWord === seg.cleaned
              return (
                <span
                  key={seg.id}
                  onClick={() => seg.isWord && handleWordClick(seg.raw)}
                  className={`cursor-pointer rounded transition-colors ${
                    isSelected
                      ? 'bg-[var(--color-primary-main)] text-white px-0.5'
                      : seg.isUnknown
                        ? 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25 px-0.5 rounded'
                        : 'hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  {seg.raw}
                </span>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected word popup */}
          <AnimatePresence>
            {selectedWord && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-[var(--color-primary-main)] bg-[var(--color-surface)] p-4"
              >
                <div className="text-xs font-semibold text-[var(--color-primary-main)] mb-1">Selected Word</div>
                <div className="text-xl font-bold text-[var(--color-text-primary)]">{selectedWord}</div>
                {wordTranslation && (
                  <div className="text-sm text-[var(--color-text-secondary)] mt-1">{wordTranslation}</div>
                )}
                {!wordTranslation && (
                  <div className="text-xs text-orange-500 mt-1">Not in your word bank yet</div>
                )}
                <button
                  onClick={() => {
                    if ('speechSynthesis' in window) {
                      speechSynthesis.cancel()
                      const u = new SpeechSynthesisUtterance(selectedWord)
                      u.rate = 0.8
                      speechSynthesis.speak(u)
                    }
                  }}
                  className="mt-2 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]"
                >
                  &#x1F50A; Listen
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Key phrases */}
          {keyPhrases.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                &#x26A0;\uFE0F Key Phrases
              </h3>
              <div className="space-y-2">
                {keyPhrases.map((phrase, i) => (
                  <div key={i} className="text-xs text-[var(--color-text-secondary)] p-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                    {phrase}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unknown words list */}
          {unknownWords.length > 0 && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
              <h3 className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-3">
                Words to Learn ({unknownCount})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set(unknownWords.map(w => w.cleaned))).slice(0, 30).map(w => (
                  <button
                    key={w}
                    onClick={() => handleWordClick(w)}
                    className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer border transition-colors ${
                      selectedWord === w
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
