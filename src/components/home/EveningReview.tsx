import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useLearningLocales } from '@/hooks/useLearningLocales'
import { loadLearningPrefs, saveLearningPrefs, todayKey } from '@/services/clientStore'
import type { LinguaLearningPrefs } from '@/types/session'
import { FeedbackCollector } from '@/components/feedback/FeedbackCollector'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NewWordsFeeling = 'too-few' | 'just-right' | 'too-many'
type Difficulty = 'too-easy' | 'just-right' | 'too-hard'
type TopicPreference = 'same' | 'new' | 'surprise'
type ToolRating = Record<string, boolean> // toolId -> thumbs up (true) or down (false)

export interface SessionFeedback {
  newWordsFeeling: NewWordsFeeling | null
  difficulty: Difficulty | null
  topicPreference: TopicPreference | null
  toolFeedback: ToolRating
  timestamp: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function feedbackStorageKey(dateKey: string): string {
  return `lingua-session-feedback-${dateKey}`
}

function loadSessionFeedback(dateKey: string): SessionFeedback | null {
  try {
    const raw = localStorage.getItem(feedbackStorageKey(dateKey))
    if (raw) return JSON.parse(raw) as SessionFeedback
  } catch { /* ignore */ }
  return null
}

function saveSessionFeedback(dateKey: string, feedback: SessionFeedback): void {
  localStorage.setItem(feedbackStorageKey(dateKey), JSON.stringify(feedback))
}

// ---------------------------------------------------------------------------
// Chip component
// ---------------------------------------------------------------------------

function Chip({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string
  icon?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all border
        ${selected
          ? 'border-[var(--color-primary-main)] bg-[var(--color-primary-main)] text-white shadow-sm scale-[1.02]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-light)] hover:bg-[var(--color-primary-pale)]'
        }`}
    >
      {icon && <span className="text-sm">{icon}</span>}
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Tool rating chip
// ---------------------------------------------------------------------------

function ToolChip({
  icon,
  label,
  rating,
  onRate,
}: {
  icon: string
  label: string
  rating: boolean | undefined
  onRate: (up: boolean) => void
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors"
      style={{
        background: rating !== undefined ? 'var(--color-primary-faded)' : 'var(--color-surface)',
        borderColor: rating !== undefined ? 'var(--color-primary-light)' : 'var(--color-border)',
      }}
    >
      <span className="text-base">{icon}</span>
      <span className="text-xs font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onRate(true)}
        className={`text-base cursor-pointer bg-transparent border-none p-1 rounded-md transition-all hover:scale-110
          ${rating === true ? 'opacity-100 bg-green-100 dark:bg-green-900/30' : 'opacity-30 hover:opacity-60'}`}
        aria-label={`Thumbs up for ${label}`}
      >
        &#128077;
      </button>
      <button
        type="button"
        onClick={() => onRate(false)}
        className={`text-base cursor-pointer bg-transparent border-none p-1 rounded-md transition-all hover:scale-110
          ${rating === false ? 'opacity-100 bg-red-100 dark:bg-red-900/30' : 'opacity-30 hover:opacity-60'}`}
        aria-label={`Thumbs down for ${label}`}
      >
        &#128078;
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool label helper
// ---------------------------------------------------------------------------

const TOOL_DISPLAY: Record<string, { label: string; icon: string }> = {
  flashcards: { label: 'Flashcards', icon: '\u{1F0CF}' },
  match: { label: 'Match', icon: '\u{1F517}' },
  fillblank: { label: 'Fill Blank', icon: '\u270F\uFE0F' },
  multichoice: { label: 'Quiz', icon: '\u2753' },
  speaking: { label: 'Speaking', icon: '\u{1F5E3}\uFE0F' },
  listening: { label: 'Listening', icon: '\u{1F442}' },
  writing: { label: 'Writing', icon: '\u270D\uFE0F' },
  reading: { label: 'Reading', icon: '\u{1F4D6}' },
  cloze: { label: 'Cloze', icon: '\u{1F4DD}' },
  stories: { label: 'Stories', icon: '\u{1F4D5}' },
  grammar: { label: 'Grammar', icon: '\u{1F4D0}' },
  phrases: { label: 'Phrases', icon: '\u{1F4AC}' },
  prelearn: { label: 'Pre-Learn', icon: '\u{1F3AF}' },
}

// ---------------------------------------------------------------------------
// HUB helper for AI tutor chat
// ---------------------------------------------------------------------------

import { getHubApiUrl } from '@/services/aiConfig'

async function chatWithTutor(messages: ChatMessage[], sessionSummary: string): Promise<string> {
  const system =
    `You are a friendly language learning tutor. The student just completed their daily study session. ` +
    `Here is a summary of what they did today:\n${sessionSummary}\n\n` +
    `Be encouraging, give brief actionable tips, and keep responses to 2-3 sentences. ` +
    `If they ask about their performance, reference the session data above.`

  const conversationContext = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const textUrl = getHubApiUrl('/generate/text')
  if (!textUrl) throw new Error('AI backend is not configured')

  const res = await fetch(textUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: conversationContext, system }),
  })
  if (!res.ok) throw new Error(`Text generation failed: ${res.status}`)
  const data = await res.json() as { response?: string; job_id?: number }

  if (data.response) return data.response
  if (data.job_id) {
    // Poll for result
    for (let i = 0; i < 30; i++) {
      const jobUrl = getHubApiUrl(`/jobs/${data.job_id}`)
      if (!jobUrl) throw new Error('AI backend is not configured')
      const poll = await fetch(jobUrl)
      if (!poll.ok) throw new Error('Poll failed')
      const job = await poll.json() as { status: string; error?: string }
      if (job.status === 'completed') {
        const outputUrl = getHubApiUrl(`/jobs/${data.job_id}/output`)
        if (!outputUrl) throw new Error('AI backend is not configured')
        const output = await fetch(outputUrl)
        const result = await output.json()
        return result.response ?? result.text ?? JSON.stringify(result)
      }
      if (job.status === 'failed') throw new Error(job.error ?? 'Job failed')
      await new Promise(r => setTimeout(r, 2000))
    }
    throw new Error('Job timed out')
  }
  throw new Error('Unexpected response')
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface EveningReviewProps {
  /** Summary stats to display */
  wordsLearned: number
  totalReviewed: number
  accuracy: number
  streak: number
  timeSpentMinutes: number
  /** Tool IDs used in today's session */
  toolsUsedToday: string[]
  /** Whether Creative Hub is available (for AI chat) */
  hubAvailable: boolean
}

export function EveningReview({
  wordsLearned,
  totalReviewed,
  accuracy,
  streak,
  timeSpentMinutes,
  toolsUsedToday,
  hubAvailable,
}: EveningReviewProps) {
  const { targetName } = useLearningLocales()
  const today = todayKey()

  // Check if feedback was already saved today
  const [alreadySaved] = useState(() => loadSessionFeedback(today) !== null)

  // Step management for progressive disclosure
  const [step, setStep] = useState<'celebrate' | 'feedback' | 'tomorrow' | 'done'>(
    alreadySaved ? 'done' : 'celebrate'
  )

  // Feedback state
  const [newWordsFeeling, setNewWordsFeeling] = useState<NewWordsFeeling | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [topicPreference, setTopicPreference] = useState<TopicPreference | null>(null)
  const [toolFeedback, setToolFeedback] = useState<ToolRating>({})
  const [saved, setSaved] = useState(alreadySaved)

  // AI tutor chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages])

  // Auto-advance from celebration after 2.5s
  useEffect(() => {
    if (step === 'celebrate') {
      const timer = setTimeout(() => setStep('feedback'), 2500)
      return () => clearTimeout(timer)
    }
  }, [step])

  const handleToolRate = useCallback((toolId: string, up: boolean) => {
    setToolFeedback(prev => ({ ...prev, [toolId]: up }))
  }, [])

  const handleSaveFeedback = useCallback(() => {
    const feedback: SessionFeedback = {
      newWordsFeeling,
      difficulty,
      topicPreference,
      toolFeedback,
      timestamp: new Date().toISOString(),
    }
    saveSessionFeedback(today, feedback)

    // Also update learning prefs so the study plan generator can use this data
    const prefs = loadLearningPrefs()
    const updates: Partial<LinguaLearningPrefs> = {}

    if (newWordsFeeling === 'too-many') {
      updates.lastNewWordsFeedback = 1
      updates.targetNewWordsPerDay = Math.max(5, prefs.targetNewWordsPerDay - 5)
    } else if (newWordsFeeling === 'too-few') {
      updates.lastNewWordsFeedback = -1
      updates.targetNewWordsPerDay = Math.min(60, prefs.targetNewWordsPerDay + 5)
    } else if (newWordsFeeling === 'just-right') {
      updates.lastNewWordsFeedback = 0
    }

    if (topicPreference) {
      updates.lastTomorrowFocus = topicPreference === 'same' ? 'same'
        : topicPreference === 'new' ? 'new' : 'surprise'
    }

    if (Object.keys(updates).length > 0) {
      saveLearningPrefs({ ...prefs, ...updates })
    }

    setSaved(true)
    setStep('tomorrow')
    toast.success('Feedback saved!')
  }, [newWordsFeeling, difficulty, topicPreference, toolFeedback, today])

  const sessionSummary = [
    `Words reviewed: ${totalReviewed}`,
    `New words learned: ${wordsLearned}`,
    `Accuracy: ${Math.round(accuracy)}%`,
    `Time spent: ~${timeSpentMinutes} minutes`,
    `Streak: ${streak} days`,
    `Language: ${targetName}`,
    `Tools used: ${toolsUsedToday.map(t => TOOL_DISPLAY[t]?.label ?? t).join(', ')}`,
  ].join('\n')

  const handleChatSend = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || chatSending) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updated = [...chatMessages, userMsg]
    setChatMessages(updated)
    setChatInput('')
    setChatSending(true)

    try {
      const response = await chatWithTutor(updated, sessionSummary)
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch {
      toast.error('Could not reach AI tutor')
    } finally {
      setChatSending(false)
    }
  }, [chatInput, chatSending, chatMessages, sessionSummary])

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleChatSend()
    }
  }

  // Unique tools used today for rating
  const uniqueTools = [...new Set(toolsUsedToday)].filter(t => TOOL_DISPLAY[t])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-5"
    >
      {/* === Congratulations Section === */}
      <div
        className="text-center py-8 px-4 relative overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-pale) 0%, var(--color-surface) 50%, var(--color-accent-faded) 100%)',
          border: '1px solid var(--color-primary-light)',
        }}
      >
        {/* Celebration particles */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute inset-0 pointer-events-none"
        >
          {[...Array(8)].map((_, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 0, x: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [0, -40 - i * 8, -80 - i * 10],
                x: [(i % 2 ? 1 : -1) * i * 10, (i % 2 ? 1 : -1) * i * 20],
                scale: [0, 1.2, 0.8],
              }}
              transition={{ duration: 2.5, delay: i * 0.12, ease: 'easeOut' }}
              className="absolute text-xl"
              style={{ left: `${10 + i * 10}%`, top: '40%' }}
            >
              {['\u2B50','\u{1F389}','\u{1F3C6}','\u{1F525}','\u{1F31F}','\u2728','\u{1F4AA}','\u{1F393}'][i]}
            </motion.span>
          ))}
        </motion.div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
          className="text-5xl mb-3"
        >
          &#127942;
        </motion.div>

        <motion.h2
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.25 }}
          className="text-2xl font-extrabold mb-1"
          style={{ color: 'var(--color-primary-main)' }}
        >
          Session Complete!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Great work studying {targetName} today
        </motion.p>
      </div>

      {/* === Stats Summary === */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatPill value={wordsLearned} label="Words learned" color="var(--color-primary-main)" icon="&#128218;" />
          <StatPill value={`${Math.round(accuracy)}%`} label="Accuracy" color="var(--color-correct)" icon="&#127919;" />
          <StatPill value={streak} label={`Day streak`} color="var(--color-accent-dark, orange)" icon="&#128293;" />
          <StatPill value={`~${timeSpentMinutes}m`} label="Time spent" color="var(--color-text-primary)" icon="&#9202;" />
        </div>
      </div>

      {/* === Quick Feedback (step: feedback) === */}
      {!saved && (step === 'feedback' || step === 'celebrate') && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: step === 'feedback' ? 1 : 0.3, y: 0 }}
          className="rounded-2xl p-5 space-y-5"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Quick Feedback
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Help us tune tomorrow&apos;s session</p>
          </div>

          {/* New words */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              New words today?
            </label>
            <div className="flex flex-wrap gap-2">
              <Chip icon="&#128200;" label="More please" selected={newWordsFeeling === 'too-few'} onClick={() => setNewWordsFeeling('too-few')} />
              <Chip icon="&#128077;" label="Just right" selected={newWordsFeeling === 'just-right'} onClick={() => setNewWordsFeeling('just-right')} />
              <Chip icon="&#128201;" label="Too many" selected={newWordsFeeling === 'too-many'} onClick={() => setNewWordsFeeling('too-many')} />
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Difficulty?
            </label>
            <div className="flex flex-wrap gap-2">
              <Chip icon="&#128564;" label="Too easy" selected={difficulty === 'too-easy'} onClick={() => setDifficulty('too-easy')} />
              <Chip icon="&#128170;" label="Just right" selected={difficulty === 'just-right'} onClick={() => setDifficulty('just-right')} />
              <Chip icon="&#129327;" label="Too hard" selected={difficulty === 'too-hard'} onClick={() => setDifficulty('too-hard')} />
            </div>
          </div>

          {/* Tool ratings */}
          {uniqueTools.length > 0 && (
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Rate today&apos;s tools:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {uniqueTools.map(toolId => {
                  const info = TOOL_DISPLAY[toolId]
                  if (!info) return null
                  return (
                    <ToolChip
                      key={toolId}
                      icon={info.icon}
                      label={info.label}
                      rating={toolFeedback[toolId]}
                      onRate={up => handleToolRate(toolId, up)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Tomorrow's topic -- builds anticipation */}
          <div className="pt-2 border-t border-[var(--color-border)]">
            <label className="block text-xs font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              What should tomorrow look like?
            </label>
            <div className="flex flex-wrap gap-2">
              <Chip icon="&#128260;" label="Same topic" selected={topicPreference === 'same'} onClick={() => setTopicPreference('same')} />
              <Chip icon="&#127793;" label="New topic" selected={topicPreference === 'new'} onClick={() => setTopicPreference('new')} />
              <Chip icon="&#127922;" label="Surprise me" selected={topicPreference === 'surprise'} onClick={() => setTopicPreference('surprise')} />
            </div>
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSaveFeedback}
            className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer text-white transition-all hover:opacity-90 hover:shadow-md border-none"
            style={{ background: 'var(--color-primary-main)' }}
          >
            Save & Build Tomorrow&apos;s Plan
          </button>
        </motion.div>
      )}

      {/* === Tomorrow Preview (after saving feedback) === */}
      {(step === 'tomorrow' || step === 'done') && saved && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="rounded-2xl p-5 text-center"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary-pale, var(--color-primary-faded)) 0%, var(--color-surface) 100%)',
            border: '1px solid var(--color-primary-light)',
          }}
        >
          <div className="text-3xl mb-2">&#9989;</div>
          <p className="text-sm font-bold" style={{ color: 'var(--color-primary-dark, var(--color-primary-main))' }}>
            Feedback saved
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Tomorrow&apos;s session will be adjusted based on your preferences.
            {topicPreference === 'new' && ' We\'ll mix in fresh content.'}
            {topicPreference === 'same' && ' We\'ll keep the same focus area.'}
            {topicPreference === 'surprise' && ' We\'ll keep things exciting!'}
          </p>
          {newWordsFeeling === 'too-many' && (
            <p className="text-xs text-[var(--color-accent-dark)] mt-2 font-medium">
              New words reduced by 5 per day.
            </p>
          )}
          {newWordsFeeling === 'too-few' && (
            <p className="text-xs text-[var(--color-correct)] mt-2 font-medium">
              New words increased by 5 per day.
            </p>
          )}
        </motion.div>
      )}

      {/* === Product Feedback -- natural continuation === */}
      {saved && step === 'done' && (
        <FeedbackCollector
          embedded
          heading="One more thing..."
          subtitle="Help us make Lingua better"
        />
      )}

      {/* Transition from tomorrow to done */}
      {step === 'tomorrow' && saved && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setStep('done')}
            className="text-xs text-[var(--color-text-muted)] underline cursor-pointer bg-transparent border-none hover:text-[var(--color-text-secondary)]"
          >
            Continue
          </button>
        </div>
      )}

      {/* === AI Tutor Chat === */}
      {hubAvailable && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">&#129302;</span>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Chat with your tutor
                </h3>
                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  Ask about your session, get tips, or just chat
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={chatScrollRef}
            className="px-4 py-3 space-y-2 overflow-y-auto"
            style={{ maxHeight: 260, minHeight: 60 }}
          >
            {chatMessages.length === 0 && !chatSending && (
              <div className="text-center py-6">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Ask your AI tutor anything about today&apos;s session
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {['How did I do?', 'Tips for tomorrow', 'What should I focus on?'].map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => { setChatInput(q); }}
                      className="px-3 py-1.5 rounded-full text-[10px] font-medium border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] cursor-pointer hover:border-[var(--color-primary-light)] hover:bg-[var(--color-primary-pale)] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
                  style={
                    msg.role === 'user'
                      ? {
                          background: 'var(--color-primary-main)',
                          color: '#fff',
                          borderBottomRightRadius: 6,
                        }
                      : {
                          background: 'var(--color-surface-alt, var(--color-surface))',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border)',
                          borderBottomLeftRadius: 6,
                        }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatSending && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-3.5 py-2 text-sm flex items-center gap-2"
                  style={{
                    background: 'var(--color-surface-alt, var(--color-surface))',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse [animation-delay:0.2s]" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="flex gap-2 px-4 py-3 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="Ask your tutor..."
              disabled={chatSending}
              className="flex-1 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] disabled:opacity-50"
              style={{
                background: 'var(--color-bg, var(--color-surface-alt))',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <button
              type="button"
              onClick={handleChatSend}
              disabled={chatSending || !chatInput.trim()}
              className="px-4 py-2 rounded-xl text-sm font-bold cursor-pointer text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed border-none"
              style={{ background: 'var(--color-primary-main)' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat pill sub-component                                            */
/* ------------------------------------------------------------------ */

function StatPill({ value, label, color, icon }: { value: string | number; label: string; color: string; icon: string }) {
  return (
    <div className="text-center">
      <div className="text-xs mb-1" dangerouslySetInnerHTML={{ __html: icon }} />
      <div className="text-xl font-extrabold leading-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </div>
    </div>
  )
}
