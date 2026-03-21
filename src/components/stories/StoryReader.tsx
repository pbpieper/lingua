import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Story, StoryQuestion } from '@/services/vocabApi'
import type { Word } from '@/types/word'
import { isRTL } from '@/lib/csvParser'
import { useLearningLocales } from '@/hooks/useLearningLocales'

// ---------------------------------------------------------------------------
// Helpers (same pattern as ReadingAssist)
// ---------------------------------------------------------------------------

function normalizeWord(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()
}

function tokenize(text: string): string[] {
  return text.split(/(\s+|(?<=[^\s])(?=[^\p{L}\p{N}])|(?<=[^\p{L}\p{N}])(?=\S))/u).filter(Boolean)
}

function isWordToken(token: string): boolean {
  return /[\p{L}\p{N}]/u.test(token)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  easy:   { bg: 'var(--color-success-pale, #dcfce7)', text: 'var(--color-success, #16a34a)' },
  medium: { bg: 'var(--color-warning-pale, #fff7ed)', text: 'var(--color-warning, #ea580c)' },
  hard:   { bg: 'var(--color-error-pale, #fef2f2)',   text: 'var(--color-error, #dc2626)' },
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors = DIFFICULTY_COLORS[difficulty] ?? DIFFICULTY_COLORS.easy
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: colors.bg, color: colors.text }}
    >
      {difficulty}
    </span>
  )
}

function QuestionCard({ q, index }: { q: StoryQuestion; index: number }) {
  const [showAnswer, setShowAnswer] = useState(false)
  const [selfAssessment, setSelfAssessment] = useState<'knew' | 'didnt' | null>(null)

  return (
    <div
      className="rounded-lg p-4 mb-3"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <p className="font-medium text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>
        {index + 1}. {q.question}
      </p>
      {!showAnswer ? (
        <button
          onClick={() => setShowAnswer(true)}
          className="text-xs px-3 py-1.5 rounded-md cursor-pointer font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-primary-pale)', color: 'var(--color-primary-main)' }}
        >
          Show Answer
        </button>
      ) : (
        <div>
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            {q.answer}
          </p>
          {selfAssessment === null ? (
            <div className="flex gap-2">
              <button
                onClick={() => setSelfAssessment('knew')}
                className="text-xs px-3 py-1.5 rounded-md cursor-pointer font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--color-success-pale, #dcfce7)', color: 'var(--color-success, #16a34a)' }}
              >
                I knew this
              </button>
              <button
                onClick={() => setSelfAssessment('didnt')}
                className="text-xs px-3 py-1.5 rounded-md cursor-pointer font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--color-error-pale, #fef2f2)', color: 'var(--color-error, #dc2626)' }}
              >
                I didn't know
              </button>
            </div>
          ) : (
            <span
              className="text-xs font-medium"
              style={{ color: selfAssessment === 'knew' ? 'var(--color-success, #16a34a)' : 'var(--color-error, #dc2626)' }}
            >
              {selfAssessment === 'knew' ? 'Got it!' : 'Keep practicing!'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type View = 'library' | 'generate' | 'reading'

export function StoryReader() {
  const { userId, hubAvailable } = useApp()
  const { targetLocale, nativeName } = useLearningLocales()

  const [view, setView] = useState<View>('library')
  const [stories, setStories] = useState<Story[]>([])
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Generator form
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy')

  // Word bank for highlighting
  const [wordBank, setWordBank] = useState<Map<string, Word>>(new Map())

  // Target words for orange highlighting
  const targetLemmas = useMemo(() => {
    if (!activeStory?.target_words) return new Set<string>()
    return new Set(activeStory.target_words.map(w => w.lemma.toLowerCase()))
  }, [activeStory])

  // Tooltip
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // RTL detection from story language
  const lang = useMemo(() => {
    if (activeStory?.language) return activeStory.language
    const firstWord = wordBank.values().next().value
    return firstWord?.language_from ?? 'en'
  }, [activeStory, wordBank])
  const rtl = isRTL(lang)

  // Load word bank and stories on mount
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

    loadStories()
  }, [userId])

  const loadStories = useCallback(() => {
    setLoading(true)
    api.getStories(userId)
      .then(setStories)
      .catch(() => toast.error('Failed to load stories'))
      .finally(() => setLoading(false))
  }, [userId])

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('Enter a topic first')
      return
    }
    setGenerating(true)
    try {
      const story = await api.generateStory(userId, topic.trim(), difficulty, undefined, targetLocale, nativeName)
      setActiveStory(story)
      setView('reading')
      setTopic('')
      loadStories()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate story')
    } finally {
      setGenerating(false)
    }
  }, [userId, topic, difficulty, loadStories])

  const handleOpenStory = useCallback(async (storyId: number) => {
    setLoading(true)
    try {
      const story = await api.getStory(storyId)
      setActiveStory(story)
      setView('reading')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load story')
    } finally {
      setLoading(false)
    }
  }, [])

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

  // Tokenize the active story
  const tokens = useMemo(() => {
    if (!activeStory?.content) return []
    return tokenize(activeStory.content)
  }, [activeStory])

  // ---------------------------------------------------------------------------
  // VIEWS
  // ---------------------------------------------------------------------------

  // A. Story Library
  const renderLibrary = () => (
    <motion.div
      key="library"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Stories
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            AI-generated graded reading personalized to your vocabulary
          </p>
        </div>
        <button
          onClick={() => setView('generate')}
          className="px-4 py-2 rounded-lg font-medium text-sm cursor-pointer text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--color-primary-main)' }}
        >
          + New Story
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary-main)' }}
          />
        </div>
      ) : stories.length === 0 ? (
        <div
          className="text-center py-16 rounded-lg"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-3xl mb-3">📕</p>
          <p className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
            No stories yet
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Generate your first AI-powered reading story
          </p>
          <button
            onClick={() => setView('generate')}
            className="px-4 py-2 rounded-lg font-medium text-sm cursor-pointer text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--color-primary-main)' }}
          >
            Generate Story
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {stories.map(story => (
            <button
              key={story.id}
              onClick={() => handleOpenStory(story.id)}
              className="w-full text-left rounded-lg p-4 cursor-pointer transition-colors hover:opacity-90"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {story.title}
                  </h3>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                    {story.content}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <DifficultyBadge difficulty={story.difficulty} />
                  {story.topic && (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {story.topic}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(story.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )

  // B. Story Generator
  const renderGenerator = () => (
    <motion.div
      key="generator"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={() => setView('library')}
        className="text-sm cursor-pointer hover:underline mb-4 inline-block"
        style={{ color: 'var(--color-primary-main)' }}
      >
        &larr; Back to Library
      </button>

      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        Generate a Story
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        The AI will write a story using your known vocabulary and words you need to practice.
      </p>

      <div className="space-y-5">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
            Topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. at the market, a train journey, making friends..."
            disabled={generating}
            className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] placeholder:text-[var(--color-text-muted)]"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
            Difficulty
          </label>
          <div className="flex gap-3">
            {(['easy', 'medium', 'hard'] as const).map(level => {
              const selected = difficulty === level
              const colors = DIFFICULTY_COLORS[level]
              return (
                <label
                  key={level}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all capitalize"
                  style={{
                    background: selected ? colors.bg : 'var(--color-surface)',
                    border: `2px solid ${selected ? colors.text : 'var(--color-border)'}`,
                    color: selected ? colors.text : 'var(--color-text-secondary)',
                  }}
                >
                  <input
                    type="radio"
                    name="difficulty"
                    value={level}
                    checked={selected}
                    onChange={() => setDifficulty(level)}
                    className="sr-only"
                  />
                  {level}
                </label>
              )
            })}
          </div>
        </div>

        {/* Offline indicator */}
        {!hubAvailable && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs"
            style={{
              background: 'var(--color-accent-light)',
              border: '1px solid var(--color-accent-dark)',
              color: 'var(--color-accent-dark)',
            }}
          >
            <span>&#9889;</span>
            <span>Story generation requires the AI backend. Start the Creative Hub first.</span>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !topic.trim() || !hubAvailable}
          className="px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          style={{ background: 'var(--color-primary-main)' }}
        >
          {generating ? (
            <>
              <div
                className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
              />
              Generating your story with AI...
            </>
          ) : (
            'Generate'
          )}
        </button>
      </div>
    </motion.div>
  )

  // C. Story Reader
  const renderReader = () => {
    if (!activeStory) return null

    const tooltipWord = activeToken ? wordBank.get(activeToken) : null
    const tooltipTargetWord = activeToken
      ? activeStory.target_words?.find(w => w.lemma.toLowerCase() === activeToken)
      : null

    return (
      <motion.div
        key="reader"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {/* Nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => { setView('library'); setActiveStory(null); setActiveToken(null) }}
            className="text-sm cursor-pointer hover:underline"
            style={{ color: 'var(--color-primary-main)' }}
          >
            &larr; Back to Library
          </button>
          <button
            onClick={() => { setActiveStory(null); setActiveToken(null); setView('generate') }}
            className="text-sm px-3 py-1.5 rounded-md cursor-pointer font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--color-primary-pale)', color: 'var(--color-primary-main)' }}
          >
            Read Another
          </button>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {activeStory.title}
          </h2>
          <DifficultyBadge difficulty={activeStory.difficulty} />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--color-primary-faded)' }} />
            Known word
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--color-warning-pale, #fff7ed)', border: '2px solid var(--color-warning, #ea580c)' }} />
            Target word
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--color-accent-light)', border: '1px dashed var(--color-accent-mid)' }} />
            Unknown
          </span>
          <span>Click any word for details</span>
        </div>

        {/* Story text */}
        <div
          ref={containerRef}
          className="relative rounded-lg px-5 py-4 leading-[2] text-base mb-6"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            minHeight: 200,
            direction: rtl ? 'rtl' : 'ltr',
          }}
        >
          {tokens.map((token, i) => {
            if (!isWordToken(token)) {
              return <span key={i}>{token}</span>
            }

            const normalized = normalizeWord(token)
            const isKnown = wordBank.has(normalized)
            const isTarget = targetLemmas.has(normalized)
            const isActive = activeToken === normalized

            let bgColor = 'transparent'
            let borderBottom = 'none'
            if (isActive) {
              bgColor = 'var(--color-primary-bright)'
            } else if (isTarget) {
              bgColor = 'var(--color-warning-pale, #fff7ed)'
              borderBottom = '2px solid var(--color-warning, #ea580c)'
            } else if (isKnown) {
              bgColor = 'var(--color-primary-faded)'
            } else {
              bgColor = 'var(--color-accent-light)'
              borderBottom = '2px dashed var(--color-accent-mid)'
            }

            return (
              <span
                key={i}
                onClick={e => handleWordClick(token, e)}
                className="cursor-pointer rounded px-0.5 transition-colors"
                style={{
                  background: bgColor,
                  borderBottom,
                  color: 'var(--color-text-primary)',
                }}
              >
                {token}
              </span>
            )
          })}

          {/* Tooltip */}
          {activeToken && tooltipPos && (
            <div
              className="absolute z-10 rounded-lg shadow-lg px-4 py-3 text-sm"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                left: tooltipPos.x,
                top: tooltipPos.y - 8,
                transform: 'translate(-50%, -100%)',
                maxWidth: 260,
                color: 'var(--color-text-primary)',
              }}
            >
              <div className="font-semibold mb-1">{activeToken}</div>
              {tooltipWord ? (
                <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>Translation: <strong>{tooltipWord.translation}</strong></p>
                  {tooltipWord.part_of_speech && <p>Part of speech: {tooltipWord.part_of_speech}</p>}
                  {tooltipWord.gender && <p>Gender: {tooltipWord.gender}</p>}
                </div>
              ) : tooltipTargetWord ? (
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>Translation: <strong>{tooltipTargetWord.translation}</strong></p>
                  <p className="mt-1" style={{ color: 'var(--color-warning, #ea580c)' }}>Target word</p>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Not in word bank</p>
              )}
              <button
                onClick={() => { setActiveToken(null); setTooltipPos(null) }}
                className="mt-2 text-xs cursor-pointer hover:underline"
                style={{ color: 'var(--color-primary-main)' }}
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Comprehension Check */}
        {activeStory.questions && activeStory.questions.length > 0 && (
          <div>
            <h3 className="font-semibold text-base mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Comprehension Check
            </h3>
            {activeStory.questions.map((q, i) => (
              <QuestionCard key={i} q={q} index={i} />
            ))}
          </div>
        )}
      </motion.div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <AnimatePresence mode="wait">
        {view === 'library' && renderLibrary()}
        {view === 'generate' && renderGenerator()}
        {view === 'reading' && renderReader()}
      </AnimatePresence>
    </div>
  )
}
