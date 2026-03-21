import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import * as store from '@/services/mediaStore'
import type { MediaItem, MediaChunk, MediaType } from '@/types/media'
import type { Word } from '@/types/word'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDIA_TYPES: { value: MediaType; label: string; icon: string }[] = [
  { value: 'poem', label: 'Poem', icon: '\u270F\uFE0F' },
  { value: 'song', label: 'Song', icon: '\uD83C\uDFB5' },
  { value: 'skit', label: 'Skit', icon: '\uD83C\uDFAD' },
  { value: 'article', label: 'Article', icon: '\uD83D\uDCF0' },
  { value: 'dialogue', label: 'Dialogue', icon: '\uD83D\uDCAC' },
  { value: 'custom', label: 'Custom', icon: '\uD83D\uDCC4' },
]

type SortKey = 'date' | 'mastery' | 'title'
type ViewMode = 'library' | 'reader'
type PracticeTab = 'read' | 'fillblank' | 'firstletters' | 'memorize' | 'chunk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeWord(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()
}

function tokenize(text: string): string[] {
  return text.split(/(\s+|(?<=[^\s])(?=[^\p{L}\p{N}])|(?<=[^\p{L}\p{N}])(?=\S))/u).filter(Boolean)
}

function isWordToken(t: string): boolean {
  return /[\p{L}\p{N}]/u.test(t)
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

function speakLine(text: string, lang?: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  if (lang) u.lang = lang
  speechSynthesis.speak(u)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: MediaType }) {
  const cfg = MEDIA_TYPES.find(t => t.value === type)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
      {cfg?.icon} {cfg?.label}
    </span>
  )
}

function MasteryBar({ percent }: { percent: number }) {
  const color = percent >= 80 ? 'var(--color-success, #22c55e)' : percent >= 40 ? 'var(--color-warning, #eab308)' : 'var(--color-primary-main)'
  return (
    <div className="w-full h-1.5 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: color }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import Modal
// ---------------------------------------------------------------------------

function ImportModal({ open, onClose, onImport }: {
  open: boolean
  onClose: () => void
  onImport: (item: MediaItem) => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<MediaType>('poem')
  const [content, setContent] = useState('')
  const [translation, setTranslation] = useState('')
  const [showTranslation, setShowTranslation] = useState(false)
  const [detectedDialogue, setDetectedDialogue] = useState(false)

  // Detect dialogue patterns
  useEffect(() => {
    if (content.length > 20) {
      const isDialogue = store.detectDialoguePattern(content)
      setDetectedDialogue(isDialogue)
    } else {
      setDetectedDialogue(false)
    }
  }, [content])

  const handleImport = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required')
      return
    }
    const chunks = store.parseMediaContent(content, type, translation || undefined)
    const item: MediaItem = {
      id: crypto.randomUUID(),
      title: title.trim(),
      type,
      content,
      language: '',
      nativeTranslation: translation || undefined,
      chunks,
      wordIds: [],
      createdAt: new Date().toISOString(),
      masteryPercent: 0,
    }
    store.saveMediaItem(item)
    onImport(item)
    // reset
    setTitle('')
    setContent('')
    setTranslation('')
    setType('poem')
    setShowTranslation(false)
    toast.success('Media imported!')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Add Media</h2>

        {/* Title */}
        <label className="block mb-3">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Title</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Der Erlkoenig, La Bamba..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
          />
        </label>

        {/* Type */}
        <label className="block mb-3">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Type</span>
          <div className="flex flex-wrap gap-2">
            {MEDIA_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  type === t.value
                    ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-main)]'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          {detectedDialogue && type !== 'dialogue' && type !== 'skit' && (
            <p className="mt-1 text-xs text-[var(--color-primary-main)]">
              Detected SPEAKER: patterns.{' '}
              <button className="underline cursor-pointer" onClick={() => setType('dialogue')}>
                Switch to Dialogue?
              </button>
            </p>
          )}
        </label>

        {/* Content */}
        <label className="block mb-3">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Content</span>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste your poem, song lyrics, dialogue, or text here...&#10;&#10;Separate stanzas/paragraphs with blank lines.&#10;For dialogues, use SPEAKER: text format."
            rows={8}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] resize-y font-mono"
          />
        </label>

        {/* Translation toggle */}
        {!showTranslation && (
          <button
            onClick={() => setShowTranslation(true)}
            className="text-xs text-[var(--color-primary-main)] mb-3 cursor-pointer hover:underline"
          >
            + Add parallel translation
          </button>
        )}
        {showTranslation && (
          <label className="block mb-3">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">
              Translation (parallel text)
            </span>
            <textarea
              value={translation}
              onChange={e => setTranslation(e.target.value)}
              placeholder="Paste translation here, matching the same paragraph/line structure..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] resize-y font-mono"
            />
          </label>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-surface)]"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!title.trim() || !content.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-primary-main)] text-white cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Parse &amp; Import
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Library Grid
// ---------------------------------------------------------------------------

function LibraryView({ items, sortKey, setSortKey, filterType, setFilterType, onSelect, onAdd }: {
  items: MediaItem[]
  sortKey: SortKey
  setSortKey: (k: SortKey) => void
  filterType: MediaType | 'all'
  setFilterType: (t: MediaType | 'all') => void
  onSelect: (id: string) => void
  onAdd: () => void
}) {
  const filtered = useMemo(() => {
    let list = filterType === 'all' ? items : items.filter(i => i.type === filterType)
    if (sortKey === 'date') list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    else if (sortKey === 'mastery') list = [...list].sort((a, b) => a.masteryPercent - b.masteryPercent)
    else if (sortKey === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    return list
  }, [items, sortKey, filterType])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Media Library</h1>
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-primary-main)] text-white cursor-pointer hover:opacity-90 flex items-center gap-1.5"
        >
          <span className="text-base">+</span> Add Media
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <span>Filter:</span>
          {[{ value: 'all' as const, label: 'All' }, ...MEDIA_TYPES].map(t => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`px-2 py-1 rounded-md text-xs cursor-pointer border transition-colors ${
                filterType === t.value
                  ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                  : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-main)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto text-xs text-[var(--color-text-muted)]">
          <span>Sort:</span>
          {([['date', 'Recent'], ['mastery', 'Mastery'], ['title', 'A-Z']] as [SortKey, string][]).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-2 py-1 rounded-md text-xs cursor-pointer border transition-colors ${
                sortKey === k
                  ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                  : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">{filterType === 'all' ? '\uD83D\uDCDA' : (MEDIA_TYPES.find(t => t.value === filterType)?.icon ?? '\uD83D\uDCDA')}</div>
          <p className="text-[var(--color-text-secondary)] text-sm mb-1 font-medium">
            {filterType === 'all' ? 'Your library is empty' : `No ${filterType}s yet`}
          </p>
          <p className="text-[var(--color-text-muted)] text-xs mb-4">
            Import poems, songs, dialogues, or any text to practice with.
          </p>
          <button
            onClick={onAdd}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-primary-main)] text-white cursor-pointer hover:opacity-90"
          >
            Add Your First Content
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(item => (
            <motion.button
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onSelect(item.id)}
              className="text-left p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-main)] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm text-[var(--color-text-primary)] line-clamp-1">{item.title}</h3>
                <TypeBadge type={item.type} />
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mb-2 line-clamp-2">
                {item.chunks.length} {item.chunks.length === 1 ? 'section' : 'sections'} &middot; {item.chunks.reduce((n, c) => n + c.lines.length, 0)} lines
              </div>
              <MasteryBar percent={item.masteryPercent} />
              <div className="flex justify-between items-center mt-2 text-[10px] text-[var(--color-text-muted)]">
                <span>{item.masteryPercent}% mastered</span>
                <span>{item.lastPracticed ? relativeDate(item.lastPracticed) : 'Not practiced'}</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vocabulary Extraction Modal
// ---------------------------------------------------------------------------

function VocabExtractModal({ open, onClose, mediaItem, wordBank }: {
  open: boolean
  onClose: () => void
  mediaItem: MediaItem
  wordBank: Map<string, Word>
}) {
  const { userId, hubAvailable, refreshLists } = useApp()
  const [unknownWords, setUnknownWords] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<Array<{ lemma: string; translation: string }>>([])

  useEffect(() => {
    if (!open) return
    // Extract unique words not in the word bank
    const allText = mediaItem.chunks.flatMap(c => c.lines.map(l => l.text)).join(' ')
    const tokens = allText.split(/[\s\p{P}]+/u).filter(t => /[\p{L}]/u.test(t))
    const unique = [...new Set(tokens.map(t => normalizeWord(t)))].filter(w => w.length > 1 && !wordBank.has(w))
    setUnknownWords(unique)
    setSelected(new Set(unique))
    setAnalysisResults([])
  }, [open, mediaItem, wordBank])

  const handleAnalyze = async () => {
    if (!hubAvailable) {
      toast.error('Backend required for translations')
      return
    }
    setAnalyzing(true)
    try {
      const text = unknownWords.join(', ')
      const result = await api.analyzeText(userId, text, mediaItem.language || 'de', 'en', true)
      setAnalysisResults(result.unknown_words.map(w => ({ lemma: w.lemma, translation: w.translation })))
    } catch {
      toast.error('Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAdd = async () => {
    if (!hubAvailable) {
      toast.error('Backend required to add words')
      return
    }
    setAdding(true)
    try {
      const words = [...selected].map(w => {
        const analysis = analysisResults.find(a => a.lemma.toLowerCase() === w)
        return {
          lemma: w,
          translation: analysis?.translation ?? '',
          tags: [mediaItem.title],
        }
      })
      const result = await api.uploadWords(userId, 0, words)
      toast.success(`Added ${result.added} words`)
      // Link word IDs to media item
      const updatedIds = [...(mediaItem.wordIds || [])]
      store.updateMediaItem(mediaItem.id, { wordIds: updatedIds })
      refreshLists()
      onClose()
    } catch {
      toast.error('Failed to add words')
    } finally {
      setAdding(false)
    }
  }

  const toggleWord = (w: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w)
      else next.add(w)
      return next
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5 mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Extract Vocabulary</h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          {unknownWords.length} unknown words found. Select which to add to your word bank.
        </p>

        {analysisResults.length === 0 && hubAvailable && unknownWords.length > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="mb-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:border-[var(--color-primary-main)] disabled:opacity-40"
          >
            {analyzing ? 'Analyzing...' : 'Auto-translate with AI'}
          </button>
        )}

        {unknownWords.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">All words are already in your word bank!</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
            {unknownWords.map(w => {
              const analysis = analysisResults.find(a => a.lemma.toLowerCase() === w)
              return (
                <label key={w} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-surface-alt)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(w)}
                    onChange={() => toggleWord(w)}
                    className="rounded"
                  />
                  <span className="text-sm text-[var(--color-text-primary)] font-medium">{w}</span>
                  {analysis && (
                    <span className="text-xs text-[var(--color-text-muted)] ml-auto">{analysis.translation}</span>
                  )}
                </label>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0 || adding}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary-main)] text-white cursor-pointer disabled:opacity-40"
            >
              {adding ? 'Adding...' : `Add ${selected.size} Words`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Practice Views
// ---------------------------------------------------------------------------

function ReadAlongView({ chunks, language }: { chunks: MediaChunk[]; language: string }) {
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null)
  const allLines = useMemo(() => chunks.flatMap(c => c.lines), [chunks])

  const playAll = useCallback(() => {
    let idx = 0
    const playNext = () => {
      if (idx >= allLines.length) { setActiveLineIdx(null); return }
      setActiveLineIdx(idx)
      const u = new SpeechSynthesisUtterance(allLines[idx].text)
      if (language) u.lang = language
      u.onend = () => { idx++; playNext() }
      speechSynthesis.speak(u)
    }
    speechSynthesis.cancel()
    playNext()
  }, [allLines, language])

  const stop = () => {
    speechSynthesis.cancel()
    setActiveLineIdx(null)
  }

  let lineCounter = 0

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={playAll} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary-main)] text-white cursor-pointer hover:opacity-90">
          Play All
        </button>
        <button onClick={stop} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer">
          Stop
        </button>
      </div>
      <div className="space-y-4">
        {chunks.map(chunk => (
          <div key={chunk.id}>
            <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">{chunk.label}</h4>
            <div className="space-y-1">
              {chunk.lines.map((line, li) => {
                const globalIdx = lineCounter++
                const isActive = globalIdx === activeLineIdx
                return (
                  <div
                    key={li}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--color-primary-main)] text-white'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)]'
                    }`}
                    onClick={() => speakLine(line.text, language)}
                  >
                    {line.speaker && <span className="font-semibold mr-1">{line.speaker}:</span>}
                    {line.text}
                    {line.translation && (
                      <div className={`text-xs mt-0.5 ${isActive ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
                        {line.translation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FillBlankView({ chunks }: { chunks: MediaChunk[] }) {
  const allLines = useMemo(() => chunks.flatMap(c => c.lines), [chunks])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  // Pick ~30% of words to blank out, preferring longer words
  const blanks = useMemo(() => {
    const result: Record<string, { word: string; lineIdx: number; tokenIdx: number }> = {}
    allLines.forEach((line, lineIdx) => {
      const tokens = tokenize(line.text)
      const wordTokens = tokens.map((t, i) => ({ t, i })).filter(({ t }) => isWordToken(t) && t.length > 3)
      const count = Math.max(1, Math.floor(wordTokens.length * 0.3))
      const shuffled = [...wordTokens].sort(() => Math.random() - 0.5).slice(0, count)
      for (const { t, i } of shuffled) {
        const key = `${lineIdx}-${i}`
        result[key] = { word: normalizeWord(t), lineIdx, tokenIdx: i }
      }
    })
    return result
  }, [allLines])

  const checkAnswer = (key: string) => {
    const blank = blanks[key]
    if (!blank) return
    if ((answers[key] || '').toLowerCase().trim() === blank.word) {
      setRevealed(prev => new Set([...prev, key]))
      toast.success('Correct!')
    } else {
      toast.error(`Expected: ${blank.word}`)
    }
  }

  const totalBlanks = Object.keys(blanks).length
  const correct = revealed.size
  const allDone = correct === totalBlanks

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-[var(--color-text-muted)]">{correct}/{totalBlanks} filled</span>
        <MasteryBar percent={totalBlanks > 0 ? (correct / totalBlanks) * 100 : 0} />
      </div>
      <div className="space-y-2">
        {allLines.map((line, lineIdx) => {
          const tokens = tokenize(line.text)
          return (
            <div key={lineIdx} className="text-sm text-[var(--color-text-primary)] leading-relaxed flex flex-wrap items-baseline gap-0">
              {line.speaker && <span className="font-semibold mr-1">{line.speaker}: </span>}
              {tokens.map((token, ti) => {
                const key = `${lineIdx}-${ti}`
                const blank = blanks[key]
                if (!blank) return <span key={ti}>{token}</span>
                if (revealed.has(key)) {
                  return <span key={ti} className="font-semibold text-[var(--color-success, #22c55e)]">{token}</span>
                }
                return (
                  <input
                    key={ti}
                    value={answers[key] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') checkAnswer(key) }}
                    placeholder="___"
                    className="inline-block w-20 px-1 py-0.5 mx-0.5 text-sm text-center border-b-2 border-[var(--color-primary-main)] bg-transparent focus:outline-none text-[var(--color-text-primary)]"
                    style={{ width: `${Math.max(3, blank.word.length + 1)}ch` }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      {allDone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 rounded-lg text-sm font-medium text-center"
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            color: 'var(--color-success, #22c55e)',
            border: '1px solid var(--color-success, #22c55e)',
          }}
        >
          All blanks filled correctly!
        </motion.div>
      )}
    </div>
  )
}

function FirstLettersView({ chunks }: { chunks: MediaChunk[] }) {
  const [showFull, setShowFull] = useState<Set<number>>(new Set())
  const allLines = useMemo(() => chunks.flatMap(c => c.lines), [chunks])

  const toggleLine = (idx: number) => {
    setShowFull(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Only first letters shown. Click a line to reveal the full text. Try to recite from memory.
      </p>
      <div className="space-y-1.5">
        {allLines.map((line, idx) => {
          const full = showFull.has(idx)
          const firstLetters = line.text.split(/\s+/).map(w => {
            if (/[\p{L}]/u.test(w)) return w[0] + '_'.repeat(Math.max(0, w.length - 1))
            return w
          }).join(' ')

          return (
            <div
              key={idx}
              onClick={() => toggleLine(idx)}
              className="px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--color-surface-alt)] border border-transparent hover:border-[var(--color-border)]"
            >
              {line.speaker && <span className="font-semibold text-[var(--color-text-secondary)] mr-1">{line.speaker}:</span>}
              <span className={`font-mono ${full ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-primary-main)]'}`}>
                {full ? line.text : firstLetters}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setShowFull(new Set(allLines.map((_, i) => i)))}
          className="px-3 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer"
        >
          Reveal All
        </button>
        <button
          onClick={() => setShowFull(new Set())}
          className="px-3 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer"
        >
          Hide All
        </button>
      </div>
    </div>
  )
}

function MemorizeView({ chunks, language, onUpdateMastery }: { chunks: MediaChunk[]; language: string; onUpdateMastery: (p: number) => void }) {
  const allLines = useMemo(() => chunks.flatMap(c => c.lines), [chunks])
  const [hiddenCount, setHiddenCount] = useState(0)
  const [rating, setRating] = useState<number | null>(null)

  const visibleLines = allLines.length - hiddenCount
  const progress = allLines.length > 0 ? (hiddenCount / allLines.length) * 100 : 0

  const hideMore = () => {
    setHiddenCount(prev => Math.min(prev + Math.max(1, Math.ceil(allLines.length / 5)), allLines.length))
  }

  const reset = () => { setHiddenCount(0); setRating(null) }

  const handleRate = (r: number) => {
    setRating(r)
    onUpdateMastery(r * 20) // 1-5 => 20-100%
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-[var(--color-text-muted)]">{visibleLines}/{allLines.length} visible</span>
        <MasteryBar percent={progress} />
        <button onClick={hideMore} disabled={hiddenCount >= allLines.length} className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--color-primary-main)] text-white cursor-pointer disabled:opacity-40">
          Hide More
        </button>
        <button onClick={reset} className="px-3 py-1 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer">
          Reset
        </button>
      </div>
      <div className="space-y-1">
        {allLines.map((line, idx) => {
          const hidden = idx >= allLines.length - hiddenCount
          return (
            <div
              key={idx}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${hidden ? 'bg-[var(--color-surface-alt)] text-transparent select-none' : 'text-[var(--color-text-primary)]'}`}
              onClick={() => hidden && speakLine(line.text, language)}
            >
              {line.speaker && <span className="font-semibold mr-1">{line.speaker}:</span>}
              {hidden ? line.text.replace(/./g, '\u2022') : line.text}
            </div>
          )
        })}
      </div>
      {hiddenCount >= allLines.length && rating === null && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">How well could you recite from memory?</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(r => (
              <button
                key={r}
                onClick={() => handleRate(r)}
                className="w-10 h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-sm font-bold text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-primary-main)] hover:text-white hover:border-[var(--color-primary-main)] transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">1 = not at all &middot; 5 = perfect</p>
        </motion.div>
      )}
      {rating !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 rounded-lg text-sm font-medium text-center"
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            color: 'var(--color-success, #22c55e)',
            border: '1px solid var(--color-success, #22c55e)',
          }}
        >
          Rated {rating}/5. Mastery updated!
        </motion.div>
      )}
    </div>
  )
}

function ChunkPracticeView({ chunks, language }: { chunks: MediaChunk[]; language: string }) {
  const [activeChunkIdx, setActiveChunkIdx] = useState(0)
  const [showText, setShowText] = useState(true)
  const chunk = chunks[activeChunkIdx]

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {chunks.map((c, i) => (
          <button
            key={c.id}
            onClick={() => { setActiveChunkIdx(i); setShowText(true) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
              i === activeChunkIdx
                ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {chunk && (
        <div>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setShowText(!showText)}
              className="px-3 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer"
            >
              {showText ? 'Hide Text' : 'Show Text'}
            </button>
            <button
              onClick={() => {
                speechSynthesis.cancel()
                chunk.lines.forEach((line, i) => {
                  const u = new SpeechSynthesisUtterance(line.text)
                  if (language) u.lang = language
                  // Delay each utterance slightly so they queue
                  setTimeout(() => speechSynthesis.speak(u), i * 100)
                })
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary-main)] text-white cursor-pointer"
            >
              Play Chunk
            </button>
          </div>
          <div className="space-y-1">
            {chunk.lines.map((line, li) => (
              <div
                key={li}
                className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-[var(--color-surface-alt)] ${showText ? 'text-[var(--color-text-primary)]' : 'text-transparent select-none bg-[var(--color-surface-alt)]'}`}
                onClick={() => speakLine(line.text, language)}
              >
                {line.speaker && <span className="font-semibold mr-1">{line.speaker}:</span>}
                {showText ? line.text : line.text.replace(/./g, '\u2022')}
                {showText && line.translation && (
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{line.translation}</div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4">
            <button
              onClick={() => { setActiveChunkIdx(Math.max(0, activeChunkIdx - 1)); setShowText(true) }}
              disabled={activeChunkIdx === 0}
              className="px-3 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => { setActiveChunkIdx(Math.min(chunks.length - 1, activeChunkIdx + 1)); setShowText(true) }}
              disabled={activeChunkIdx >= chunks.length - 1}
              className="px-3 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reader View
// ---------------------------------------------------------------------------

function ReaderView({ item, wordBank, onBack, onRefresh }: {
  item: MediaItem
  wordBank: Map<string, Word>
  onBack: () => void
  onRefresh: () => void
}) {
  const [practiceTab, setPracticeTab] = useState<PracticeTab | null>(null)
  const [vocabModalOpen, setVocabModalOpen] = useState(false)
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleWordClick = (token: string, e: React.MouseEvent) => {
    const word = normalizeWord(token)
    if (!word) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    setActiveWord(word)
  }

  const dismissTooltip = () => {
    setActiveWord(null)
    setTooltipPos(null)
  }

  const handleUpdateMastery = (percent: number) => {
    store.updateMediaItem(item.id, {
      masteryPercent: percent,
      lastPracticed: new Date().toISOString(),
    })
    onRefresh()
  }

  const TABS: { key: PracticeTab; label: string; icon: string }[] = [
    { key: 'read', label: 'Read Along', icon: '\uD83D\uDD0A' },
    { key: 'fillblank', label: 'Fill Blank', icon: '\u270F\uFE0F' },
    { key: 'firstletters', label: 'First Letters', icon: '\uD83D\uDD24' },
    { key: 'memorize', label: 'Memorize', icon: '\uD83E\uDDE0' },
    { key: 'chunk', label: 'Chunks', icon: '\uD83E\uDDE9' },
  ]

  const known = wordBank.get(activeWord ?? '')

  return (
    <div ref={containerRef} className="relative" onClick={dismissTooltip}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="px-2 py-1 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-surface)]">
          &larr; Back
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] truncate">{item.title}</h2>
          <div className="flex items-center gap-2">
            <TypeBadge type={item.type} />
            <span className="text-xs text-[var(--color-text-muted)]">{item.chunks.length} sections</span>
          </div>
        </div>
        <button
          onClick={() => setVocabModalOpen(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:border-[var(--color-primary-main)]"
        >
          Extract Vocab
        </button>
      </div>

      {/* Practice tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4 border-b border-[var(--color-border)] pb-3">
        <button
          onClick={() => setPracticeTab(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
            practiceTab === null
              ? 'bg-[var(--color-primary-main)] text-white'
              : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
          }`}
        >
          Read
        </button>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setPracticeTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              practiceTab === tab.key
                ? 'bg-[var(--color-primary-main)] text-white'
                : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        <motion.div key={practiceTab ?? 'reader'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {practiceTab === null && (
            /* Default reader: clickable words */
            <div className="space-y-5">
              {item.chunks.map(chunk => (
                <div key={chunk.id}>
                  <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wide">{chunk.label}</h4>
                  <div className="space-y-1">
                    {chunk.lines.map((line, li) => {
                      const tokens = tokenize(line.text)
                      return (
                        <div key={li} className="text-sm leading-relaxed">
                          {line.speaker && <span className="font-semibold text-[var(--color-text-secondary)] mr-1">{line.speaker}:</span>}
                          {tokens.map((token, ti) => {
                            if (!isWordToken(token)) return <span key={ti}>{token}</span>
                            const norm = normalizeWord(token)
                            const inBank = wordBank.has(norm)
                            return (
                              <span
                                key={ti}
                                onClick={e => { e.stopPropagation(); handleWordClick(token, e) }}
                                className={`cursor-pointer rounded px-0.5 transition-colors ${
                                  inBank
                                    ? 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)]'
                                    : 'text-[var(--color-primary-main)] underline decoration-dotted hover:bg-[var(--color-primary-main)]/10'
                                }`}
                              >
                                {token}
                              </span>
                            )
                          })}
                          {line.translation && (
                            <div className="text-xs text-[var(--color-text-muted)] mt-0.5 ml-1">{line.translation}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {practiceTab === 'read' && <ReadAlongView chunks={item.chunks} language={item.language} />}
          {practiceTab === 'fillblank' && <FillBlankView chunks={item.chunks} />}
          {practiceTab === 'firstletters' && <FirstLettersView chunks={item.chunks} />}
          {practiceTab === 'memorize' && <MemorizeView chunks={item.chunks} language={item.language} onUpdateMastery={handleUpdateMastery} />}
          {practiceTab === 'chunk' && <ChunkPracticeView chunks={item.chunks} language={item.language} />}
        </motion.div>
      </AnimatePresence>

      {/* Word tooltip */}
      {activeWord && tooltipPos && (
        <div
          className="absolute z-40 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-xs max-w-[200px]"
          style={{ left: tooltipPos.x, top: tooltipPos.y + 20 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="font-bold text-sm text-[var(--color-text-primary)] mb-1">{activeWord}</div>
          {known ? (
            <>
              <div className="text-[var(--color-text-secondary)]">{known.translation}</div>
              {known.part_of_speech && <div className="text-[var(--color-text-muted)] italic">{known.part_of_speech}</div>}
              <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">In your word bank</div>
            </>
          ) : (
            <div className="text-[var(--color-text-muted)]">
              Not in your word bank.
              <br />Use "Extract Vocab" to add.
            </div>
          )}
        </div>
      )}

      {/* Delete button at the bottom */}
      <div className="mt-8 pt-4 border-t border-[var(--color-border)]">
        <button
          onClick={() => {
            if (confirm('Delete this media item?')) {
              store.deleteMediaItem(item.id)
              onRefresh()
              onBack()
              toast.success('Deleted')
            }
          }}
          className="px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-opacity hover:opacity-80"
          style={{
            color: 'var(--color-error, #ef4444)',
            border: '1px solid var(--color-error, #ef4444)',
            background: 'rgba(239, 68, 68, 0.06)',
          }}
        >
          Delete Media
        </button>
      </div>

      <VocabExtractModal
        open={vocabModalOpen}
        onClose={() => setVocabModalOpen(false)}
        mediaItem={item}
        wordBank={wordBank}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main MediaLibrary Component
// ---------------------------------------------------------------------------

export function MediaLibrary() {
  const { userId } = useApp()
  const [items, setItems] = useState<MediaItem[]>([])
  const [view, setView] = useState<ViewMode>('library')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [filterType, setFilterType] = useState<MediaType | 'all'>('all')
  const [wordBank, setWordBank] = useState<Map<string, Word>>(new Map())

  // Load items from storage
  const refreshItems = useCallback(() => {
    setItems(store.getMediaItems())
  }, [])

  useEffect(() => {
    refreshItems()
  }, [refreshItems])

  // Load word bank
  useEffect(() => {
    api.getWords(userId, { limit: 5000 })
      .then(words => {
        const map = new Map<string, Word>()
        for (const w of words) map.set(w.lemma.toLowerCase(), w)
        setWordBank(map)
      })
      .catch(() => {}) // offline fallback — empty word bank
  }, [userId])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setView('reader')
  }

  const handleBack = () => {
    setView('library')
    setSelectedId(null)
    refreshItems()
  }

  const handleImport = (_item: MediaItem) => {
    refreshItems()
  }

  const selectedItem = selectedId ? items.find(i => i.id === selectedId) : null

  return (
    <div>
      <AnimatePresence mode="wait">
        {view === 'library' && (
          <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LibraryView
              items={items}
              sortKey={sortKey}
              setSortKey={setSortKey}
              filterType={filterType}
              setFilterType={setFilterType}
              onSelect={handleSelect}
              onAdd={() => setImportOpen(true)}
            />
          </motion.div>
        )}
        {view === 'reader' && selectedItem && (
          <motion.div key="reader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ReaderView
              item={selectedItem}
              wordBank={wordBank}
              onBack={handleBack}
              onRefresh={refreshItems}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </div>
  )
}
