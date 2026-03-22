import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getHubApiUrl, isHubConfigured } from '@/services/aiConfig'
import { usePreferences } from '@/hooks/usePreferences'

// ── Types ───────────────────────────────────────────────

type OutputType = 'sentences' | 'story' | 'fillblank' | 'dialogue' | 'quiz'
type Difficulty = 'beginner' | 'intermediate' | 'advanced'

interface GeneratedItem {
  type: OutputType
  word?: string
  content: string
  answer?: string
  options?: string[]
  speaker?: string
}

interface SavedExercise {
  id: string
  title: string
  language: string
  difficulty: Difficulty
  outputType: OutputType
  words: string[]
  items: GeneratedItem[]
  createdAt: string
}

// ── Constants ───────────────────────────────────────────

const OUTPUT_TYPES: { id: OutputType; label: string; icon: string; desc: string }[] = [
  { id: 'sentences', label: 'Sentences', icon: '\u{1F4DD}', desc: 'One example per word' },
  { id: 'story', label: 'Short Story', icon: '\u{1F4D6}', desc: 'A paragraph using all words' },
  { id: 'fillblank', label: 'Fill-in-Blank', icon: '\u270F\uFE0F', desc: 'Sentences with blanks' },
  { id: 'dialogue', label: 'Dialogue', icon: '\u{1F4AC}', desc: 'Conversation using words' },
  { id: 'quiz', label: 'Quiz', icon: '\u2753', desc: 'Multiple choice questions' },
]

const LANGUAGES = [
  'Arabic', 'Chinese', 'Dutch', 'English', 'French', 'German', 'Greek',
  'Hebrew', 'Hindi', 'Italian', 'Japanese', 'Korean', 'Polish',
  'Portuguese', 'Russian', 'Spanish', 'Swedish', 'Thai', 'Turkish', 'Ukrainian', 'Vietnamese',
]

const RTL_LANGUAGES = ['Arabic', 'Hebrew']

const STORAGE_KEY = 'lingua-sentence-creator-saved'

// ── Helpers ─────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function parseWords(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map(w => w.trim())
    .filter(Boolean)
}

function encodeShareData(data: object): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

function decodeShareData(encoded: string): object | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded)))
  } catch {
    return null
  }
}

function getSavedExercises(): SavedExercise[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveExercise(exercise: SavedExercise) {
  const existing = getSavedExercises()
  existing.unshift(exercise)
  if (existing.length > 50) existing.length = 50
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
}

function deleteSavedExercise(id: string) {
  const existing = getSavedExercises().filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
}

// ── Prompt builders ─────────────────────────────────────

function buildPrompt(words: string[], language: string, difficulty: Difficulty, outputType: OutputType): string {
  const level = difficulty === 'beginner' ? 'A1-A2' : difficulty === 'intermediate' ? 'B1-B2' : 'C1-C2'
  const wordList = words.join(', ')

  switch (outputType) {
    case 'sentences':
      return `Create one natural example sentence for each of these ${language} words at ${level} level: ${wordList}. Format each as: word: sentence (one per line, no numbering)`
    case 'story':
      return `Write a short story (100-150 words) in ${language} at ${level} level using all of these words: ${wordList}. Just the story text, no title.`
    case 'fillblank':
      return `Create fill-in-the-blank sentences in ${language} at ${level} level using these words. Replace the target word with ___. Format each as: sentence_with_blank | answer (one per line). Words: ${wordList}`
    case 'dialogue':
      return `Write a natural dialogue between two people (A and B) in ${language} at ${level} level using these words: ${wordList}. Format each line as: speaker: line (e.g. A: hello)`
    case 'quiz':
      return `Create multiple choice questions testing these ${language} words at ${level} level: ${wordList}. Format each as: question | correct_answer | wrong1 | wrong2 | wrong3 (one per line)`
  }
}

function parseAIResponse(text: string, outputType: OutputType, _words: string[]): GeneratedItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  switch (outputType) {
    case 'sentences':
      return lines.map(line => {
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0 && colonIdx < 40) {
          return { type: 'sentences', word: line.slice(0, colonIdx).trim(), content: line.slice(colonIdx + 1).trim() }
        }
        return { type: 'sentences', content: line }
      })

    case 'story':
      return [{ type: 'story', content: text.trim() }]

    case 'fillblank':
      return lines.map(line => {
        const parts = line.split('|').map(p => p.trim())
        return { type: 'fillblank', content: parts[0] || line, answer: parts[1] || '' }
      })

    case 'dialogue':
      return lines.map(line => {
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0 && colonIdx < 20) {
          return { type: 'dialogue', speaker: line.slice(0, colonIdx).trim(), content: line.slice(colonIdx + 1).trim() }
        }
        return { type: 'dialogue', speaker: '', content: line }
      })

    case 'quiz':
      return lines.map(line => {
        const parts = line.split('|').map(p => p.trim())
        if (parts.length >= 4) {
          return { type: 'quiz', content: parts[0], answer: parts[1], options: parts.slice(1).sort(() => Math.random() - 0.5) }
        }
        return { type: 'quiz', content: line, answer: '', options: [] }
      })
  }
}

// ── Word Bank Picker ────────────────────────────────────

function WordBankPicker({ onSelect, onClose }: { onSelect: (words: string[]) => void; onClose: () => void }) {
  const [bankWords, setBankWords] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    // Try to load words from localStorage word bank
    try {
      const stored = localStorage.getItem('lingua-wordbank')
      if (stored) {
        const parsed = JSON.parse(stored)
        const words = Array.isArray(parsed)
          ? parsed.map((w: { word?: string; lemma?: string; term?: string }) => w.word || w.lemma || w.term || '').filter(Boolean)
          : []
        setBankWords(words)
      }
    } catch { /* empty */ }
  }, [])

  const filtered = search
    ? bankWords.filter(w => w.toLowerCase().includes(search.toLowerCase()))
    : bankWords

  const toggle = (word: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="font-semibold text-[var(--color-text-primary)]">Select Words</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-none text-lg">&times;</button>
        </div>
        <div className="p-3 border-b border-[var(--color-border)]">
          <input
            type="text"
            placeholder="Search words..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-main)]"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {bankWords.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No words in your Word Bank yet. Upload vocabulary first.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No matching words.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filtered.map(word => (
                <button
                  key={word}
                  onClick={() => toggle(word)}
                  className={`px-3 py-1.5 rounded-full text-sm cursor-pointer border transition-colors ${
                    selected.has(word)
                      ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                  }`}
                >
                  {word}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-[var(--color-border)] flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer bg-transparent hover:bg-[var(--color-surface-alt)]">
              Cancel
            </button>
            <button
              onClick={() => { onSelect(Array.from(selected)); onClose() }}
              disabled={selected.size === 0}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary-main)] text-white cursor-pointer border-none disabled:opacity-40"
            >
              Add Words
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Fill-in-Blank Card ──────────────────────────────────

function FillBlankCard({ item, isRtl }: { item: GeneratedItem; isRtl: boolean }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" dir={isRtl ? 'rtl' : 'ltr'}>
      <p className="text-[var(--color-text-primary)] leading-relaxed">
        {revealed && item.answer
          ? item.content.replace('___', `**${item.answer}**`).split('**').map((part, i) =>
              i % 2 === 1 ? <strong key={i} className="text-[var(--color-primary-main)] underline">{part}</strong> : part
            )
          : item.content}
      </p>
      {item.answer && (
        <button
          onClick={() => setRevealed(r => !r)}
          className="mt-2 text-xs text-[var(--color-primary-main)] cursor-pointer bg-transparent border-none hover:underline"
        >
          {revealed ? 'Hide answer' : 'Show answer'}
        </button>
      )}
    </div>
  )
}

// ── Quiz Card ───────────────────────────────────────────

function QuizCard({ item, isRtl }: { item: GeneratedItem; isRtl: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null)
  const isCorrect = chosen === item.answer
  return (
    <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" dir={isRtl ? 'rtl' : 'ltr'}>
      <p className="font-medium text-[var(--color-text-primary)] mb-3">{item.content}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(item.options || []).map((opt, i) => {
          const isThis = chosen === opt
          const correct = opt === item.answer
          let cls = 'px-3 py-2 rounded-lg text-sm border cursor-pointer text-left transition-colors '
          if (!chosen) {
            cls += 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-light)]'
          } else if (correct) {
            cls += 'border-[var(--color-correct)] bg-[var(--color-correct-bg)] text-[var(--color-correct)] font-medium'
          } else if (isThis && !isCorrect) {
            cls += 'border-[var(--color-incorrect)] bg-[var(--color-incorrect-bg)] text-[var(--color-incorrect)]'
          } else {
            cls += 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] opacity-60'
          }
          return (
            <button key={i} onClick={() => !chosen && setChosen(opt)} className={cls} disabled={!!chosen}>
              {opt}
            </button>
          )
        })}
      </div>
      {chosen && (
        <p className={`mt-2 text-xs font-medium ${isCorrect ? 'text-[var(--color-correct)]' : 'text-[var(--color-incorrect)]'}`}>
          {isCorrect ? 'Correct!' : `Incorrect. The answer is: ${item.answer}`}
        </p>
      )}
    </div>
  )
}

// ── Saved Exercises Panel ───────────────────────────────

function SavedPanel({ onLoad, onClose }: { onLoad: (ex: SavedExercise) => void; onClose: () => void }) {
  const [exercises, setExercises] = useState(getSavedExercises)

  const handleDelete = (id: string) => {
    deleteSavedExercise(id)
    setExercises(getSavedExercises())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="font-semibold text-[var(--color-text-primary)]">Saved Exercises</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-none text-lg">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {exercises.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No saved exercises yet.</p>
          ) : (
            <div className="space-y-2">
              {exercises.map(ex => (
                <div key={ex.id} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{ex.title || `${ex.outputType} - ${ex.language}`}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{ex.words.length} words &middot; {ex.difficulty} &middot; {new Date(ex.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { onLoad(ex); onClose() }} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-primary-main)] text-white cursor-pointer border-none">Load</button>
                    <button onClick={() => handleDelete(ex.id)} className="px-2 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-pointer bg-transparent hover:text-[var(--color-incorrect)]">&times;</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────

export function SentenceCreator() {
  const { prefs } = usePreferences()

  // ── Shared link detection ──
  const [sharedData, setSharedData] = useState<{ items: GeneratedItem[]; words: string[]; language: string; outputType: OutputType; difficulty: Difficulty } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const data = params.get('exercise')
    if (data) {
      const decoded = decodeShareData(data) as typeof sharedData
      if (decoded && decoded.items) {
        setSharedData(decoded)
      }
    }
  }, [])

  // ── State ──
  const [rawWords, setRawWords] = useState('')
  const [language, setLanguage] = useState(prefs.defaultLangTo || 'Spanish')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [outputType, setOutputType] = useState<OutputType>('sentences')
  const [items, setItems] = useState<GeneratedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hubAvailable, setHubAvailable] = useState(false)
  const [showWordPicker, setShowWordPicker] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({})
  const resultRef = useRef<HTMLDivElement>(null)

  const words = useMemo(() => parseWords(rawWords), [rawWords])
  const isRtl = RTL_LANGUAGES.includes(language)

  // ── Check hub availability ──
  useEffect(() => {
    if (!isHubConfigured()) return
    const url = getHubApiUrl('/health')
    if (!url) return
    fetch(url, { signal: AbortSignal.timeout(2000) })
      .then(() => setHubAvailable(true))
      .catch(() => setHubAvailable(false))
  }, [])

  // ── AI Generation ──
  const generateAI = useCallback(async () => {
    if (words.length === 0) return
    setLoading(true)
    setError('')
    setItems([])
    try {
      const prompt = buildPrompt(words, language, difficulty, outputType)
      const url = getHubApiUrl('/generate/text')
      if (!url) throw new Error('Backend not configured')
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 1500 }),
      })
      if (!res.ok) throw new Error(`Generation failed (${res.status})`)
      const data = await res.json()
      const text = data.text || data.response || data.output || ''
      if (!text) throw new Error('Empty response from AI')
      setItems(parseAIResponse(text, outputType, words))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }, [words, language, difficulty, outputType])

  // ── Manual Generation ──
  const generateManual = useCallback(() => {
    if (words.length === 0) return
    const newItems: GeneratedItem[] = []

    switch (outputType) {
      case 'sentences':
        for (const w of words) {
          const sentence = manualInputs[w] || ''
          if (sentence) newItems.push({ type: 'sentences', word: w, content: sentence })
        }
        break
      case 'fillblank':
        for (const w of words) {
          const sentence = manualInputs[w] || ''
          if (sentence) {
            const blanked = sentence.replace(new RegExp(`\\b${w}\\b`, 'gi'), '___')
            newItems.push({ type: 'fillblank', content: blanked, answer: w })
          }
        }
        break
      case 'story':
        if (manualInputs['__story__']) {
          newItems.push({ type: 'story', content: manualInputs['__story__'] })
        }
        break
      case 'dialogue':
        for (const w of words) {
          const line = manualInputs[w] || ''
          if (line) {
            const colonIdx = line.indexOf(':')
            if (colonIdx > 0 && colonIdx < 20) {
              newItems.push({ type: 'dialogue', speaker: line.slice(0, colonIdx).trim(), content: line.slice(colonIdx + 1).trim() })
            } else {
              newItems.push({ type: 'dialogue', speaker: 'A', content: line })
            }
          }
        }
        break
      case 'quiz':
        for (const w of words) {
          const raw = manualInputs[w] || ''
          if (raw) {
            const parts = raw.split('|').map(p => p.trim())
            if (parts.length >= 4) {
              newItems.push({ type: 'quiz', content: parts[0], answer: parts[1], options: parts.slice(1).sort(() => Math.random() - 0.5) })
            }
          }
        }
        break
    }
    setItems(newItems)
  }, [words, manualInputs, outputType])

  // ── Export: Copy ──
  const handleCopy = useCallback(() => {
    let text = ''
    for (const item of items) {
      if (item.type === 'dialogue') text += `${item.speaker}: ${item.content}\n`
      else if (item.type === 'fillblank') text += `${item.content}  (Answer: ${item.answer})\n`
      else if (item.type === 'quiz') text += `${item.content}\nAnswer: ${item.answer}\n\n`
      else if (item.word) text += `${item.word}: ${item.content}\n`
      else text += `${item.content}\n`
    }
    navigator.clipboard.writeText(text.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [items])

  // ── Export: Print ──
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // ── Export: Share Link ──
  const handleShare = useCallback(() => {
    const payload = { items, words, language, outputType, difficulty }
    const encoded = encodeShareData(payload)
    const url = `${window.location.origin}${window.location.pathname}?exercise=${encoded}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [items, words, language, outputType, difficulty])

  // ── Export: Save ──
  const handleSave = useCallback(() => {
    const ex: SavedExercise = {
      id: generateId(),
      title: `${OUTPUT_TYPES.find(o => o.id === outputType)?.label || outputType} - ${language}`,
      language,
      difficulty,
      outputType,
      words,
      items,
      createdAt: new Date().toISOString(),
    }
    saveExercise(ex)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [items, words, language, difficulty, outputType])

  // ── Load saved exercise ──
  const handleLoadSaved = useCallback((ex: SavedExercise) => {
    setRawWords(ex.words.join('\n'))
    setLanguage(ex.language)
    setDifficulty(ex.difficulty)
    setOutputType(ex.outputType)
    setItems(ex.items)
  }, [])

  // ── Shared view (read-only for students) ──
  if (sharedData) {
    const rtl = RTL_LANGUAGES.includes(sharedData.language)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              {OUTPUT_TYPES.find(o => o.id === sharedData.outputType)?.icon}{' '}
              {OUTPUT_TYPES.find(o => o.id === sharedData.outputType)?.label} Exercise
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {sharedData.language} &middot; {sharedData.difficulty} &middot; {sharedData.words.length} words
            </p>
          </div>
          <button
            onClick={() => { setSharedData(null); window.history.replaceState({}, '', window.location.pathname) }}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer bg-transparent hover:bg-[var(--color-surface-alt)]"
          >
            Create Your Own
          </button>
        </div>
        <div className="space-y-3">
          {sharedData.items.map((item, i) => (
            <ResultCard key={i} item={item} isRtl={rtl} />
          ))}
        </div>
      </div>
    )
  }

  // ── Placeholder hints for manual mode ──
  const manualPlaceholder = (word: string): string => {
    switch (outputType) {
      case 'sentences': return `Type a sentence using "${word}"...`
      case 'fillblank': return `Type a sentence containing "${word}" (it will be blanked)`
      case 'dialogue': return `A: sentence using "${word}"`
      case 'quiz': return `question | correct | wrong1 | wrong2 | wrong3`
      default: return `Enter content...`
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Sentence Creator</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Create exercises from vocabulary. {hubAvailable ? 'AI-assisted mode active.' : 'Manual mode (offline).'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaved(true)}
            className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer bg-transparent hover:bg-[var(--color-surface-alt)]"
          >
            Saved
          </button>
        </div>
      </div>

      {/* Input Section */}
      <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
        {/* Words */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Vocabulary Words</label>
          <textarea
            value={rawWords}
            onChange={e => setRawWords(e.target.value)}
            placeholder="Type words here (one per line or comma-separated)..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-sm text-[var(--color-text-primary)] resize-y outline-none focus:border-[var(--color-primary-main)] placeholder:text-[var(--color-text-muted)]"
            dir={isRtl ? 'rtl' : 'ltr'}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-[var(--color-text-muted)]">{words.length} word{words.length !== 1 ? 's' : ''}</span>
            <button
              onClick={() => setShowWordPicker(true)}
              className="text-xs text-[var(--color-primary-main)] cursor-pointer bg-transparent border-none hover:underline"
            >
              Pull from Word Bank
            </button>
          </div>
        </div>

        {/* Language + Difficulty row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-sm text-[var(--color-text-primary)] outline-none cursor-pointer"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Difficulty</label>
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 text-xs font-medium cursor-pointer border-none transition-colors capitalize ${
                    difficulty === d
                      ? 'bg-[var(--color-primary-main)] text-white'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-pale)]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output type selector */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Output Format</label>
          <div className="flex flex-wrap gap-2">
            {OUTPUT_TYPES.map(ot => (
              <button
                key={ot.id}
                onClick={() => setOutputType(ot.id)}
                className={`px-3 py-2 rounded-lg text-sm cursor-pointer border transition-colors ${
                  outputType === ot.id
                    ? 'bg-[var(--color-primary-faded)] text-[var(--color-primary-main)] border-[var(--color-primary-light)] font-medium'
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                }`}
              >
                {ot.icon} {ot.label}
              </button>
            ))}
          </div>
        </div>

        {/* Manual input fields (shown when no hub or always for editing) */}
        {!hubAvailable && words.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">
              {outputType === 'story' ? 'Write your story using the words above:' : 'Write content for each word:'}
            </p>
            {outputType === 'story' ? (
              <textarea
                value={manualInputs['__story__'] || ''}
                onChange={e => setManualInputs(p => ({ ...p, __story__: e.target.value }))}
                placeholder={`Write a short story using: ${words.join(', ')}...`}
                rows={6}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-sm text-[var(--color-text-primary)] resize-y outline-none focus:border-[var(--color-primary-main)] placeholder:text-[var(--color-text-muted)]"
                dir={isRtl ? 'rtl' : 'ltr'}
              />
            ) : (
              words.map(word => (
                <div key={word} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-primary-main)] w-24 shrink-0 truncate">{word}</span>
                  <input
                    type="text"
                    value={manualInputs[word] || ''}
                    onChange={e => setManualInputs(p => ({ ...p, [word]: e.target.value }))}
                    placeholder={manualPlaceholder(word)}
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-main)] placeholder:text-[var(--color-text-muted)]"
                    dir={isRtl ? 'rtl' : 'ltr'}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={hubAvailable ? generateAI : generateManual}
          disabled={words.length === 0 || loading}
          className="w-full py-2.5 rounded-lg bg-[var(--color-primary-main)] text-white text-sm font-medium cursor-pointer border-none disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {loading ? 'Generating...' : hubAvailable ? 'Generate with AI' : 'Create Exercise'}
        </button>
        {error && <p className="text-xs text-[var(--color-incorrect)]">{error}</p>}
      </div>

      {/* Results */}
      {items.length > 0 && (
        <div ref={resultRef} className="space-y-4">
          {/* Export bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {OUTPUT_TYPES.find(o => o.id === outputType)?.icon} Results
            </h2>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleCopy} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer bg-transparent hover:bg-[var(--color-surface-alt)]">
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handlePrint} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer bg-transparent hover:bg-[var(--color-surface-alt)]">
                Print
              </button>
              <button onClick={handleShare} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-primary-main)] cursor-pointer bg-transparent hover:bg-[var(--color-primary-pale)] font-medium">
                Share Link
              </button>
              <button onClick={handleSave} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer bg-transparent hover:bg-[var(--color-surface-alt)]">
                Save
              </button>
            </div>
          </div>

          {/* Result cards */}
          <div className="space-y-3">
            {items.map((item, i) => (
              <ResultCard key={i} item={item} isRtl={isRtl} />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showWordPicker && (
        <WordBankPicker
          onSelect={selected => setRawWords(prev => {
            const existing = parseWords(prev)
            const merged = [...new Set([...existing, ...selected])]
            return merged.join('\n')
          })}
          onClose={() => setShowWordPicker(false)}
        />
      )}
      {showSaved && (
        <SavedPanel onLoad={handleLoadSaved} onClose={() => setShowSaved(false)} />
      )}
    </div>
  )
}

// ── Generic Result Card ─────────────────────────────────

function ResultCard({ item, isRtl }: { item: GeneratedItem; isRtl: boolean }) {
  switch (item.type) {
    case 'sentences':
      return (
        <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" dir={isRtl ? 'rtl' : 'ltr'}>
          {item.word && (
            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-[var(--color-primary-faded)] text-[var(--color-primary-main)] mb-2">
              {item.word}
            </span>
          )}
          <p className="text-[var(--color-text-primary)] leading-relaxed">{item.content}</p>
        </div>
      )

    case 'story':
      return (
        <div className="p-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">{item.content}</p>
        </div>
      )

    case 'fillblank':
      return <FillBlankCard item={item} isRtl={isRtl} />

    case 'dialogue':
      return (
        <div className={`flex items-start gap-3 ${item.speaker === 'B' ? 'flex-row-reverse' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            item.speaker === 'B'
              ? 'bg-[var(--color-accent-light)] text-[var(--color-accent-dark)]'
              : 'bg-[var(--color-primary-faded)] text-[var(--color-primary-main)]'
          }`}>
            {item.speaker || '?'}
          </div>
          <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] ${
            item.speaker === 'B'
              ? 'bg-[var(--color-accent-light)] text-[var(--color-text-primary)] rounded-tr-sm'
              : 'bg-[var(--color-primary-faded)] text-[var(--color-text-primary)] rounded-tl-sm'
          }`}>
            <p className="text-sm">{item.content}</p>
          </div>
        </div>
      )

    case 'quiz':
      return <QuizCard item={item} isRtl={isRtl} />

    default:
      return null
  }
}
