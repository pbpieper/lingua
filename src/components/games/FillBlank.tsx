import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { getWords, startSession, endSession, submitReview } from '@/services/vocabApi'
import { isRTL } from '@/lib/csvParser'
import { getLocalWords, shuffle as shuffleLocal } from '@/lib/localStore'
import { fuzzyMatch } from '@/lib/textNormalize'
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty'
import { AdaptiveBanner } from '@/components/atoms/AdaptiveBanner'
import { ToolOptionsBar } from '@/components/atoms/ToolOptionsBar'
import { ToggleableKeyboard } from '@/components/atoms/VirtualKeyboard'
import { useLearningLocales } from '@/hooks/useLearningLocales'
import { useXP } from '@/hooks/useXP'
import { loadToolConfig, saveToolConfig } from '@/types/toolConfig'
import type { ToolVariable, ToolVariation } from '@/types/toolConfig'
import type { Word } from '@/types/word'

// --- Variables & Variations config ---

const FB_VARIATIONS: ToolVariation[] = [
  { key: 'sentence', label: 'Sentence', description: 'Fill blanks in individual sentences', icon: '📝' },
  { key: 'wordbank', label: 'Word Bank', description: 'Pick the correct word from a bank', icon: '📦' },
  { key: 'story', label: 'Story', description: 'Fill blanks in an AI-generated story', icon: '📖' },
]

const FB_VARIABLES: ToolVariable[] = [
  {
    key: 'itemCount',
    label: 'Items',
    type: 'select',
    options: [
      { value: '5', label: '5' },
      { value: '10', label: '10' },
      { value: '15', label: '15' },
      { value: '20', label: '20' },
    ],
    default: '10',
  },
  {
    key: 'showHint',
    label: 'Hints',
    type: 'toggle',
    default: true,
  },
]

type FBVars = { itemCount: string; showHint: boolean }
const FB_DEFAULT_VARS: FBVars = { itemCount: '10', showHint: true }

import { getHubApiUrl } from '@/services/aiConfig'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Replace the lemma within the example sentence with a blank. */
function blankOut(sentence: string, lemma: string): string | null {
  const idx = sentence.toLowerCase().indexOf(lemma.toLowerCase())
  if (idx >= 0) {
    return sentence.slice(0, idx) + '___' + sentence.slice(idx + lemma.length)
  }
  if (lemma.length >= 4) {
    const stem = lemma.slice(0, Math.ceil(lemma.length * 0.6))
    const re = new RegExp(`\\b\\S*${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\S*\\b`, 'i')
    const match = sentence.match(re)
    if (match) {
      return sentence.replace(match[0], '___')
    }
  }
  return null
}

interface QuestionState {
  word: Word
  prompt: string
  answer: string
  usesExample: boolean
}

function buildQuestion(word: Word): QuestionState {
  if (word.example_sentence) {
    const blanked = blankOut(word.example_sentence, word.lemma)
    if (blanked) {
      return { word, prompt: blanked, answer: word.lemma, usesExample: true }
    }
  }
  return { word, prompt: `___ = ${word.translation}`, answer: word.lemma, usesExample: false }
}

// --- Story Mode types & helpers ---

interface StoryBlank {
  index: number
  answer: string
  translation: string
  userAnswer: string
  checked: boolean
  correct: boolean | null
}

interface StoryState {
  paragraphParts: string[]
  blanks: StoryBlank[]
  activeBlankIndex: number
  allChecked: boolean
}

async function generateStoryText(words: Word[]): Promise<string> {
  const wordList = words.map(w => w.lemma).join(', ')
  const lang = words[0]?.language_from ?? 'the target language'

  const prompt = `Write a short paragraph (3-5 sentences) in ${lang} that naturally uses these words: ${wordList}. Each target word MUST appear exactly once. Do not translate. Output ONLY the paragraph, nothing else.`
  const system = 'You are a language learning assistant. Write short, natural paragraphs for fill-in-the-blank exercises. Keep sentences simple (A2-B1 level). Use everyday topics.'

  const textUrl = getHubApiUrl('/generate/text')
  if (!textUrl) throw new Error('AI backend is not configured')

  const res = await fetch(textUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system }),
  })
  if (!res.ok) throw new Error(`Text generation failed: ${res.status}`)
  const data = await res.json() as { job_id?: number; response?: string }

  if (data.response) return data.response

  if (data.job_id) {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const jobUrl = getHubApiUrl(`/jobs/${data.job_id}`)
      if (!jobUrl) throw new Error('AI backend is not configured')
      const statusRes = await fetch(jobUrl)
      const status = await statusRes.json() as { status: string }
      if (status.status === 'completed') {
        const outputUrl = getHubApiUrl(`/jobs/${data.job_id}/output`)
        if (!outputUrl) throw new Error('AI backend is not configured')
        const outputRes = await fetch(outputUrl)
        const result = await outputRes.json() as { response?: string; text?: string }
        return result.response ?? result.text ?? ''
      }
      if (status.status === 'failed') throw new Error('Story generation failed')
    }
    throw new Error('Story generation timed out')
  }
  throw new Error('Unexpected response')
}

function buildStoryState(text: string, words: Word[]): StoryState | null {
  let processed = text
  const blanks: StoryBlank[] = []

  for (const word of words) {
    const idx = processed.toLowerCase().indexOf(word.lemma.toLowerCase())
    if (idx >= 0) {
      const placeholder = `__BLANK_${blanks.length}__`
      processed = processed.slice(0, idx) + placeholder + processed.slice(idx + word.lemma.length)
      blanks.push({
        index: blanks.length,
        answer: word.lemma,
        translation: word.translation,
        userAnswer: '',
        checked: false,
        correct: null,
      })
    }
  }

  if (blanks.length === 0) return null

  const parts: string[] = []
  let remaining = processed
  for (let i = 0; i < blanks.length; i++) {
    const tag = `__BLANK_${i}__`
    const splitIdx = remaining.indexOf(tag)
    parts.push(remaining.slice(0, splitIdx))
    remaining = remaining.slice(splitIdx + tag.length)
  }
  parts.push(remaining)

  return { paragraphParts: parts, blanks, activeBlankIndex: 0, allChecked: false }
}


export function FillBlank() {
  const { userId, currentListId, activeStudyWords, activeStudyVersion, hubAvailable } = useApp()
  const adaptive = useAdaptiveDifficulty()
  const { addXP } = useXP()

  // Tool config state
  const [toolCfg] = useState(() => loadToolConfig<FBVars>('fillblank', { variation: 'sentence', variables: FB_DEFAULT_VARS }))
  const [variation, setVariation] = useState(toolCfg.activeVariation)
  const [vars, setVars] = useState<FBVars>(toolCfg.activeVariables)

  const handleVariationChange = useCallback((key: string) => {
    setVariation(key)
    saveToolConfig('fillblank', key, vars)
  }, [vars])

  const handleVariableChange = useCallback((key: string, value: unknown) => {
    setVars(prev => {
      const next = { ...prev, [key]: value }
      saveToolConfig('fillblank', variation, next)
      return next
    })
  }, [variation])

  const { targetLocale } = useLearningLocales()
  const itemCount = Number(vars.itemCount) || 10

  const [words, setWords] = useState<Word[]>([])
  const [queue, setQueue] = useState<QuestionState[]>([])
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState<boolean | null>(null)
  const [stats, setStats] = useState({ correct: 0, wrong: 0 })
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [bankChoices, setBankChoices] = useState<string[]>([])
  const [bankSelected, setBankSelected] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef<number | null>(null)

  // Story mode state
  const [storyState, setStoryState] = useState<StoryState | null>(null)
  const [storyGenerating, setStoryGenerating] = useState(false)
  const storyInputRef = useRef<HTMLInputElement>(null)

  const doGenerateStory = useCallback(async (storyWords: Word[]) => {
    setStoryGenerating(true)
    try {
      const selected = shuffle(storyWords).slice(0, Math.min(6, storyWords.length))
      const text = await generateStoryText(selected)
      const state = buildStoryState(text, selected)
      if (state) {
        setStoryState(state)
      } else {
        toast.error('Could not create blanks from generated story. Try again.')
      }
    } catch {
      toast.error('Story generation failed — is the backend running?')
    } finally {
      setStoryGenerating(false)
    }
  }, [])

  const fetchWords = useCallback(async () => {
    setLoading(true)
    setBankSelected(null)
    setStoryState(null)
    try {
      let fetched: Word[]
      if (activeStudyWords && activeStudyWords.length > 0) {
        fetched = activeStudyWords.slice(0, itemCount + 4)
      } else if (!hubAvailable) {
        // Offline: use locally stored words
        fetched = shuffleLocal(getLocalWords()).slice(0, itemCount + 4)
      } else {
        fetched = await getWords(userId, { list_id: currentListId ?? undefined, limit: itemCount })
      }
      setWords(fetched)
      if (fetched.length >= 4) {
        const withExample = fetched.filter(w => w.example_sentence)
        const withoutExample = fetched.filter(w => !w.example_sentence)
        const ordered = shuffle([...withExample, ...withoutExample]).slice(0, itemCount)
        setQueue(ordered.map(buildQuestion))
        const answers = ordered.map(w => w.lemma)
        const distractors = fetched.filter(w => !ordered.includes(w)).map(w => w.lemma).slice(0, 3)
        setBankChoices(shuffle([...answers, ...distractors]))
        setIndex(0)
        setStats({ correct: 0, wrong: 0 })
        setFinished(false)
        setInput('')
        setChecked(false)
        setCorrect(null)
        if (hubAvailable) {
          const { session_id } = await startSession(userId, 'fillblank', currentListId ?? undefined)
          sessionRef.current = session_id
        }

        // For story mode, generate a story after words are loaded
        if (variation === 'story' && hubAvailable) {
          // Don't await — let the loading spinner show in the story section
          doGenerateStory(ordered)
        }
      }
    } catch {
      if (hubAvailable) toast.error('Failed to load words')
    } finally {
      setLoading(false)
    }
  }, [userId, currentListId, activeStudyWords, activeStudyVersion, variation, doGenerateStory, itemCount, hubAvailable])

  useEffect(() => {
    fetchWords()
  }, [fetchWords])

  useEffect(() => {
    if (!checked && inputRef.current) inputRef.current.focus()
  }, [index, checked])

  useEffect(() => {
    if (storyState && !storyState.allChecked && storyInputRef.current) {
      storyInputRef.current.focus()
    }
  }, [storyState?.activeBlankIndex, storyState?.allChecked])

  const currentQ = queue[index] ?? null

  const handleCheck = useCallback(() => {
    if (!currentQ || checked) return
    const trimmed = input.trim()
    if (!trimmed) return

    const isCorrect = fuzzyMatch(trimmed, currentQ.answer)
    adaptive.recordAnswer(isCorrect, 'spelling')
    setChecked(true)
    setCorrect(isCorrect)
    setStats(s => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      wrong: s.wrong + (isCorrect ? 0 : 1),
    }))

    submitReview({
      word_id: currentQ.word.id,
      quality: isCorrect ? 5 : 1,
      user_id: userId,
    }).catch(() => {})
  }, [currentQ, input, checked, userId])

  const handleNext = useCallback(() => {
    if (index + 1 >= queue.length) {
      setFinished(true)
      addXP(15, 'game_round')
      if (sessionRef.current) {
        endSession(sessionRef.current, {
          words_reviewed: queue.length,
          correct: stats.correct,
          wrong: stats.wrong,
        }).catch(() => {})
      }
      return
    }
    setIndex(i => i + 1)
    setInput('')
    setChecked(false)
    setCorrect(null)
  }, [index, queue.length, stats, correct])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!checked) handleCheck()
      else handleNext()
    }
  }

  // --- Story mode handlers ---
  const handleStoryBlankInput = useCallback((value: string) => {
    setStoryState(prev => {
      if (!prev) return prev
      const blanks = [...prev.blanks]
      blanks[prev.activeBlankIndex] = { ...blanks[prev.activeBlankIndex], userAnswer: value }
      return { ...prev, blanks }
    })
  }, [])

  const handleStoryBlankCheck = useCallback(() => {
    if (!storyState) return
    const blank = storyState.blanks[storyState.activeBlankIndex]
    if (!blank || blank.checked || !blank.userAnswer.trim()) return

    const isCorrect = fuzzyMatch(blank.userAnswer.trim(), blank.answer)
    adaptive.recordAnswer(isCorrect, 'spelling')

    setStoryState(prev => {
      if (!prev) return prev
      const blanks = [...prev.blanks]
      blanks[prev.activeBlankIndex] = { ...blanks[prev.activeBlankIndex], checked: true, correct: isCorrect }
      const allChecked = blanks.every(b => b.checked)

      let nextActive = prev.activeBlankIndex
      if (!allChecked) {
        for (let i = 1; i <= blanks.length; i++) {
          const idx = (prev.activeBlankIndex + i) % blanks.length
          if (!blanks[idx].checked) { nextActive = idx; break }
        }
      }

      return { ...prev, blanks, activeBlankIndex: nextActive, allChecked }
    })

    setStats(s => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      wrong: s.wrong + (isCorrect ? 0 : 1),
    }))
  }, [storyState])

  const handleStoryBlankClick = useCallback((blankIndex: number) => {
    if (!storyState || storyState.blanks[blankIndex]?.checked) return
    setStoryState(prev => prev ? { ...prev, activeBlankIndex: blankIndex } : prev)
  }, [storyState])

  const handleStoryBankPick = useCallback((word: string) => {
    if (!storyState) return
    const blank = storyState.blanks[storyState.activeBlankIndex]
    if (!blank || blank.checked) return
    setStoryState(prev => {
      if (!prev) return prev
      const blanks = [...prev.blanks]
      blanks[prev.activeBlankIndex] = { ...blanks[prev.activeBlankIndex], userAnswer: word }
      return { ...prev, blanks }
    })
  }, [storyState])

  const handleStoryKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleStoryBlankCheck()
  }

  const handleStoryFinish = useCallback(() => {
    setFinished(true)
    addXP(20, 'game_round')
    if (sessionRef.current && storyState) {
      const c = storyState.blanks.filter(b => b.correct).length
      const w = storyState.blanks.filter(b => b.checked && !b.correct).length
      endSession(sessionRef.current, { words_reviewed: storyState.blanks.length, correct: c, wrong: w }).catch(() => {})
    }
  }, [storyState])


  // --- Render helpers ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading words...</span>
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
              Fill in the Blank needs the Creative Hub backend to load your vocabulary.
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

  if (finished) {
    const total = stats.correct + stats.wrong
    const pct = total > 0 ? Math.round((stats.correct / total) * 100) : 0

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 gap-6"
      >
        <h2
          className="text-3xl font-bold"
          style={{ color: 'var(--color-primary-main)' }}
        >
          Round Complete
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
              <div className="text-2xl font-bold" style={{ color: 'var(--color-correct)' }}>
                {stats.correct}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Correct</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-incorrect)' }}>
                {stats.wrong}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Wrong</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-primary-main)' }}>
                {pct}%
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Accuracy</div>
            </div>
          </div>
        </div>

        <button
          onClick={fetchWords}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Play Again
        </button>
      </motion.div>
    )
  }

  // Word bank: handle picking a word
  const handleBankPick = (word: string) => {
    if (checked) return
    setBankSelected(word)
    setInput(word)
  }

  // ======== Story Mode Render ========
  if (variation === 'story') {
    if (storyGenerating) {
      return (
        <div className="flex flex-col gap-5">
          <ToolOptionsBar
            variations={FB_VARIATIONS}
            variables={FB_VARIABLES}
            activeVariation={variation}
            activeVariables={vars}
            onVariationChange={handleVariationChange}
            onVariableChange={handleVariableChange}
          />
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="w-8 h-8 rounded-full border-3 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--color-primary-main)', borderTopColor: 'transparent' }}
            />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Generating story with your vocabulary...
            </span>
          </div>
        </div>
      )
    }

    if (!storyState) {
      return (
        <div className="flex flex-col gap-5">
          <ToolOptionsBar
            variations={FB_VARIATIONS}
            variables={FB_VARIABLES}
            activeVariation={variation}
            activeVariables={vars}
            onVariationChange={handleVariationChange}
            onVariableChange={handleVariableChange}
          />
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Story mode requires the AI backend. Make sure it is running.
            </span>
            <button
              onClick={() => {
                const storyWords = queue.map(q => q.word)
                if (storyWords.length > 0) doGenerateStory(storyWords)
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
              style={{ background: 'var(--color-primary-main)' }}
            >
              Retry Story Generation
            </button>
          </div>
        </div>
      )
    }

    const storyBlanks = storyState.blanks
    const storyCorrect = storyBlanks.filter(b => b.correct).length
    const storyWrong = storyBlanks.filter(b => b.checked && !b.correct).length
    const storyCheckedCount = storyBlanks.filter(b => b.checked).length
    const activeBlank = storyBlanks[storyState.activeBlankIndex]

    const storyBankWords = shuffle([
      ...storyBlanks.map(b => b.answer),
      ...words.filter(w => !storyBlanks.some(b => b.answer === w.lemma)).map(w => w.lemma).slice(0, 3),
    ])

    return (
      <div className="flex flex-col gap-5">
        <AdaptiveBanner state={adaptive} />

        <ToolOptionsBar
          variations={FB_VARIATIONS}
          variables={FB_VARIABLES}
          activeVariation={variation}
          activeVariables={vars}
          onVariationChange={handleVariationChange}
          onVariableChange={handleVariableChange}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Fill in the Blank — Story
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium" style={{ color: 'var(--color-correct)' }}>
              {storyCorrect} correct
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/</span>
            <span className="text-xs font-medium" style={{ color: 'var(--color-incorrect)' }}>
              {storyWrong} wrong
            </span>
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--color-primary-faded)', color: 'var(--color-primary-main)' }}
            >
              {storyCheckedCount} / {storyBlanks.length}
            </span>
          </div>
        </div>

        {/* Story paragraph with inline blanks */}
        <div
          className="rounded-2xl px-8 py-10 flex flex-col gap-6"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          <p className="text-lg leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
            {storyState.paragraphParts.map((part, i) => (
              <span key={i}>
                {part}
                {i < storyBlanks.length && (() => {
                  const blank = storyBlanks[i]
                  const isActive = storyState.activeBlankIndex === i && !blank.checked
                  return (
                    <span
                      className="inline-flex items-center mx-1 cursor-pointer"
                      onClick={() => handleStoryBlankClick(i)}
                    >
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-sm font-semibold min-w-[60px] text-center border-b-2 transition-all"
                        style={{
                          borderColor: blank.checked
                            ? blank.correct ? 'var(--color-correct)' : 'var(--color-incorrect)'
                            : isActive ? 'var(--color-primary-main)' : 'var(--color-border)',
                          background: blank.checked
                            ? blank.correct ? 'var(--color-correct-bg)' : 'var(--color-incorrect-bg)'
                            : isActive ? 'var(--color-primary-faded)' : 'var(--color-surface-alt)',
                          color: blank.checked
                            ? blank.correct ? 'var(--color-correct)' : 'var(--color-incorrect)'
                            : 'var(--color-text-primary)',
                        }}
                      >
                        {blank.checked
                          ? blank.correct ? blank.userAnswer : blank.answer
                          : blank.userAnswer || `(${i + 1})`
                        }
                      </span>
                      {blank.checked && !blank.correct && (
                        <span className="text-xs ml-1 line-through" style={{ color: 'var(--color-incorrect)' }}>
                          {blank.userAnswer}
                        </span>
                      )}
                    </span>
                  )
                })()}
              </span>
            ))}
          </p>

          {/* Hint for active blank */}
          {vars.showHint && activeBlank && !activeBlank.checked && (
            <div className="text-center">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                Blank {storyState.activeBlankIndex + 1}: <strong style={{ color: 'var(--color-accent-dark)' }}>{activeBlank.translation}</strong>
              </span>
            </div>
          )}

          {/* Input + word bank for active blank */}
          {!storyState.allChecked && activeBlank && !activeBlank.checked && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 w-full max-w-sm">
                <input
                  ref={storyInputRef}
                  type="text"
                  value={activeBlank.userAnswer}
                  onChange={e => handleStoryBlankInput(e.target.value)}
                  onKeyDown={handleStoryKeyDown}
                  placeholder={`Blank ${storyState.activeBlankIndex + 1}...`}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  onClick={handleStoryBlankCheck}
                  disabled={!activeBlank.userAnswer.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--color-primary-main)' }}
                >
                  Check
                </button>
              </div>

              {/* Word bank for story */}
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {storyBankWords.map((word, i) => {
                  const alreadyUsed = storyBlanks.some(b => b.checked && b.correct && b.answer === word)
                  return (
                    <button
                      key={`${word}-${i}`}
                      onClick={() => handleStoryBankPick(word)}
                      disabled={alreadyUsed}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: activeBlank.userAnswer === word ? 'var(--color-primary-main)' : 'var(--color-surface)',
                        color: activeBlank.userAnswer === word ? '#fff' : 'var(--color-text-primary)',
                        border: `1px solid ${activeBlank.userAnswer === word ? 'var(--color-primary-main)' : 'var(--color-border)'}`,
                      }}
                    >
                      {word}
                    </button>
                  )
                })}
              </div>

              <ToggleableKeyboard
                locale={targetLocale}
                onChar={char => handleStoryBlankInput(activeBlank.userAnswer + char)}
                onBackspace={() => handleStoryBlankInput(activeBlank.userAnswer.slice(0, -1))}
                onSpace={() => handleStoryBlankInput(activeBlank.userAnswer + ' ')}
              />
            </div>
          )}

          {/* All blanks done */}
          {storyState.allChecked && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--color-correct)' }}>
                Story complete! {storyCorrect}/{storyBlanks.length} correct
              </span>
              <div className="flex gap-3">
                <button
                  onClick={handleStoryFinish}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                  style={{ background: 'var(--color-primary-main)' }}
                >
                  Finish
                </button>
                <button
                  onClick={fetchWords}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{
                    background: 'var(--color-surface-alt)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  New Story
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    )
  }

  // ======== Sentence / Word Bank Modes ========
  return (
    <div className="flex flex-col gap-5">
      <AdaptiveBanner state={adaptive} />

      <ToolOptionsBar
        variations={FB_VARIATIONS}
        variables={FB_VARIABLES}
        activeVariation={variation}
        activeVariables={vars}
        onVariationChange={handleVariationChange}
        onVariableChange={handleVariableChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Fill in the Blank
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: 'var(--color-correct)' }}>
            {stats.correct} correct
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/</span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-incorrect)' }}>
            {stats.wrong} wrong
          </span>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'var(--color-primary-faded)', color: 'var(--color-primary-main)' }}
          >
            {index + 1} / {queue.length}
          </span>
        </div>
      </div>

      {/* Question card */}
      {currentQ && (
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl px-8 py-10 flex flex-col items-center gap-6"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            {/* Hint */}
            {vars.showHint && currentQ.usesExample && (
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                Translation: <strong style={{ color: 'var(--color-accent-dark)' }} dir={isRTL(currentQ.word.language_to) ? 'rtl' : undefined}>{currentQ.word.translation}</strong>
                {currentQ.word.part_of_speech && (
                  <span className="ml-2">({currentQ.word.part_of_speech})</span>
                )}
              </span>
            )}

            {/* Sentence with blank */}
            <p
              className="text-2xl font-semibold text-center leading-relaxed max-w-lg"
              style={{ color: 'var(--color-text-primary)' }}
              dir={isRTL(currentQ.word.language_from) ? 'rtl' : undefined}
            >
              {currentQ.prompt.split('___').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span
                      className="inline-block mx-1 border-b-2 min-w-[80px]"
                      style={{
                        borderColor: checked
                          ? correct ? 'var(--color-correct)' : 'var(--color-incorrect)'
                          : 'var(--color-primary-main)',
                      }}
                    >
                      {checked && (
                        <span
                          className="font-bold"
                          style={{ color: correct ? 'var(--color-correct)' : 'var(--color-incorrect)' }}
                        >
                          {correct ? input.trim() : currentQ.answer}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              ))}
            </p>

            {/* Example translation hint */}
            {currentQ.usesExample && currentQ.word.example_translation && (
              <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                ({currentQ.word.example_translation})
              </p>
            )}

            {/* Input — typing mode */}
            {!checked && variation === 'sentence' && (
              <div className="flex flex-col items-center gap-2 w-full max-w-sm">
                <div className="flex items-center gap-3 w-full">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type the missing word..."
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: 'var(--color-surface-alt)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    dir={isRTL(currentQ.word.language_from) ? 'rtl' : undefined}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    onClick={handleCheck}
                    disabled={!input.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--color-primary-main)' }}
                  >
                    Check
                  </button>
                </div>
                <ToggleableKeyboard
                  locale={targetLocale}
                  onChar={char => { setInput(prev => prev + char); inputRef.current?.focus() }}
                  onBackspace={() => { setInput(prev => prev.slice(0, -1)); inputRef.current?.focus() }}
                  onSpace={() => { setInput(prev => prev + ' '); inputRef.current?.focus() }}
                />
              </div>
            )}

            {/* Input — word bank */}
            {!checked && variation === 'wordbank' && (
              <div className="flex flex-col items-center gap-3 w-full max-w-md">
                <div className="flex flex-wrap justify-center gap-2">
                  {bankChoices.map((word, i) => (
                    <button
                      key={`${word}-${i}`}
                      onClick={() => handleBankPick(word)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                      style={{
                        background: bankSelected === word ? 'var(--color-primary-main)' : 'var(--color-surface)',
                        color: bankSelected === word ? '#fff' : 'var(--color-text-primary)',
                        border: `1px solid ${bankSelected === word ? 'var(--color-primary-main)' : 'var(--color-border)'}`,
                      }}
                      dir={isRTL(currentQ.word.language_from) ? 'rtl' : undefined}
                    >
                      {word}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleCheck}
                  disabled={!bankSelected}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--color-primary-main)' }}
                >
                  Check
                </button>
              </div>
            )}

            {/* Feedback */}
            {checked && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  {correct ? (
                    <>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M4 10l4 4 8-8" stroke="var(--color-correct)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-correct)' }}>
                        Correct!
                      </span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="var(--color-incorrect)" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-incorrect)' }}>
                        Wrong — the answer was <strong>{currentQ.answer}</strong>
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                  style={{ background: 'var(--color-primary-main)' }}
                >
                  {index + 1 >= queue.length ? 'Finish' : 'Next'}
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
