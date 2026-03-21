import { useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { usePreferences } from '@/hooks/usePreferences'
import { isRTL } from '@/lib/csvParser'
import * as api from '@/services/vocabApi'
import type { TextAnalysis } from '@/services/vocabApi'
import type { WordInput } from '@/types/word'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'zh', label: 'Chinese' },
]

type Phase = 'input' | 'analysis' | 'done'

interface UnknownWord {
  lemma: string
  translation: string
  part_of_speech?: string
  gender?: string
  selected: boolean
}

function ComprehensionBadge({ estimate }: { estimate: number }) {
  const pct = Math.round(estimate * 100)
  let color: string
  let label: string

  if (pct < 50) {
    color = 'var(--color-incorrect)'
    label = "You'll struggle with this text"
  } else if (pct < 75) {
    color = 'var(--color-accent)'
    label = "You'll understand the gist"
  } else if (pct < 90) {
    color = 'var(--color-correct)'
    label = 'Good comprehension expected'
  } else {
    color = 'var(--color-primary-main)'
    label = "You're ready for this text!"
  }

  return (
    <div className="text-center py-6">
      <div
        className="text-5xl font-bold mb-2"
        style={{ color }}
      >
        {pct}%
      </div>
      <p className="text-sm font-medium" style={{ color }}>
        {label}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">
        Estimated comprehension
      </p>
    </div>
  )
}

export function PreLearnPipeline() {
  const { userId, hubAvailable, refreshLists, setActiveTool, setCurrentListId } = useApp()
  const { prefs } = usePreferences()

  const [phase, setPhase] = useState<Phase>('input')
  const [rawText, setRawText] = useState('')
  const [langFrom, setLangFrom] = useState(prefs.defaultLangFrom || 'de')
  const [langTo, setLangTo] = useState(prefs.defaultLangTo || 'en')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<TextAnalysis | null>(null)
  const [unknownWords, setUnknownWords] = useState<UnknownWord[]>([])
  const [listName, setListName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdListId, setCreatedListId] = useState<number | null>(null)
  const [createdCount, setCreatedCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') {
        setRawText(text)
        toast.success(`Loaded ${file.name}`)
      }
    }
    reader.onerror = () => toast.error('Failed to read file')
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleAnalyze = async () => {
    if (!rawText.trim()) {
      toast.error('Paste or drop some text first')
      return
    }
    setAnalyzing(true)
    try {
      const result = await api.analyzeText(userId, rawText, langFrom, langTo)
      setAnalysis(result)
      setUnknownWords(
        result.unknown_words.map(w => ({ ...w, selected: true }))
      )
      setPhase('analysis')
      toast.success(`Found ${result.unknown_count} unknown word${result.unknown_count === 1 ? '' : 's'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Text analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleWord = (index: number) => {
    setUnknownWords(prev =>
      prev.map((w, i) => i === index ? { ...w, selected: !w.selected } : w)
    )
  }

  const toggleAll = () => {
    const allSelected = unknownWords.every(w => w.selected)
    setUnknownWords(prev => prev.map(w => ({ ...w, selected: !allSelected })))
  }

  const selectedCount = unknownWords.filter(w => w.selected).length

  const handleCreateStudySet = async () => {
    if (!listName.trim()) {
      toast.error('Enter a list name')
      return
    }
    const selected = unknownWords.filter(w => w.selected)
    if (selected.length === 0) {
      toast.error('Select at least one word')
      return
    }
    setCreating(true)
    try {
      const list = await api.createList(userId, listName.trim(), langFrom, langTo, 'Pre-learn study set')
      const words: WordInput[] = selected.map(w => ({
        lemma: w.lemma,
        translation: w.translation,
        part_of_speech: w.part_of_speech,
        gender: w.gender,
        language_from: langFrom,
        language_to: langTo,
      }))
      const result = await api.uploadWords(userId, list.id, words)
      setCreatedListId(list.id)
      setCreatedCount(result.added)
      refreshLists()
      setPhase('done')
      toast.success(`Study set created with ${result.added} word${result.added === 1 ? '' : 's'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create study set')
    } finally {
      setCreating(false)
    }
  }

  const handleStartFlashcards = () => {
    if (createdListId) setCurrentListId(createdListId)
    setActiveTool('flashcards')
  }

  const handleGoToWordBank = () => {
    if (createdListId) setCurrentListId(createdListId)
    setActiveTool('wordbank')
  }

  const handleReset = () => {
    setPhase('input')
    setRawText('')
    setAnalysis(null)
    setUnknownWords([])
    setListName('')
    setCreatedListId(null)
    setCreatedCount(0)
  }

  // --- Phase: Done ---
  if (phase === 'done') {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">&#10003;</div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          Study Set Created
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-6">
          {createdCount} word{createdCount === 1 ? '' : 's'} added to <strong>{listName}</strong>
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={handleStartFlashcards}
            className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
              bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity"
          >
            Start Flashcards
          </button>
          <button
            onClick={handleGoToWordBank}
            className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
              bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          >
            Study Later
          </button>
          <button
            onClick={() => {
              // Pass original text to Reading Assist via localStorage
              localStorage.setItem('lingua-reading-text', rawText)
              setActiveTool('reading')
            }}
            className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
              border border-[var(--color-primary-main)] text-[var(--color-primary-main)]
              bg-[var(--color-primary-faded)] hover:opacity-90 transition-opacity"
          >
            Read Original Text
          </button>
          <button
            onClick={handleReset}
            className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
              border border-[var(--color-border)] text-[var(--color-text-secondary)]
              bg-[var(--color-surface)] hover:bg-[var(--color-gray-100)] transition-colors"
          >
            Analyze Another Text
          </button>
        </div>
      </div>
    )
  }

  // --- Phase: Analysis Results ---
  if (phase === 'analysis' && analysis) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Text Analysis
          </h2>
          <button
            onClick={() => setPhase('input')}
            className="text-sm text-[var(--color-primary-main)] hover:underline cursor-pointer"
          >
            &larr; Back to input
          </button>
        </div>

        {/* Comprehension estimate */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] mb-4">
          <ComprehensionBadge estimate={analysis.comprehension_estimate} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Words', value: analysis.total_words },
            { label: 'Unique Words', value: analysis.unique_words },
            { label: 'Known', value: analysis.known_count },
            { label: 'Unknown', value: analysis.unknown_count },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-center"
            >
              <div className="text-lg font-bold text-[var(--color-text-primary)]">
                {stat.value}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Unknown words list */}
        {unknownWords.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
                Unknown Words ({selectedCount} of {unknownWords.length} selected)
              </h3>
              <button
                onClick={toggleAll}
                className="text-xs text-[var(--color-primary-main)] hover:underline cursor-pointer"
              >
                {unknownWords.every(w => w.selected) ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] overflow-hidden mb-4">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-primary-pale)] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8"></th>
                      <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">Lemma</th>
                      <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">Translation</th>
                      <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">POS</th>
                      <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">Gender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {unknownWords.map((w, i) => (
                      <tr
                        key={i}
                        onClick={() => toggleWord(i)}
                        className={`cursor-pointer transition-colors ${
                          w.selected
                            ? 'hover:bg-[var(--color-surface-alt)]'
                            : 'opacity-50 hover:opacity-70'
                        }`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={w.selected}
                            onChange={() => toggleWord(i)}
                            className="accent-[var(--color-primary-main)] cursor-pointer"
                          />
                        </td>
                        <td
                          className="px-3 py-2 font-medium text-[var(--color-text-primary)]"
                          dir={isRTL(langFrom) ? 'rtl' : undefined}
                        >
                          {w.lemma}
                        </td>
                        <td className="px-3 py-2 text-[var(--color-text-secondary)]">{w.translation}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{w.part_of_speech || '--'}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{w.gender || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {unknownWords.length === 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center mb-4">
            <p className="text-[var(--color-text-secondary)]">
              No unknown words found -- you're ready to read this text!
            </p>
          </div>
        )}

        {/* Create study set */}
        {unknownWords.length > 0 && (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Study set name
              </label>
              <input
                type="text"
                value={listName}
                onChange={e => setListName(e.target.value)}
                placeholder="e.g. News Article Vocab"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
              />
            </div>
            <button
              onClick={handleCreateStudySet}
              disabled={creating || selectedCount === 0}
              className="px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer whitespace-nowrap
                bg-[var(--color-primary-main)] text-white hover:opacity-90
                disabled:opacity-50 transition-opacity"
            >
              {creating ? 'Creating...' : `Create Study Set (${selectedCount})`}
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- Phase: Input ---
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        Pre-Learn Pipeline
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Paste a text to discover unknown words and create a study set before reading.
      </p>

      {!hubAvailable && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4"
          style={{ background: 'var(--color-accent-faded)', border: '1px solid var(--color-accent-light)', color: 'var(--color-text-secondary)' }}>
          <strong>AI required:</strong> Text analysis needs a connected AI backend.
          You can set one up in Settings, or use the Vocab Uploader to add words manually.
        </div>
      )}

      {/* Language selectors */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Text language
          </label>
          <select
            value={langFrom}
            onChange={e => setLangFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
              bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] cursor-pointer"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-2 text-[var(--color-text-muted)]">&rarr;</div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Translate to
          </label>
          <select
            value={langTo}
            onChange={e => setLangTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
              bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] cursor-pointer"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          rounded-lg border-2 border-dashed p-8 text-center cursor-pointer
          transition-colors mb-4
          ${dragOver
            ? 'border-[var(--color-primary-main)] bg-[var(--color-primary-pale)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] hover:border-[var(--color-primary-light)]'
          }
        `}
      >
        <div className="text-3xl mb-2 text-[var(--color-text-muted)]">&#128196;</div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-1">
          Drop a .txt file here
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          or click to browse
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.text"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-text-muted)]">or paste text</span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      {/* Text area */}
      <textarea
        value={rawText}
        onChange={e => setRawText(e.target.value)}
        placeholder="Paste article, story, or any text you want to read..."
        rows={10}
        dir={isRTL(langFrom) ? 'rtl' : undefined}
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
          bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
          resize-y mb-4 placeholder:text-[var(--color-text-muted)]"
      />

      <button
        onClick={handleAnalyze}
        disabled={!rawText.trim() || analyzing || !hubAvailable}
        className="px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer
          bg-[var(--color-primary-main)] text-white hover:opacity-90
          disabled:opacity-50 transition-opacity"
      >
        {analyzing ? 'Analyzing...' : !hubAvailable ? 'Connect AI to Analyze' : 'Analyze Text'}
      </button>
    </div>
  )
}
