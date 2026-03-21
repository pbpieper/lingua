import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { usePreferences } from '@/hooks/usePreferences'
import { parseVocabText } from '@/lib/csvParser'
import * as api from '@/services/vocabApi'
import type { Word, WordInput } from '@/types/word'
import type { LinguaToolId } from '@/types/tools'
import { isRTL } from '@/lib/csvParser'

// --- Constants ---

type SortKey = 'lemma' | 'created_at' | 'next_review' | 'exposure_count' | 'cefr_level' | 'tags'
type SortDir = 'asc' | 'desc'
type MasteryFilter = 'all' | 'new' | 'learning' | 'mastered'

const PREDEFINED_TAGS = [
  'Animals', 'Food', 'Travel', 'Business', 'Family', 'Home',
  'School', 'Nature', 'Technology', 'Health', 'Sports', 'Culture',
  'Emotions', 'Colors', 'Numbers', 'Time', 'Weather', 'Clothing',
  'Body', 'Transportation',
] as const

const TAG_COLORS: Record<string, string> = {
  Animals: '#f97316',
  Food: '#ef4444',
  Travel: '#3b82f6',
  Business: '#6366f1',
  Family: '#ec4899',
  Home: '#a855f7',
  School: '#14b8a6',
  Nature: '#22c55e',
  Technology: '#64748b',
  Health: '#f43f5e',
  Sports: '#eab308',
  Culture: '#d946ef',
  Emotions: '#f59e0b',
  Colors: '#8b5cf6',
  Numbers: '#06b6d4',
  Time: '#0ea5e9',
  Weather: '#38bdf8',
  Clothing: '#fb923c',
  Body: '#e879f9',
  Transportation: '#4ade80',
}

function getTagColor(tag: string): string {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag]
  // Deterministic color for custom tags
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 60%, 50%)`
}

function getTagBg(tag: string): string {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag] + '18'
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 60%, 95%)`
}

const STUDY_TOOLS: { id: LinguaToolId; label: string; icon: string }[] = [
  { id: 'flashcards', label: 'Flashcards', icon: '\u{1F0CF}' },
  { id: 'match', label: 'Match Game', icon: '\u{1F517}' },
  { id: 'fillblank', label: 'Fill-in-Blank', icon: '\u270F\uFE0F' },
  { id: 'multichoice', label: 'Quiz', icon: '\u2753' },
  { id: 'cloze', label: 'Cloze', icon: '\u{1F4DD}' },
]

// --- Export helpers ---

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCSV(words: Word[]) {
  const header = 'lemma,translation,part_of_speech,gender,pronunciation,example_sentence,tags'
  const rows = words.map(w =>
    [w.lemma, w.translation, w.part_of_speech || '', w.gender || '', w.pronunciation || '',
     w.example_sentence || '', (w.tags || []).join(';')]
      .map(v => `"${(v || '').replace(/"/g, '""')}"`)
      .join(',')
  )
  const csv = [header, ...rows].join('\n')
  downloadFile(csv, 'lingua-vocab.csv', 'text/csv')
  toast.success(`Exported ${words.length} words as CSV`)
}

function exportAnki(words: Word[]) {
  const rows = words.map(w => {
    const front = w.lemma
    const back = [
      w.translation,
      w.part_of_speech ? `(${w.part_of_speech})` : '',
      w.gender ? `[${w.gender}]` : '',
      w.example_sentence ? `<br><i>${w.example_sentence}</i>` : '',
    ].filter(Boolean).join(' ')
    return `${front}\t${back}`
  })
  const tsv = rows.join('\n')
  downloadFile(tsv, 'lingua-anki.txt', 'text/tab-separated-values')
  toast.success(`Exported ${words.length} words for Anki`)
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom<T>(arr: T[], n: number): T[] {
  return shuffleArr(arr).slice(0, n)
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function generateQuizHTML(words: Word[], listName: string): string {
  const matchWords = pickRandom(words, Math.min(10, words.length))
  const fillWords = pickRandom(words, Math.min(5, words.length))
  const transWords = pickRandom(words, Math.min(10, words.length))
  const shuffledTranslations = shuffleArr(matchWords.map(w => w.translation))

  const matchRows = matchWords.map((w, i) =>
    `<tr>
      <td style="padding:6px 16px 6px 0;font-size:15px;">${i + 1}. ${escHtml(w.lemma)}</td>
      <td style="padding:6px 0;width:80px;"></td>
      <td style="padding:6px 0 6px 16px;font-size:15px;">${String.fromCharCode(65 + i)}. ${escHtml(shuffledTranslations[i])}</td>
    </tr>`
  ).join('')

  const fillRows = fillWords.map((w, i) => {
    const sentence = w.example_sentence
      ? escHtml(w.example_sentence).replace(new RegExp(escHtml(w.lemma), 'gi'), '___________')
      : `The ___________ means &quot;${escHtml(w.translation)}&quot;.`
    return `<p style="margin:8px 0;font-size:15px;">${i + 1}. ${sentence}</p>`
  }).join('')

  const transRows = transWords.map((w, i) =>
    `<tr>
      <td style="padding:6px 16px 6px 0;font-size:15px;">${i + 1}. ${escHtml(w.lemma)}</td>
      <td style="padding:6px 0;font-size:15px;border-bottom:1px dotted #999;width:60%;">&nbsp;</td>
    </tr>`
  ).join('')

  const matchAnswers = matchWords.map((w, i) => {
    const letterIndex = shuffledTranslations.indexOf(w.translation)
    return `${i + 1}. ${escHtml(w.lemma)} = ${String.fromCharCode(65 + letterIndex)}. ${escHtml(w.translation)}`
  }).join('<br>')
  const fillAnswers = fillWords.map((w, i) =>
    `${i + 1}. ${escHtml(w.lemma)}`
  ).join('<br>')
  const transAnswers = transWords.map((w, i) =>
    `${i + 1}. ${escHtml(w.lemma)} = ${escHtml(w.translation)}`
  ).join('<br>')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Vocabulary Quiz: ${escHtml(listName)}</title>
<style>
  @media print {
    body { font-family: Georgia, serif; color: #000; margin: 0.75in; }
    .answer-key { page-break-before: always; }
  }
  @media screen {
    body { font-family: Georgia, serif; color: #222; max-width: 750px; margin: 40px auto; padding: 0 24px; }
    .answer-key { border-top: 2px solid #ccc; margin-top: 48px; padding-top: 24px; }
  }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 17px; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; }
  .name-line { font-size: 14px; margin-top: 8px; }
</style>
</head>
<body>
<h1>Vocabulary Quiz: ${escHtml(listName)}</h1>
<p class="name-line">Name: _________________________________ &nbsp;&nbsp; Date: _________________</p>

<h2>Section A: Matching</h2>
<p style="font-size:13px;color:#666;">Draw a line from each word on the left to its correct translation on the right.</p>
<table>${matchRows}</table>

<h2>Section B: Fill in the Blank</h2>
<p style="font-size:13px;color:#666;">Fill in the blank with the correct word.</p>
${fillRows}

<h2>Section C: Translation</h2>
<p style="font-size:13px;color:#666;">Write the translation for each word.</p>
<table>${transRows}</table>

<div class="answer-key">
<h2>Answer Key</h2>
<p style="font-size:13px;"><strong>Section A:</strong><br>${matchAnswers}</p>
<p style="font-size:13px;"><strong>Section B:</strong><br>${fillAnswers}</p>
<p style="font-size:13px;"><strong>Section C:</strong><br>${transAnswers}</p>
</div>
</body>
</html>`
}

function openQuiz(words: Word[], listName: string) {
  const html = generateQuizHTML(words, listName)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  toast.success('Quiz opened in new tab')
}

function computeListAccuracy(words: Word[]): 'green' | 'orange' | 'red' | 'gray' {
  const reviewed = words.filter(w => w.exposure_count > 0)
  if (reviewed.length === 0) return 'gray'
  const known = reviewed.filter(w => w.ease_factor > 2.5).length
  const ratio = known / words.length
  if (ratio > 0.8) return 'green'
  if (ratio >= 0.5) return 'orange'
  return 'red'
}

const ACCURACY_COLORS: Record<string, string> = {
  green: '#22c55e',
  orange: '#f59e0b',
  red: '#ef4444',
  gray: '#9ca3af',
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  target.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function getMasteryLevel(word: Word): 'new' | 'learning' | 'mastered' {
  if (word.exposure_count === 0) return 'new'
  if (word.ease_factor > 2.5 && word.interval_days >= 7) return 'mastered'
  return 'learning'
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// --- Upload Modal ---

type UploadMode = 'manual' | 'paste' | 'ai'

function AddWordsModal({
  open,
  onClose,
  userId,
  listId,
  onWordsAdded,
  langFrom,
  langTo,
}: {
  open: boolean
  onClose: () => void
  userId: string
  listId: number | null
  onWordsAdded: () => void
  langFrom: string
  langTo: string
}) {
  const [mode, setMode] = useState<UploadMode>('manual')
  const [loading, setLoading] = useState(false)

  // Manual fields
  const [manualLemma, setManualLemma] = useState('')
  const [manualTranslation, setManualTranslation] = useState('')
  const [manualPos, setManualPos] = useState('')
  const [manualTags, setManualTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')

  // Paste
  const [pasteText, setPasteText] = useState('')

  // AI
  const [aiTopic, setAiTopic] = useState('')
  const [aiLevel, setAiLevel] = useState('A2')
  const [aiCount, setAiCount] = useState(15)

  if (!open) return null

  const handleManualAdd = async () => {
    if (!manualLemma.trim() || !manualTranslation.trim()) {
      toast.error('Enter word and translation')
      return
    }
    if (!listId) {
      toast.error('Select a list first')
      return
    }
    setLoading(true)
    try {
      const wordInput: WordInput = {
        lemma: manualLemma.trim(),
        translation: manualTranslation.trim(),
        language_from: langFrom,
        language_to: langTo,
        part_of_speech: manualPos || undefined,
        tags: manualTags.length > 0 ? manualTags : undefined,
      }
      await api.uploadWords(userId, listId, [wordInput])
      toast.success(`Added "${manualLemma.trim()}"`)
      setManualLemma('')
      setManualTranslation('')
      setManualPos('')
      setManualTags([])
      onWordsAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add word')
    } finally {
      setLoading(false)
    }
  }

  const handlePasteImport = async () => {
    if (!pasteText.trim()) {
      toast.error('Paste some vocabulary')
      return
    }
    if (!listId) {
      toast.error('Select a list first')
      return
    }
    setLoading(true)
    try {
      const words = parseVocabText(pasteText, { language_from: langFrom, language_to: langTo })
      if (words.length === 0) {
        toast.error('Could not parse any words')
        setLoading(false)
        return
      }
      const result = await api.uploadWords(userId, listId, words)
      toast.success(`Added ${result.added} word${result.added === 1 ? '' : 's'}${result.skipped ? ` (${result.skipped} skipped)` : ''}`)
      setPasteText('')
      onWordsAdded()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      toast.error('Enter a topic')
      return
    }
    if (!listId) {
      toast.error('Select a list first')
      return
    }
    setLoading(true)
    try {
      const words = await api.generateTopicVocab(aiTopic.trim(), langFrom, langTo, aiLevel, aiCount)
      const result = await api.uploadWords(userId, listId, words)
      toast.success(`Generated & added ${result.added} word${result.added === 1 ? '' : 's'}`)
      setAiTopic('')
      onWordsAdded()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const toggleManualTag = (tag: string) => {
    setManualTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const addCustomTag = () => {
    const tag = customTagInput.trim()
    if (tag && !manualTags.includes(tag)) {
      setManualTags(prev => [...prev, tag])
      setCustomTagInput('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[var(--color-border)] w-full max-w-lg max-h-[80vh] overflow-y-auto mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Add Words</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer text-lg">&#10005;</button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {([['manual', 'Type Words'], ['paste', 'Paste / CSV'], ['ai', 'AI Generate']] as [UploadMode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors
                ${mode === m
                  ? 'text-[var(--color-primary-main)] border-b-2 border-[var(--color-primary-main)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {!listId && (
            <div className="text-sm text-[var(--color-incorrect)] bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              Select a list first to add words
            </div>
          )}

          {mode === 'manual' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Word</label>
                  <input
                    type="text"
                    value={manualLemma}
                    onChange={e => setManualLemma(e.target.value)}
                    placeholder="e.g. Hund"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                      bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
                    onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Translation</label>
                  <input
                    type="text"
                    value={manualTranslation}
                    onChange={e => setManualTranslation(e.target.value)}
                    placeholder="e.g. dog"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                      bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
                    onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Part of Speech (optional)</label>
                <select
                  value={manualPos}
                  onChange={e => setManualPos(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                    bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
                >
                  <option value="">--</option>
                  <option value="noun">Noun</option>
                  <option value="verb">Verb</option>
                  <option value="adjective">Adjective</option>
                  <option value="adverb">Adverb</option>
                  <option value="preposition">Preposition</option>
                  <option value="conjunction">Conjunction</option>
                  <option value="pronoun">Pronoun</option>
                  <option value="interjection">Interjection</option>
                </select>
              </div>
              {/* Tag selector */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PREDEFINED_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleManualTag(tag)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all
                        ${manualTags.includes(tag) ? 'ring-2 ring-offset-1 ring-[var(--color-primary-main)]' : 'opacity-70 hover:opacity-100'}`}
                      style={{
                        background: getTagBg(tag),
                        color: getTagColor(tag),
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={e => setCustomTagInput(e.target.value)}
                    placeholder="Custom tag..."
                    className="flex-1 px-2 py-1 rounded border border-[var(--color-border)]
                      bg-[var(--color-surface)] text-[var(--color-text-primary)] text-xs
                      focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-main)]"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    className="px-2 py-1 rounded text-xs font-medium cursor-pointer
                      border border-[var(--color-border)] text-[var(--color-text-secondary)]
                      hover:bg-[var(--color-surface-alt)]"
                  >
                    Add
                  </button>
                </div>
                {manualTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {manualTags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1"
                        style={{ background: getTagBg(tag), color: getTagColor(tag) }}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setManualTags(prev => prev.filter(t => t !== tag))}
                          className="hover:opacity-70 cursor-pointer"
                        >
                          &#10005;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleManualAdd}
                disabled={loading || !listId}
                className="w-full px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer
                  bg-[var(--color-primary-main)] text-white hover:opacity-95 transition-opacity
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Word'}
              </button>
            </>
          )}

          {mode === 'paste' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                  Paste vocabulary (one per line: word, translation)
                </label>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="Hund, dog&#10;Katze, cat&#10;Haus, house"
                  rows={8}
                  className="w-full px-2.5 py-2 rounded-lg border border-[var(--color-border)]
                    bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
                    placeholder:text-[var(--color-text-muted)] resize-y"
                />
              </div>
              <button
                onClick={handlePasteImport}
                disabled={loading || !listId}
                className="w-full px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer
                  bg-[var(--color-primary-main)] text-white hover:opacity-95 transition-opacity
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Importing...' : 'Import Words'}
              </button>
            </>
          )}

          {mode === 'ai' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Topic</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder="e.g. cooking, airport, emotions..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                    bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Level</label>
                  <select
                    value={aiLevel}
                    onChange={e => setAiLevel(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                      bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm cursor-pointer
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
                  >
                    {CEFR_ORDER.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Count</label>
                  <input
                    type="number"
                    value={aiCount}
                    onChange={e => setAiCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                    min={1}
                    max={50}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                      bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]"
                  />
                </div>
              </div>
              <button
                onClick={handleAiGenerate}
                disabled={loading || !listId}
                className="w-full px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer
                  bg-[var(--color-primary-main)] text-white hover:opacity-95 transition-opacity
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : 'Generate & Add'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Study Tool Picker Modal ---

function StudyToolPicker({
  open,
  wordCount,
  onPick,
  onClose,
}: {
  open: boolean
  wordCount: number
  onPick: (toolId: LinguaToolId) => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[var(--color-border)] w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Study {wordCount} words</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Pick a study tool</p>
        </div>
        <div className="p-3 space-y-1">
          {STUDY_TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => onPick(tool.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium cursor-pointer
                text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] transition-colors text-left"
            >
              <span className="text-lg">{tool.icon}</span>
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
              border border-[var(--color-border)] text-[var(--color-text-secondary)]
              hover:bg-[var(--color-surface-alt)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Move-to-List Modal ---

function MoveToListModal({
  open,
  onClose,
  wordIds,
  lists,
  currentListId,
  userId,
  onMoved,
}: {
  open: boolean
  onClose: () => void
  wordIds: number[]
  lists: { id: number; name: string }[]
  currentListId: number | null
  userId: string
  onMoved: () => void
}) {
  const [moving, setMoving] = useState(false)

  if (!open) return null

  const otherLists = lists.filter(l => l.id !== currentListId)

  const handleMove = async (targetListId: number) => {
    setMoving(true)
    try {
      await Promise.all(wordIds.map(id => api.updateWord(id, { } as Record<string, unknown>)))
      // The API doesn't have a direct move endpoint, so we need to re-upload to new list
      // For now we'll update words one at a time via a workaround
      // We need to fetch words, then re-upload them to the new list
      const wordsData = await Promise.all(wordIds.map(id => api.getWord(id)))
      for (const w of wordsData) {
        // Delete from current list and re-add to target
        await api.deleteWord(w.id)
        await api.uploadWords(userId, targetListId, [{
          lemma: w.lemma,
          translation: w.translation,
          language_from: w.language_from,
          language_to: w.language_to,
          part_of_speech: w.part_of_speech || undefined,
          gender: w.gender || undefined,
          pronunciation: w.pronunciation || undefined,
          example_sentence: w.example_sentence || undefined,
          example_translation: w.example_translation || undefined,
          tags: w.tags.length > 0 ? w.tags : undefined,
          cefr_level: w.cefr_level || undefined,
        }])
      }
      toast.success(`Moved ${wordIds.length} word${wordIds.length === 1 ? '' : 's'}`)
      onMoved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Move failed')
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[var(--color-border)] w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            Move {wordIds.length} word{wordIds.length === 1 ? '' : 's'} to...
          </h3>
        </div>
        <div className="p-3 space-y-1 max-h-[40vh] overflow-y-auto">
          {otherLists.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">No other lists available</p>
          ) : (
            otherLists.map(list => (
              <button
                key={list.id}
                onClick={() => handleMove(list.id)}
                disabled={moving}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium cursor-pointer
                  text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] transition-colors text-left
                  disabled:opacity-50"
              >
                {list.name}
              </button>
            ))
          )}
        </div>
        <div className="p-3 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
              border border-[var(--color-border)] text-[var(--color-text-secondary)]
              hover:bg-[var(--color-surface-alt)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---

export function WordBank() {
  const { userId, lists, currentListId, setCurrentListId, refreshLists, setActiveStudyWords, setActiveTool } = useApp()
  const { prefs } = usePreferences()

  const [words, setWords] = useState<Word[]>([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkEnriching, setBulkEnriching] = useState(false)

  // Deadline state
  const [deadlineInput, setDeadlineInput] = useState('')
  const [editingDeadlineListId, setEditingDeadlineListId] = useState<number | null>(null)

  // Per-list accuracy cache: list_id -> color
  const [listAccuracies, setListAccuracies] = useState<Record<number, 'green' | 'orange' | 'red' | 'gray'>>({})

  // New feature states
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [studyPickerOpen, setStudyPickerOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)

  // Filtering
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>('all')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const tagFilterRef = useRef<HTMLDivElement>(null)

  // Compute accuracy for all lists on mount
  useEffect(() => {
    async function loadAccuracies() {
      const acc: Record<number, 'green' | 'orange' | 'red' | 'gray'> = {}
      for (const list of lists) {
        try {
          const listWords = await api.getWords(userId, { list_id: list.id })
          acc[list.id] = computeListAccuracy(listWords)
        } catch {
          acc[list.id] = 'gray'
        }
      }
      setListAccuracies(acc)
    }
    if (lists.length > 0) loadAccuracies()
  }, [lists, userId])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
      if (tagFilterRef.current && !tagFilterRef.current.contains(e.target as Node)) {
        setTagFilterOpen(false)
      }
    }
    if (exportOpen || tagFilterOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [exportOpen, tagFilterOpen])

  // Editing state for expanded word
  const [editExample, setEditExample] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editPronunciation, setEditPronunciation] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchWords = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getWords(userId, {
        list_id: currentListId ?? undefined,
        search: search || undefined,
        tag: tagFilter || undefined,
      })
      setWords(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load words')
    } finally {
      setLoading(false)
    }
  }, [userId, currentListId, search, tagFilter])

  useEffect(() => {
    fetchWords()
  }, [fetchWords])

  // Debounced search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Filter then sort
  const filtered = words.filter(w => {
    if (masteryFilter !== 'all') {
      const mastery = getMasteryLevel(w)
      if (mastery !== masteryFilter) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortKey) {
      case 'lemma':
        return dir * a.lemma.localeCompare(b.lemma)
      case 'created_at':
        return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      case 'next_review': {
        const aDate = a.next_review ? new Date(a.next_review).getTime() : Infinity
        const bDate = b.next_review ? new Date(b.next_review).getTime() : Infinity
        return dir * (aDate - bDate)
      }
      case 'exposure_count':
        return dir * (a.exposure_count - b.exposure_count)
      case 'cefr_level': {
        const aIdx = CEFR_ORDER.indexOf(a.cefr_level || '')
        const bIdx = CEFR_ORDER.indexOf(b.cefr_level || '')
        return dir * ((aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx))
      }
      case 'tags': {
        const aTags = (a.tags || []).join(',')
        const bTags = (b.tags || []).join(',')
        return dir * aTags.localeCompare(bTags)
      }
      default:
        return 0
    }
  })

  // Collect all unique tags from current word set
  const allTags = Array.from(new Set(words.flatMap(w => w.tags || []))).sort()

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'lemma' ? 'asc' : 'desc')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC'
  }

  const handleExpand = (word: Word) => {
    if (expandedId === word.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(word.id)
    setEditExample(word.example_sentence || '')
    setEditTags(word.tags.join(', '))
    setEditPronunciation(word.pronunciation || '')
    setDeleteConfirm(null)
  }

  const handleSave = async (wordId: number) => {
    setSaving(true)
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
      await api.updateWord(wordId, {
        example_sentence: editExample || undefined,
        pronunciation: editPronunciation || undefined,
        tags: tags.length > 0 ? tags : undefined,
      })
      toast.success('Word updated')
      fetchWords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (wordId: number) => {
    try {
      await api.deleteWord(wordId)
      toast.success('Word deleted')
      setExpandedId(null)
      setDeleteConfirm(null)
      fetchWords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--'
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // --- Multi-select helpers ---

  const toggleSelected = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sorted.map(w => w.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected word${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      await Promise.all(Array.from(selectedIds).map(id => api.deleteWord(id)))
      toast.success(`Deleted ${selectedIds.size} word${selectedIds.size === 1 ? '' : 's'}`)
      setSelectedIds(new Set())
      fetchWords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleBulkEnrich = async () => {
    setBulkEnriching(true)
    try {
      const result = await api.enrichWords(Array.from(selectedIds))
      toast.success(`Enriched ${result.enriched} word${result.enriched === 1 ? '' : 's'}`)
      setSelectedIds(new Set())
      fetchWords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enrich failed')
    } finally {
      setBulkEnriching(false)
    }
  }

  const handleStudySelected = () => {
    const picked = sorted.filter(w => selectedIds.has(w.id))
    if (picked.length < 2) {
      toast.error('Select at least 2 words for practice')
      return
    }
    setStudyPickerOpen(true)
  }

  const handlePickStudyTool = (toolId: LinguaToolId) => {
    const picked = sorted.filter(w => selectedIds.has(w.id))
    setActiveStudyWords(picked, {
      label: `${picked.length} selected words`,
      source: 'custom',
    })
    setStudyPickerOpen(false)
    setActiveTool(toolId)
  }

  const handleWordsAdded = () => {
    fetchWords()
    refreshLists()
  }

  const langFrom = prefs.defaultLangFrom || 'de'
  const langTo = prefs.defaultLangTo || 'en'

  // --- Render ---

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Word Bank
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer shrink-0
              bg-[var(--color-primary-main)] text-white hover:opacity-95 transition-opacity"
          >
            + Add Words
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('upload')}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer shrink-0
              border border-[var(--color-border)] text-[var(--color-text-secondary)]
              hover:bg-[var(--color-surface-alt)] transition-colors"
          >
            Full Upload
          </button>
        </div>
      </div>

      {/* Controls row 1: search + list + export */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search words..."
          className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)]
            bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
            placeholder:text-[var(--color-text-muted)]"
        />
        <select
          value={currentListId ?? ''}
          onChange={e => setCurrentListId(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)]
            bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] cursor-pointer"
        >
          <option value="">All lists</option>
          {lists.map(l => {
            const acc = listAccuracies[l.id]
            const accLabel = acc === 'green' ? '[OK]' : acc === 'orange' ? '[~]' : acc === 'red' ? '[!]' : ''
            return (
              <option key={l.id} value={l.id}>
                {accLabel ? `${accLabel} ` : ''}{l.name} ({l.word_count})
              </option>
            )
          })}
        </select>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            disabled={sorted.length === 0}
            className="px-3 py-2 rounded-lg border border-[var(--color-border)]
              bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
              hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export
          </button>
          {exportOpen && sorted.length > 0 && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-[var(--color-surface)]
              border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden min-w-[160px]">
              <button
                onClick={() => { exportCSV(sorted); setExportOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text-primary)]
                  hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
              >
                Export as CSV
              </button>
              <button
                onClick={() => { exportAnki(sorted); setExportOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text-primary)]
                  hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer
                  border-t border-[var(--color-border)]"
              >
                Export for Anki
              </button>
              <button
                onClick={() => {
                  const listName = lists.find(l => l.id === currentListId)?.name ?? 'Vocabulary'
                  openQuiz(sorted, listName)
                  setExportOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text-primary)]
                  hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer
                  border-t border-[var(--color-border)]"
              >
                Generate Quiz
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls row 2: filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Mastery filter */}
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          {(['all', 'new', 'learning', 'mastered'] as MasteryFilter[]).map(level => (
            <button
              key={level}
              onClick={() => setMasteryFilter(level)}
              className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors capitalize
                ${masteryFilter === level
                  ? 'bg-[var(--color-primary-main)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]'
                }
                ${level !== 'all' ? 'border-l border-[var(--color-border)]' : ''}`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Tag filter dropdown */}
        <div className="relative" ref={tagFilterRef}>
          <button
            onClick={() => setTagFilterOpen(!tagFilterOpen)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors
              ${tagFilter
                ? 'border-[var(--color-primary-main)] bg-[var(--color-primary-faded)] text-[var(--color-primary-main)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]'
              }`}
          >
            {tagFilter ? `Tag: ${tagFilter}` : 'Filter by tag'}
            {tagFilter && (
              <span
                onClick={e => { e.stopPropagation(); setTagFilter(''); setTagFilterOpen(false) }}
                className="ml-1.5 hover:opacity-70"
              >
                &#10005;
              </span>
            )}
          </button>
          {tagFilterOpen && (
            <div className="absolute left-0 top-full mt-1 z-10 bg-[var(--color-surface)]
              border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden
              max-h-[250px] overflow-y-auto min-w-[180px]">
              <button
                onClick={() => { setTagFilter(''); setTagFilterOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs cursor-pointer transition-colors
                  ${!tagFilter ? 'bg-[var(--color-primary-faded)] text-[var(--color-primary-main)] font-medium' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]'}`}
              >
                All tags
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => { setTagFilter(tag); setTagFilterOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs cursor-pointer transition-colors border-t border-[var(--color-border)]
                    ${tagFilter === tag ? 'bg-[var(--color-primary-faded)] font-medium' : 'hover:bg-[var(--color-surface-alt)]'}`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ background: getTagColor(tag) }}
                  />
                  <span style={{ color: tagFilter === tag ? 'var(--color-primary-main)' : 'var(--color-text-secondary)' }}>
                    {tag}
                  </span>
                </button>
              ))}
              {allTags.length === 0 && (
                <p className="px-3 py-4 text-xs text-[var(--color-text-muted)] text-center">No tags found</p>
              )}
            </div>
          )}
        </div>

        {/* Sort selector */}
        <select
          value={`${sortKey}:${sortDir}`}
          onChange={e => {
            const [k, d] = e.target.value.split(':') as [SortKey, SortDir]
            setSortKey(k)
            setSortDir(d)
          }}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)]
            bg-[var(--color-surface)] text-[var(--color-text-secondary)] text-xs cursor-pointer
            focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-main)]"
        >
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="lemma:asc">A-Z</option>
          <option value="lemma:desc">Z-A</option>
          <option value="exposure_count:desc">Most reviewed</option>
          <option value="exposure_count:asc">Least reviewed</option>
          <option value="next_review:asc">Due soonest</option>
          <option value="cefr_level:asc">CEFR level</option>
          <option value="tags:asc">Category A-Z</option>
        </select>

        {/* Custom study */}
        {sorted.length > 0 && (
          <button
            onClick={handleStudySelected}
            disabled={selectedIds.size < 2}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors
              ${selectedIds.size >= 2
                ? 'bg-[var(--color-accent-faded)] border border-[var(--color-accent-light)] text-[var(--color-accent-dark)] hover:opacity-90'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50 cursor-not-allowed'
              }`}
            title={selectedIds.size < 2 ? 'Select at least 2 words' : `Study ${selectedIds.size} selected words`}
          >
            Custom Study ({selectedIds.size})
          </button>
        )}
      </div>

      {/* List cards with accuracy + deadline + word count */}
      {lists.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {lists.map(list => {
            const acc = listAccuracies[list.id] || 'gray'
            const dl = list.deadline
            const days = dl ? daysUntil(dl) : null
            const isEditing = editingDeadlineListId === list.id
            const isActive = currentListId === list.id

            return (
              <div
                key={list.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors"
                style={{
                  borderColor: isActive ? 'var(--color-primary-main)' : 'var(--color-border)',
                  background: isActive ? 'var(--color-primary-faded)' : 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                }}
                onClick={() => setCurrentListId(isActive ? null : list.id)}
              >
                {/* Accuracy dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  title={`Accuracy: ${acc}`}
                  style={{ background: ACCURACY_COLORS[acc] }}
                />

                <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {list.name}
                </span>

                {/* Word count */}
                <span className="text-[var(--color-text-muted)]">
                  ({list.word_count})
                </span>

                {/* Deadline display */}
                {dl && !isEditing && (
                  <span
                    className="font-medium"
                    style={{ color: days !== null && days < 0 ? '#ef4444' : days !== null && days <= 3 ? '#f59e0b' : 'var(--color-text-muted)' }}
                  >
                    {days !== null && days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
                  </span>
                )}

                {/* Add to this list action */}
                {isActive && (
                  <button
                    onClick={e => { e.stopPropagation(); setAddModalOpen(true) }}
                    className="ml-1 px-1.5 py-0.5 rounded text-xs cursor-pointer
                      text-[var(--color-primary-main)] hover:bg-[var(--color-primary-faded)]
                      border border-[var(--color-primary-main)] transition-colors"
                    title="Add words to this list"
                  >
                    +
                  </button>
                )}

                {/* Deadline editing */}
                {isEditing ? (
                  <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <input
                      type="date"
                      value={deadlineInput}
                      onChange={e => setDeadlineInput(e.target.value)}
                      className="px-1.5 py-0.5 rounded border border-[var(--color-border)]
                        bg-[var(--color-surface)] text-[var(--color-text-primary)] text-xs
                        focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-main)]"
                    />
                    <button
                      onClick={async () => {
                        try {
                          await api.updateListDeadline(list.id, deadlineInput || null)
                          refreshLists()
                          toast.success(deadlineInput ? 'Deadline set' : 'Deadline cleared')
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Failed to set deadline')
                        }
                        setEditingDeadlineListId(null)
                      }}
                      className="px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer
                        bg-[var(--color-primary-main)] text-white"
                    >
                      Save
                    </button>
                    {dl && (
                      <button
                        onClick={async () => {
                          try {
                            await api.updateListDeadline(list.id, null)
                            refreshLists()
                            toast.success('Deadline cleared')
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Failed to clear deadline')
                          }
                          setEditingDeadlineListId(null)
                        }}
                        className="px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer
                          text-[var(--color-incorrect)] border border-[var(--color-incorrect)]"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => setEditingDeadlineListId(null)}
                      className="px-1.5 py-0.5 rounded text-xs cursor-pointer
                        text-[var(--color-text-muted)]"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setEditingDeadlineListId(list.id)
                      setDeadlineInput(list.deadline || '')
                    }}
                    className="px-1.5 py-0.5 rounded text-xs cursor-pointer
                      text-[var(--color-text-muted)] hover:text-[var(--color-primary-main)]
                      border border-[var(--color-border)] hover:border-[var(--color-primary-main)]
                      transition-colors"
                    title="Set exam deadline"
                  >
                    {dl ? 'Edit deadline' : 'Set deadline'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
          Loading...
        </div>
      )}

      {/* Empty state */}
      {!loading && sorted.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3 text-[var(--color-text-muted)]">&#128218;</div>
          <p className="text-[var(--color-text-secondary)] mb-1">No words yet</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {search ? 'Try a different search term' : 'Import some vocabulary to get started'}
          </p>
          {!search && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="mt-4 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer
                bg-[var(--color-primary-main)] text-white hover:opacity-95 transition-opacity"
            >
              + Add Words
            </button>
          )}
        </div>
      )}

      {/* Word table */}
      {!loading && sorted.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-primary-pale)]">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={sorted.length > 0 && selectedIds.size === sorted.length}
                      onChange={toggleSelectAll}
                      className="cursor-pointer accent-[var(--color-primary-main)]"
                    />
                  </th>
                  <th
                    onClick={() => toggleSort('lemma')}
                    className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-primary-main)] select-none"
                  >
                    Lemma{sortIndicator('lemma')}
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">
                    Translation
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">
                    POS
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">
                    Tags
                  </th>
                  <th
                    onClick={() => toggleSort('exposure_count')}
                    className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-primary-main)] select-none"
                  >
                    Seen{sortIndicator('exposure_count')}
                  </th>
                  <th
                    onClick={() => toggleSort('next_review')}
                    className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-primary-main)] select-none"
                  >
                    Next Review{sortIndicator('next_review')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {sorted.map(word => (
                  <WordRow
                    key={word.id}
                    word={word}
                    expanded={expandedId === word.id}
                    deleteConfirm={deleteConfirm === word.id}
                    selected={selectedIds.has(word.id)}
                    onToggleSelect={() => toggleSelected(word.id)}
                    onToggle={() => handleExpand(word)}
                    onDelete={() => handleDelete(word.id)}
                    onConfirmDelete={() => setDeleteConfirm(word.id)}
                    onCancelDelete={() => setDeleteConfirm(null)}
                    onSave={() => handleSave(word.id)}
                    saving={saving}
                    editExample={editExample}
                    setEditExample={setEditExample}
                    editTags={editTags}
                    setEditTags={setEditTags}
                    editPronunciation={editPronunciation}
                    setEditPronunciation={setEditPronunciation}
                    formatDate={formatDate}
                    allTags={allTags}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="sticky bottom-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                  bg-[var(--color-incorrect)] text-white hover:opacity-90
                  disabled:opacity-50 transition-opacity"
              >
                {bulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={handleBulkEnrich}
                disabled={bulkEnriching}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                  bg-[var(--color-primary-main)] text-white hover:opacity-90
                  disabled:opacity-50 transition-opacity"
              >
                {bulkEnriching ? 'Enriching...' : 'Enrich'}
              </button>
              <button
                type="button"
                onClick={handleStudySelected}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                  border border-[var(--color-accent-light)] text-[var(--color-accent-dark)]
                  bg-[var(--color-accent-faded)] hover:opacity-90 transition-opacity"
              >
                Study Selected
              </button>
              {currentListId && lists.length > 1 && (
                <button
                  type="button"
                  onClick={() => setMoveModalOpen(true)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                    border border-[var(--color-border)] text-[var(--color-text-secondary)]
                    hover:bg-[var(--color-surface-alt)] transition-colors"
                >
                  Move to list
                </button>
              )}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                  border border-[var(--color-border)] text-[var(--color-text-secondary)]
                  hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Deselect All
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)] mt-2 text-right">
          {sorted.length} word{sorted.length === 1 ? '' : 's'}
          {filtered.length !== words.length && ` (filtered from ${words.length})`}
        </p>
      )}

      {/* Modals */}
      <AddWordsModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        userId={userId}
        listId={currentListId}
        onWordsAdded={handleWordsAdded}
        langFrom={langFrom}
        langTo={langTo}
      />

      <StudyToolPicker
        open={studyPickerOpen}
        wordCount={selectedIds.size}
        onPick={handlePickStudyTool}
        onClose={() => setStudyPickerOpen(false)}
      />

      <MoveToListModal
        open={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        wordIds={Array.from(selectedIds)}
        lists={lists}
        currentListId={currentListId}
        userId={userId}
        onMoved={handleWordsAdded}
      />
    </div>
  )
}

// --- Word Row subcomponent ---

interface WordRowProps {
  word: Word
  expanded: boolean
  deleteConfirm: boolean
  selected: boolean
  onToggleSelect: () => void
  onToggle: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onSave: () => void
  saving: boolean
  editExample: string
  setEditExample: (v: string) => void
  editTags: string
  setEditTags: (v: string) => void
  editPronunciation: string
  setEditPronunciation: (v: string) => void
  formatDate: (d: string | null) => string
  allTags: string[]
}

const MASTERY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'New', color: '#3b82f6', bg: '#dbeafe' },
  learning: { label: 'Learning', color: '#f59e0b', bg: '#fef3c7' },
  mastered: { label: 'Mastered', color: '#22c55e', bg: '#dcfce7' },
}

const POS_LABELS: Record<string, { short: string; full: string }> = {
  verb: { short: 'v.', full: 'Verb' },
  noun: { short: 'n.', full: 'Noun' },
  adjective: { short: 'adj.', full: 'Adjective' },
  adverb: { short: 'adv.', full: 'Adverb' },
  preposition: { short: 'prep.', full: 'Preposition' },
  conjunction: { short: 'conj.', full: 'Conjunction' },
  pronoun: { short: 'pron.', full: 'Pronoun' },
  interjection: { short: 'interj.', full: 'Interjection' },
}

function WordRow({
  word, expanded, deleteConfirm, selected, onToggleSelect,
  onToggle, onDelete, onConfirmDelete, onCancelDelete, onSave,
  saving, editExample, setEditExample, editTags, setEditTags,
  editPronunciation, setEditPronunciation, formatDate, allTags,
}: WordRowProps) {
  const mastery = getMasteryLevel(word)
  const masteryInfo = MASTERY_BADGE[mastery]
  const posInfo = word.part_of_speech ? POS_LABELS[word.part_of_speech.toLowerCase()] : null

  const [editTagsDropdownOpen, setEditTagsDropdownOpen] = useState(false)
  const editTagsDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (editTagsDropdownRef.current && !editTagsDropdownRef.current.contains(e.target as Node)) {
        setEditTagsDropdownOpen(false)
      }
    }
    if (editTagsDropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [editTagsDropdownOpen])

  const currentEditTags = editTags.split(',').map(t => t.trim()).filter(Boolean)
  const toggleEditTag = (tag: string) => {
    if (currentEditTags.includes(tag)) {
      setEditTags(currentEditTags.filter(t => t !== tag).join(', '))
    } else {
      setEditTags([...currentEditTags, tag].join(', '))
    }
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className="hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
      >
        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="cursor-pointer accent-[var(--color-primary-main)]"
          />
        </td>
        <td className="px-3 py-2" dir={isRTL(word.language_from) ? 'rtl' : undefined}>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[var(--color-text-primary)]">{word.lemma}</span>
            {/* Mastery badge */}
            <span
              className="px-1.5 py-0 rounded-full text-[10px] font-semibold leading-4"
              style={{ color: masteryInfo.color, background: masteryInfo.bg }}
            >
              {masteryInfo.label}
            </span>
            {/* CEFR badge */}
            {word.cefr_level && (
              <span className="px-1 py-0 rounded text-[10px] font-bold leading-4 text-[var(--color-text-muted)]
                bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
                {word.cefr_level}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-[var(--color-text-secondary)]" dir={isRTL(word.language_to) ? 'rtl' : undefined}>{word.translation}</td>
        <td className="px-3 py-2">
          {/* Morphology / POS display */}
          {posInfo ? (
            <span
              className="inline-flex items-center gap-0.5"
              title={posInfo.full}
            >
              <span
                className="px-1.5 py-0 rounded text-[10px] font-semibold leading-4"
                style={{
                  color: word.part_of_speech?.toLowerCase() === 'verb' ? '#6366f1' : '#64748b',
                  background: word.part_of_speech?.toLowerCase() === 'verb' ? '#eef2ff' : '#f1f5f9',
                }}
              >
                {posInfo.short}
              </span>
              {/* Gender indicator for nouns */}
              {word.gender && (
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {word.gender}
                </span>
              )}
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">--</span>
          )}
        </td>
        <td className="px-3 py-2">
          {/* Tag pills */}
          {word.tags && word.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {word.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="px-1.5 py-0 rounded-full text-[10px] font-medium leading-4"
                  style={{ background: getTagBg(tag), color: getTagColor(tag) }}
                >
                  {tag}
                </span>
              ))}
              {word.tags.length > 3 && (
                <span className="px-1 py-0 rounded-full text-[10px] leading-4 text-[var(--color-text-muted)]">
                  +{word.tags.length - 3}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[var(--color-text-muted)]">--</span>
          )}
        </td>
        <td className="px-3 py-2 text-[var(--color-text-muted)]">{word.exposure_count}</td>
        <td className="px-3 py-2 text-[var(--color-text-muted)]">{formatDate(word.next_review)}</td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 py-3 bg-[var(--color-surface-alt)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {/* Example sentence */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                  Example sentence
                </label>
                <input
                  type="text"
                  value={editExample}
                  onChange={e => setEditExample(e.target.value)}
                  placeholder="Enter an example..."
                  className="w-full px-2 py-1.5 rounded border border-[var(--color-border)]
                    bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
                    focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-main)]"
                />
              </div>

              {/* Example translation */}
              {word.example_translation && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                    Example translation
                  </label>
                  <p className="text-[var(--color-text-secondary)] text-sm">{word.example_translation}</p>
                </div>
              )}

              {/* Pronunciation */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                  Pronunciation
                </label>
                <input
                  type="text"
                  value={editPronunciation}
                  onChange={e => setEditPronunciation(e.target.value)}
                  placeholder="IPA or phonetic..."
                  className="w-full px-2 py-1.5 rounded border border-[var(--color-border)]
                    bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
                    focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-main)]"
                />
              </div>

              {/* Tags with dropdown picker */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                  Tags
                </label>
                <div className="relative" ref={editTagsDropdownRef}>
                  <input
                    type="text"
                    value={editTags}
                    onChange={e => setEditTags(e.target.value)}
                    onFocus={() => setEditTagsDropdownOpen(true)}
                    placeholder="food, daily, A2..."
                    className="w-full px-2 py-1.5 rounded border border-[var(--color-border)]
                      bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm
                      focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-main)]"
                  />
                  {editTagsDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 z-20 bg-[var(--color-surface)]
                      border border-[var(--color-border)] rounded-lg shadow-lg p-2 max-h-[200px] overflow-y-auto w-full min-w-[250px]">
                      <p className="text-[10px] font-medium text-[var(--color-text-muted)] mb-1.5 px-1">Predefined</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {PREDEFINED_TAGS.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleEditTag(tag)}
                            className={`px-1.5 py-0 rounded-full text-[10px] font-medium leading-4 cursor-pointer transition-all
                              ${currentEditTags.includes(tag) ? 'ring-1 ring-[var(--color-primary-main)]' : 'opacity-70 hover:opacity-100'}`}
                            style={{ background: getTagBg(tag), color: getTagColor(tag) }}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      {allTags.filter(t => !PREDEFINED_TAGS.includes(t as typeof PREDEFINED_TAGS[number])).length > 0 && (
                        <>
                          <p className="text-[10px] font-medium text-[var(--color-text-muted)] mb-1.5 px-1">Custom</p>
                          <div className="flex flex-wrap gap-1">
                            {allTags.filter(t => !PREDEFINED_TAGS.includes(t as typeof PREDEFINED_TAGS[number])).map(tag => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleEditTag(tag)}
                                className={`px-1.5 py-0 rounded-full text-[10px] font-medium leading-4 cursor-pointer transition-all
                                  ${currentEditTags.includes(tag) ? 'ring-1 ring-[var(--color-primary-main)]' : 'opacity-70 hover:opacity-100'}`}
                                style={{ background: getTagBg(tag), color: getTagColor(tag) }}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Existing tags display */}
            {word.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {word.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: getTagBg(tag), color: getTagColor(tag) }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Morphology / verb info */}
            {word.part_of_speech?.toLowerCase() === 'verb' && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-0.5">
                  Verb: {word.lemma}
                </p>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
                  Conjugation data available via AI Enrich. Select this word and click "Enrich" to generate conjugation forms.
                </p>
              </div>
            )}

            {/* Word details */}
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
              {word.cefr_level && <span>CEFR: <strong>{word.cefr_level}</strong></span>}
              {word.gender && <span>Gender: <strong>{word.gender}</strong></span>}
              <span>Ease: <strong>{word.ease_factor.toFixed(2)}</strong></span>
              <span>Interval: <strong>{word.interval_days}d</strong></span>
              <span>Reps: <strong>{word.reps}</strong></span>
              <span>Added: <strong>{formatDate(word.created_at)}</strong></span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
              <button
                onClick={(e) => { e.stopPropagation(); onSave() }}
                disabled={saving}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                  bg-[var(--color-primary-main)] text-white hover:opacity-90
                  disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>

              {!deleteConfirm ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onConfirmDelete() }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                    text-[var(--color-incorrect)] border border-[var(--color-incorrect)]
                    hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-[var(--color-text-muted)]">Confirm?</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete() }}
                    className="px-2 py-1 rounded text-xs font-medium cursor-pointer
                      bg-[var(--color-incorrect)] text-white hover:opacity-90"
                  >
                    Yes
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCancelDelete() }}
                    className="px-2 py-1 rounded text-xs font-medium cursor-pointer
                      border border-[var(--color-border)] text-[var(--color-text-secondary)]
                      hover:bg-[var(--color-gray-100)]"
                  >
                    No
                  </button>
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
