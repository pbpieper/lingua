import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Word, VocabList } from '@/types/word'
import { isRTL } from '@/lib/csvParser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip punctuation from edges and lowercase for lookup. */
function normalizeWord(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()
}

/** Split text into tokens preserving whitespace and punctuation as separate entries. */
function tokenize(text: string): string[] {
  // Split on word boundaries, keeping every piece (words, spaces, punctuation)
  return text.split(/(\s+|(?<=[^\s])(?=[^\p{L}\p{N}])|(?<=[^\p{L}\p{N}])(?=\S))/u).filter(Boolean)
}

/** Check if a token is a "word" (has at least one letter/number). */
function isWordToken(token: string): boolean {
  return /[\p{L}\p{N}]/u.test(token)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReadingAssist() {
  const { userId, lists, refreshLists } = useApp()

  const [preloadedText] = useState(() => {
    const text = localStorage.getItem('lingua-reading-text')
    if (text) localStorage.removeItem('lingua-reading-text')
    return text
  })
  const [inputText, setInputText] = useState(preloadedText || '')
  const [analyzedText, setAnalyzedText] = useState<string | null>(preloadedText)
  const [wordBank, setWordBank] = useState<Map<string, Word>>(new Map())
  const [loading, setLoading] = useState(false)
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load word bank on mount
  useEffect(() => {
    api.getWords(userId, { limit: 5000 })
      .then(words => {
        const map = new Map<string, Word>()
        for (const w of words) {
          map.set(w.lemma.toLowerCase(), w)
        }
        setWordBank(map)
      })
      .catch(() => toast.error('Failed to load word bank'))
  }, [userId])

  // Tokenized text
  const tokens = useMemo(() => {
    if (!analyzedText) return []
    return tokenize(analyzedText)
  }, [analyzedText])

  // Detect if the analyzed text is RTL by checking the first letter characters
  const textIsRTL = useMemo(() => {
    if (!analyzedText) return false
    // Check first 200 chars for RTL Unicode ranges (Arabic, Hebrew, Farsi, Urdu)
    const sample = analyzedText.slice(0, 200)
    const rtlChars = (sample.match(/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length
    const latinChars = (sample.match(/[a-zA-Z]/g) || []).length
    return rtlChars > latinChars
  }, [analyzedText])

  // Stats
  const stats = useMemo(() => {
    const wordTokens = tokens.filter(isWordToken)
    const uniqueWords = new Set(wordTokens.map(normalizeWord))
    let known = 0
    for (const w of uniqueWords) {
      if (wordBank.has(w)) known++
    }
    return {
      total: wordTokens.length,
      unique: uniqueWords.size,
      known,
      unknown: uniqueWords.size - known,
      pct: uniqueWords.size > 0 ? Math.round((known / uniqueWords.size) * 100) : 0,
    }
  }, [tokens, wordBank])

  const handleAnalyze = () => {
    if (!inputText.trim()) {
      toast.error('Paste some text first')
      return
    }
    setAnalyzedText(inputText.trim())
    setActiveToken(null)
    setTooltipPos(null)
  }

  const handleBack = () => {
    setAnalyzedText(null)
    setActiveToken(null)
    setTooltipPos(null)
  }

  const handleWordClick = useCallback((token: string, e: React.MouseEvent) => {
    const normalized = normalizeWord(token)
    if (!normalized) return

    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    setActiveToken(prev => (prev === normalized ? null : normalized))
    setTooltipPos({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
    })
  }, [])

  const handleAddToBank = useCallback(async (lemma: string, listId: number) => {
    setLoading(true)
    try {
      const result = await api.uploadWords(userId, listId, [{
        lemma,
        translation: '',
        language_from: '',
        language_to: '',
      }])
      if (result.added > 0) {
        setWordBank(prev => {
          const next = new Map(prev)
          next.set(lemma.toLowerCase(), {
            id: 0,
            user_id: userId,
            list_id: listId,
            lemma,
            translation: '',
            language_from: '',
            language_to: '',
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
          })
          return next
        })
        toast.success(`Added "${lemma}" to word bank`)
        setActiveToken(null)
      } else {
        toast.error('Word already exists or could not be added')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add word')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // --- Input view ---
  if (!analyzedText) {
    return (
      <div>
        <h2
          className="text-lg font-semibold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Reading Assist
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Paste text in your target language. Words from your word bank will be highlighted,
          and you can look up or add unknown words.
        </p>

        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Paste or type text in your target language here..."
          rows={12}
          className="w-full px-4 py-3 rounded-lg text-sm leading-relaxed
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
            resize-y mb-4 placeholder:text-[var(--color-text-muted)]"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          dir="auto"
        />

        <button
          onClick={handleAnalyze}
          disabled={!inputText.trim()}
          className="px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer
            text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Analyze
        </button>
      </div>
    )
  }

  // --- Analyzed view ---
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-lg font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Reading Assist
        </h2>
        <button
          onClick={handleBack}
          className="text-sm cursor-pointer hover:underline"
          style={{ color: 'var(--color-primary-main)' }}
        >
          &larr; New text
        </button>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-4 rounded-lg px-4 py-2.5 mb-4 text-sm"
        style={{
          background: 'var(--color-primary-pale)',
          border: '1px solid var(--color-primary-faded)',
        }}
      >
        <span style={{ color: 'var(--color-primary-main)' }}>
          <strong>{stats.known}</strong> of <strong>{stats.unique}</strong> unique words known
          ({stats.pct}%)
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {stats.total} total words
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {stats.unknown} unknown
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded"
            style={{ background: 'var(--color-primary-faded)' }}
          />
          Known word
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded"
            style={{ background: 'var(--color-accent-light)', border: '1px dashed var(--color-accent-mid)' }}
          />
          Unknown word
        </span>
        <span>Click any word for details</span>
      </div>

      {/* Rendered text */}
      <div
        ref={containerRef}
        className="relative rounded-lg px-5 py-4 leading-[2] text-base"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          minHeight: 200,
        }}
        dir={textIsRTL ? 'rtl' : undefined}
      >
        {tokens.map((token, i) => {
          if (!isWordToken(token)) {
            // Whitespace or punctuation -- render as-is
            return <span key={i}>{token}</span>
          }

          const normalized = normalizeWord(token)
          const isKnown = wordBank.has(normalized)
          const isActive = activeToken === normalized

          return (
            <span
              key={i}
              onClick={e => handleWordClick(token, e)}
              className="cursor-pointer rounded px-0.5 transition-colors"
              style={{
                background: isActive
                  ? 'var(--color-primary-bright)'
                  : isKnown
                    ? 'var(--color-primary-faded)'
                    : 'var(--color-accent-light)',
                borderBottom: isKnown ? 'none' : '2px dashed var(--color-accent-mid)',
                color: 'var(--color-text-primary)',
              }}
            >
              {token}
            </span>
          )
        })}

        {/* Tooltip */}
        {activeToken && tooltipPos && (
          <WordTooltip
            normalized={activeToken}
            wordBank={wordBank}
            position={tooltipPos}
            onAdd={handleAddToBank}
            onClose={() => { setActiveToken(null); setTooltipPos(null) }}
            loading={loading}
            lists={lists}
            userId={userId}
            onListCreated={refreshLists}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface WordTooltipProps {
  normalized: string
  wordBank: Map<string, Word>
  position: { x: number; y: number }
  onAdd: (lemma: string, listId: number) => void
  onClose: () => void
  loading: boolean
  lists: VocabList[]
  userId: string
  onListCreated: () => void
}

function WordTooltip({ normalized, wordBank, position, onAdd, onClose, loading, lists, userId, onListCreated }: WordTooltipProps) {
  const word = wordBank.get(normalized) ?? null
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [showListPicker, setShowListPicker] = useState(false)
  const [creatingList, setCreatingList] = useState(false)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid immediately closing from the triggering click
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClick)
    }
  }, [onClose])

  const handleAddClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (lists.length === 0) {
      // Auto-create a "Reading Imports" list
      setCreatingList(true)
      try {
        const newList = await api.createList(userId, 'Reading Imports', 'en', 'de', 'Words added from Reading Assist')
        onListCreated()
        onAdd(normalized, newList.id)
      } catch {
        toast.error('Failed to create default list')
      } finally {
        setCreatingList(false)
      }
    } else if (lists.length === 1) {
      // Only one list -- use it directly
      onAdd(normalized, lists[0].id)
    } else {
      // Multiple lists -- show picker
      setShowListPicker(true)
    }
  }

  const handlePickList = (e: React.MouseEvent, listId: number) => {
    e.stopPropagation()
    setShowListPicker(false)
    onAdd(normalized, listId)
  }

  return (
    <div
      ref={tooltipRef}
      className="absolute z-10 rounded-lg px-4 py-3 text-sm"
      style={{
        left: position.x,
        top: position.y - 8,
        transform: 'translate(-50%, -100%)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        minWidth: 200,
      }}
    >
      {/* Arrow */}
      <div
        className="absolute"
        style={{
          left: '50%',
          bottom: -6,
          transform: 'translateX(-50%) rotate(45deg)',
          width: 12,
          height: 12,
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
        }}
      />

      {word ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }} dir={isRTL(word.language_from) ? 'rtl' : undefined}>
              {word.lemma}
            </span>
            {word.part_of_speech && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: 'var(--color-primary-faded)',
                  color: 'var(--color-primary-main)',
                }}
              >
                {word.part_of_speech}
              </span>
            )}
            {word.gender && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                ({word.gender})
              </span>
            )}
          </div>
          <p style={{ color: 'var(--color-text-secondary)' }} dir={isRTL(word.language_to) ? 'rtl' : undefined}>
            {word.translation || 'No translation yet'}
          </p>
          {word.pronunciation && (
            <p className="text-xs italic mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {word.pronunciation}
            </p>
          )}
          {word.example_sentence && (
            <p className="text-xs italic mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
              &ldquo;{word.example_sentence}&rdquo;
            </p>
          )}
        </>
      ) : (
        <>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {normalized}
          </p>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Unknown word -- not in your word bank
          </p>
          {showListPicker ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Add to list:
              </p>
              <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                {lists.map(l => (
                  <button
                    key={l.id}
                    onClick={e => handlePickList(e, l.id)}
                    disabled={loading}
                    className="w-full text-left px-2 py-1 rounded text-xs cursor-pointer
                      hover:opacity-80 disabled:opacity-50 transition-opacity truncate"
                    style={{
                      background: 'var(--color-primary-faded)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {l.name} ({l.word_count})
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={handleAddClick}
              disabled={loading || creatingList}
              className="w-full px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--color-accent)' }}
            >
              {loading || creatingList ? 'Adding...' : 'Add to Word Bank'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
