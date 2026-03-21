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
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-all border"
      style={{
        background: selected ? 'var(--color-primary-main)' : 'var(--color-surface)',
        color: selected ? '#fff' : 'var(--color-text-secondary)',
        borderColor: selected ? 'var(--color-primary-main)' : 'var(--color-border)',
      }}
    >
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
      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <span className="text-base">{icon}</span>
      <span className="text-xs font-medium flex-1" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onRate(true)}
        className="text-base cursor-pointer bg-transparent border-none p-0.5 transition-transform hover:scale-110"
        style={{ opacity: rating === true ? 1 : 0.35 }}
        aria-label={`Thumbs up for ${label}`}
      >
        &#128077;
      </button>
      <button
        type="button"
        onClick={() => onRate(false)}
        className="text-base cursor-pointer bg-transparent border-none p-0.5 transition-transform hover:scale-110"
        style={{ opacity: rating === false ? 1 : 0.35 }}
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

  const handleToolRate = useCallback((toolId: string, up: boolean) => {
    setToolFeedback(prev => ({ ...prev, [toolId]: up }))
  }, [])

  const handleSave = useCallback(() => {
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
    toast.success('Feedback saved! See you tomorrow.')
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
      className="space-y-6"
    >
      {/* Congratulations Section */}
      <div className="text-center py-6 relative overflow-hidden">
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
              {['&#11088;', '&#127881;', '&#127942;', '&#128293;', '&#127775;', '&#10024;', '&#128170;', '&#127891;'][i]}
            </motion.span>
          ))}
        </motion.div>

        <motion.h2
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--color-primary-main)' }}
        >
          Session Complete!
        </motion.h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Great work studying {targetName} today
        </p>
      </div>

      {/* Stats summary */}
      <div
        className="rounded-xl p-5"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xl font-bold" style={{ color: 'var(--color-primary-main)' }}>
              {wordsLearned}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Words learned
            </div>
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: 'var(--color-correct)' }}>
              {Math.round(accuracy)}%
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Accuracy
            </div>
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: 'var(--color-accent-dark, var(--color-accent))' }}>
              {streak}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Day streak
            </div>
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              ~{timeSpentMinutes}m
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Time spent
            </div>
          </div>
        </div>
      </div>

      {/* Quick Feedback */}
      {!saved ? (
        <div
          className="rounded-xl p-5 space-y-5"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Quick Feedback
          </h3>

          {/* New words */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              New words today:
            </label>
            <div className="flex flex-wrap gap-2">
              <Chip label="Too few" selected={newWordsFeeling === 'too-few'} onClick={() => setNewWordsFeeling('too-few')} />
              <Chip label="Just right" selected={newWordsFeeling === 'just-right'} onClick={() => setNewWordsFeeling('just-right')} />
              <Chip label="Too many" selected={newWordsFeeling === 'too-many'} onClick={() => setNewWordsFeeling('too-many')} />
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Difficulty:
            </label>
            <div className="flex flex-wrap gap-2">
              <Chip label="Too easy" selected={difficulty === 'too-easy'} onClick={() => setDifficulty('too-easy')} />
              <Chip label="Just right" selected={difficulty === 'just-right'} onClick={() => setDifficulty('just-right')} />
              <Chip label="Too hard" selected={difficulty === 'too-hard'} onClick={() => setDifficulty('too-hard')} />
            </div>
          </div>

          {/* Tomorrow's topic */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Tomorrow's topic:
            </label>
            <div className="flex flex-wrap gap-2">
              <Chip label="Same topic" selected={topicPreference === 'same'} onClick={() => setTopicPreference('same')} />
              <Chip label="New topic" selected={topicPreference === 'new'} onClick={() => setTopicPreference('new')} />
              <Chip label="Surprise me" selected={topicPreference === 'surprise'} onClick={() => setTopicPreference('surprise')} />
            </div>
          </div>

          {/* Tool ratings */}
          {uniqueTools.length > 0 && (
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Preferred tools:
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

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-primary-main)' }}
          >
            Save Feedback
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl p-5 text-center"
          style={{
            background: 'var(--color-primary-pale, var(--color-primary-faded))',
            border: '1px solid var(--color-primary-light)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--color-primary-dark, var(--color-primary-main))' }}>
            &#10003; Feedback saved — tomorrow's session will be adjusted accordingly
          </p>
        </motion.div>
      )}

      {/* Product Feedback — natural continuation of evening review */}
      {saved && (
        <FeedbackCollector
          embedded
          heading="One more thing..."
          subtitle="Help us make Lingua better"
        />
      )}

      {/* AI Tutor Chat */}
      {hubAvailable && (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Chat with your tutor
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Ask about your session, get tips, or just chat
            </p>
          </div>

          {/* Messages */}
          <div
            ref={chatScrollRef}
            className="px-4 py-3 space-y-2 overflow-y-auto"
            style={{ maxHeight: 240, minHeight: 60 }}
          >
            {chatMessages.length === 0 && !chatSending && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                Optional: ask your AI tutor anything about today's session
              </p>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[80%] rounded-xl px-3 py-2 text-sm"
                  style={
                    msg.role === 'user'
                      ? {
                          background: 'var(--color-primary-main)',
                          color: '#fff',
                          borderBottomRightRadius: 4,
                        }
                      : {
                          background: 'var(--color-surface-alt, var(--color-surface))',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border)',
                          borderBottomLeftRadius: 4,
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
                  className="rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: 'var(--color-surface-alt, var(--color-surface))',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Thinking...
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
              placeholder="Chat with your tutor about today's session..."
              disabled={chatSending}
              className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] disabled:opacity-50"
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
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
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
