import { useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { usePreferences } from '@/hooks/usePreferences'
import { parseVocabText, isRTL } from '@/lib/csvParser'
import * as api from '@/services/vocabApi'
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


type Phase = 'input' | 'preview' | 'done'

export function VocabUploader() {
  const { userId, hubAvailable, refreshLists, setActiveTool, setTotalWords, totalWords } = useApp()
  const { prefs } = usePreferences()

  const [phase, setPhase] = useState<Phase>('input')
  const [rawText, setRawText] = useState('')
  const [listName, setListName] = useState('')
  const [langFrom, setLangFrom] = useState(prefs.defaultLangFrom || 'de')
  const [langTo, setLangTo] = useState(prefs.defaultLangTo || 'en')
  const [parsed, setParsed] = useState<WordInput[]>([])
  const [importedIds, setImportedIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiLevel, setAiLevel] = useState('A2')
  const [aiLoading, setAiLoading] = useState(false)

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

  const handleParse = () => {
    if (!rawText.trim()) {
      toast.error('Paste or drop some vocabulary first')
      return
    }
    const words = parseVocabText(rawText, { language_from: langFrom, language_to: langTo })
    if (words.length === 0) {
      toast.error('Could not parse any words. Check the format.')
      return
    }
    setParsed(words)
    setPhase('preview')
    toast.success(`Parsed ${words.length} word${words.length === 1 ? '' : 's'}`)
  }

  const handleImport = async () => {
    if (!listName.trim()) {
      toast.error('Enter a list name')
      return
    }
    setLoading(true)
    try {
      const list = await api.createList(userId, listName.trim(), langFrom, langTo)
      const result = await api.uploadWords(userId, list.id, parsed)
      toast.success(`Imported ${result.added} word${result.added === 1 ? '' : 's'}${result.skipped ? ` (${result.skipped} skipped)` : ''}`)

      // Fetch the word IDs for enrichment
      const words = await api.getWords(userId, { list_id: list.id })
      setImportedIds(words.map(w => w.id))

      refreshLists()
      setTotalWords(totalWords + result.added)
      setPhase('done')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrich = async () => {
    if (importedIds.length === 0) return
    setEnriching(true)
    try {
      const result = await api.enrichWords(importedIds)
      toast.success(`AI enriched ${result.enriched} word${result.enriched === 1 ? '' : 's'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enrichment failed')
    } finally {
      setEnriching(false)
    }
  }

  const handleGoToWordBank = () => {
    setActiveTool('wordbank')
  }

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      toast.error('Enter a topic')
      return
    }
    setAiLoading(true)
    try {
      const words = await api.generateTopicVocab(aiTopic.trim(), langFrom, langTo, aiLevel)
      setParsed(words)
      setPhase('preview')
      toast.success(`Generated ${words.length} word${words.length === 1 ? '' : 's'} for '${aiTopic.trim()}'`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setAiLoading(false)
    }
  }

  const handleReset = () => {
    setPhase('input')
    setRawText('')
    setParsed([])
    setImportedIds([])
    setListName('')
    setAiTopic('')
  }

  const removeWord = (index: number) => {
    setParsed(prev => prev.filter((_, i) => i !== index))
  }

  // --- Render ---

  if (phase === 'done') {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">&#10003;</div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          Import Complete
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-6">
          {importedIds.length} word{importedIds.length === 1 ? '' : 's'} added to <strong>{listName}</strong>
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
              bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {enriching ? 'Enriching...' : 'AI Enrich'}
          </button>
          <button
            onClick={handleGoToWordBank}
            className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
              bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity"
          >
            View Word Bank
          </button>
          <button
            onClick={handleReset}
            className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
              border border-[var(--color-border)] text-[var(--color-text-secondary)]
              bg-[var(--color-surface)] hover:bg-[var(--color-gray-100)] transition-colors"
          >
            Import More
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'preview') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Preview ({parsed.length} word{parsed.length === 1 ? '' : 's'})
          </h2>
          <button
            onClick={() => setPhase('input')}
            className="text-sm text-[var(--color-primary-main)] hover:underline cursor-pointer"
          >
            &larr; Back to input
          </button>
        </div>

        {/* List name input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            List name
          </label>
          <input
            type="text"
            value={listName}
            onChange={e => setListName(e.target.value)}
            placeholder="e.g. German A2 Verbs"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
              bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
          />
        </div>

        {/* Preview table */}
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden mb-4">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-primary-pale)] sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">Lemma</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">Translation</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">POS</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">Gender</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {parsed.map((w, i) => (
                  <tr key={i} className="hover:bg-[var(--color-surface-alt)] transition-colors">
                    <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]"
                      dir={isRTL(langFrom) ? 'rtl' : undefined}>{w.lemma}</td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">{w.translation}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{w.part_of_speech || '--'}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{w.gender || '--'}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeWord(i)}
                        className="text-[var(--color-incorrect)] hover:opacity-70 cursor-pointer text-xs"
                        title="Remove"
                      >
                        &#x2715;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <button
          onClick={handleImport}
          disabled={loading || parsed.length === 0}
          className="px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer
            bg-[var(--color-primary-main)] text-white hover:opacity-90
            disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Importing...' : `Import ${parsed.length} Word${parsed.length === 1 ? '' : 's'}`}
        </button>
      </div>
    )
  }

  // Phase: input
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
        Import Vocabulary
      </h2>

      {/* Language selectors */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Learning
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
            Native
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

      {/* AI Generate section */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-text-muted)]">or generate vocabulary</span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      <div className="flex gap-2 mb-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Topic
          </label>
          <input
            type="text"
            value={aiTopic}
            onChange={e => setAiTopic(e.target.value)}
            placeholder='e.g. "At the restaurant"'
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
              bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
            onKeyDown={e => { if (e.key === 'Enter' && !aiLoading) handleAiGenerate() }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Level
          </label>
          <select
            value={aiLevel}
            onChange={e => setAiLevel(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--color-border)]
              bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] cursor-pointer"
          >
            <option value="A1">A1 — Beginner</option>
            <option value="A2">A2 — Elementary</option>
            <option value="B1">B1 — Intermediate</option>
            <option value="B2">B2 — Upper Intermediate</option>
            <option value="C1">C1 — Advanced</option>
            <option value="C2">C2 — Mastery</option>
          </select>
        </div>
        <button
          onClick={handleAiGenerate}
          disabled={aiLoading || !aiTopic.trim() || !hubAvailable}
          className="px-5 py-2 rounded-lg font-medium text-sm cursor-pointer
            bg-[var(--color-accent)] text-white hover:opacity-90
            disabled:opacity-50 transition-opacity"
        >
          {aiLoading ? 'Generating...' : !hubAvailable ? 'AI Offline' : 'Generate'}
        </button>
      </div>

      {!hubAvailable && (
        <div className="rounded-lg px-3 py-2 text-xs mb-4"
          style={{ background: 'var(--color-accent-faded)', border: '1px solid var(--color-accent-light)', color: 'var(--color-text-secondary)' }}>
          AI vocabulary generation requires a connected backend. You can still import words manually using the text area or file upload below.
        </div>
      )}

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
          Drop a CSV, TSV, or TXT file here
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          or click to browse
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,.text"
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
        placeholder={`word, translation\nHaus, house\nKatze, cat\n\nor freeform:\nHund - dog\nBaum - tree`}
        rows={8}
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
          bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm font-mono
          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
          resize-y mb-4 placeholder:text-[var(--color-text-muted)]"
      />

      <button
        onClick={handleParse}
        disabled={!rawText.trim()}
        className="px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer
          bg-[var(--color-primary-main)] text-white hover:opacity-90
          disabled:opacity-50 transition-opacity"
      >
        Parse
      </button>
    </div>
  )
}
