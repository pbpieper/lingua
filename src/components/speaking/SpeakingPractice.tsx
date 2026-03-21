import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Word } from '@/types/word'
import { useLearningLocales } from '@/hooks/useLearningLocales'

const HUB_URL = 'http://localhost:8420'
const POLL_INTERVAL = 2000

type Mode = 'pronunciation' | 'conversation'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ---------------------------------------------------------------------------
// Language code → BCP 47 mapping for browser SpeechSynthesis
// ---------------------------------------------------------------------------

const LANG_TO_BCP47: Record<string, string> = {
  ar: 'ar-SA', de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR',
  it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', nl: 'nl-NL', pt: 'pt-BR',
  ru: 'ru-RU', tr: 'tr-TR', zh: 'zh-CN', hi: 'hi-IN', sv: 'sv-SE',
  pl: 'pl-PL',
}

// ---------------------------------------------------------------------------
// Hub helpers
// ---------------------------------------------------------------------------

/**
 * Speak text using Hub TTS for English, browser SpeechSynthesis for all other languages.
 * Returns a URL for Hub TTS (audio file) or null for browser speech.
 */
async function speakText(text: string, lang?: string): Promise<string | null> {
  // For non-English languages, use browser SpeechSynthesis (better multilingual support)
  if (lang && lang !== 'en' && window.speechSynthesis) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = LANG_TO_BCP47[lang] ?? lang
      utterance.rate = 0.9
      utterance.onend = () => resolve(null)
      utterance.onerror = (e) => reject(e)
      speechSynthesis.speak(utterance)
    })
  }

  // English or fallback: use Hub TTS
  return generateSpeech(text)
}

async function generateSpeech(text: string): Promise<string> {
  const res = await fetch(`${HUB_URL}/generate/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Speech generation failed: ${res.status}`)
  const { job_id } = await res.json() as { job_id: number }
  return pollJob(job_id)
}

async function generateText(prompt: string, system: string): Promise<string> {
  const res = await fetch(`${HUB_URL}/generate/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system }),
  })
  if (!res.ok) throw new Error(`Text generation failed: ${res.status}`)
  const data = await res.json() as { job_id?: number; response?: string }

  // Some models return the response inline
  if (data.response) return data.response
  if (data.job_id) {
    await pollJob(data.job_id)
    const output = await fetch(`${HUB_URL}/jobs/${data.job_id}/output`)
    const result = await output.json()
    return result.response ?? result.text ?? JSON.stringify(result)
  }
  throw new Error('Unexpected text generation response')
}

async function pollJob(jobId: number): Promise<string> {
  const maxAttempts = 60 // 2 minutes
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${HUB_URL}/jobs/${jobId}`)
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`)
    const job = await res.json() as { status: string; error?: string }
    if (job.status === 'completed') {
      return `${HUB_URL}/jobs/${jobId}/output`
    }
    if (job.status === 'failed') {
      throw new Error(job.error ?? 'Job failed')
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
  }
  throw new Error('Job timed out')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpeakingPractice() {
  const { userId, hubAvailable } = useApp()
  const { targetName, targetLocale } = useLearningLocales()
  const [mode, setMode] = useState<Mode>('pronunciation')

  return (
    <div>
      <h2
        className="text-lg font-semibold mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Speaking Practice
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Practice pronunciation with TTS or have a conversation with AI.
      </p>

      {/* TTS info */}
      <div
        className="rounded-lg px-3 py-2 text-xs mb-4"
        style={{
          background: 'var(--color-primary-faded)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {hubAvailable
          ? 'English uses high-quality AI voice (Creative Hub). Other languages use your browser\'s built-in speech synthesis for pronunciation.'
          : 'Offline mode: all pronunciation uses your browser\'s built-in speech synthesis. Start the Creative Hub for higher-quality AI voices.'}
      </div>

      {/* Mode tabs */}
      <div
        className="flex gap-1 p-1 rounded-lg mb-5"
        style={{ background: 'var(--color-gray-100)' }}
      >
        {(['pronunciation', 'conversation'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all"
            style={{
              background: mode === m ? 'var(--color-surface)' : 'transparent',
              color: mode === m ? 'var(--color-primary-main)' : 'var(--color-text-muted)',
              boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {m === 'pronunciation' ? 'Pronunciation' : 'Conversation'}
          </button>
        ))}
      </div>

      {mode === 'pronunciation' ? (
        <PronunciationMode userId={userId} hubAvailable={hubAvailable} />
      ) : (
        <ConversationMode userId={userId} hubAvailable={hubAvailable} targetLanguage={targetName} targetLocale={targetLocale} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pronunciation mode
// ---------------------------------------------------------------------------

function PronunciationMode({ userId, hubAvailable }: { userId: string; hubAvailable: boolean }) {
  const [words, setWords] = useState<Word[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [speaking, setSpeaking] = useState<'word' | 'sentence' | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    api.getWords(userId, { limit: 100 })
      .then(w => {
        setWords(w)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load words')
        setLoading(false)
      })
  }, [userId])

  const word = words[index] ?? null

  const handleListen = useCallback(async (text: string, type: 'word' | 'sentence') => {
    const lang = word?.language_from
    setSpeaking(type)
    try {
      if (!hubAvailable) {
        // Offline: always use browser SpeechSynthesis
        if (!window.speechSynthesis) {
          toast.error('Your browser does not support speech synthesis')
          setSpeaking(null)
          return
        }
        await new Promise<void>((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = (lang && LANG_TO_BCP47[lang]) ? LANG_TO_BCP47[lang] : lang ?? 'en-US'
          utterance.rate = 0.9
          utterance.onend = () => resolve()
          utterance.onerror = (e) => reject(e)
          speechSynthesis.speak(utterance)
        })
        setSpeaking(null)
        return
      }

      const url = await speakText(text, lang)
      if (url) {
        // Hub TTS returned an audio URL
        if (audioRef.current) audioRef.current.pause()
        const audio = new Audio(url)
        audioRef.current = audio
        audio.play()
        audio.onended = () => setSpeaking(null)
        audio.onerror = () => {
          toast.error('Audio playback failed')
          setSpeaking(null)
        }
      } else {
        // Browser SpeechSynthesis was used (no URL)
        setSpeaking(null)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Speech generation failed')
      setSpeaking(null)
    }
  }, [hubAvailable, word])

  const handleNext = () => {
    if (audioRef.current) audioRef.current.pause()
    setSpeaking(null)
    setIndex(prev => (prev + 1) % words.length)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Loading words...
        </span>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No words in your word bank yet. Import some vocabulary first.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {/* Progress indicator */}
      <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
        {index + 1} / {words.length}
      </p>

      {/* Word card */}
      <div
        className="rounded-2xl px-8 py-10 flex flex-col items-center gap-3 w-full max-w-md min-h-[280px] justify-center"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        {word!.part_of_speech && (
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: 'var(--color-primary-faded)',
              color: 'var(--color-primary-main)',
            }}
          >
            {word!.part_of_speech}
          </span>
        )}

        <h3
          className="text-3xl font-bold text-center"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {word!.lemma}
        </h3>

        {word!.pronunciation && (
          <span className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
            {word!.pronunciation}
          </span>
        )}

        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          {word!.translation}
        </p>

        {word!.example_sentence && (
          <div className="mt-3 text-center max-w-sm">
            <p className="text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>
              &ldquo;{word!.example_sentence}&rdquo;
            </p>
            {word!.example_translation && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {word!.example_translation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mt-6 justify-center">
        <button
          onClick={() => handleListen(word!.lemma, 'word')}
          disabled={speaking !== null}
          className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
            text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--color-primary-main)' }}
        >
          {speaking === 'word' ? 'Playing...' : 'Listen'}
        </button>

        {word!.example_sentence && (
          <button
            onClick={() => handleListen(word!.example_sentence!, 'sentence')}
            disabled={speaking !== null}
            className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
              hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-primary-main)',
              border: '1px solid var(--color-primary-main)',
            }}
          >
            {speaking === 'sentence' ? 'Playing...' : 'Listen Sentence'}
          </button>
        )}

        <button
          onClick={handleNext}
          className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
            hover:bg-[var(--color-gray-100)] transition-colors"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          Next Word
        </button>
      </div>

      {!hubAvailable && (
        <div
          className="rounded-lg px-3 py-2 text-xs mt-4"
          style={{
            background: 'var(--color-accent-faded)',
            border: '1px solid var(--color-accent-light)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <strong>Offline Mode:</strong> Using browser speech synthesis for pronunciation.
          Start the Creative Hub backend for higher-quality AI voices.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Conversation mode
// ---------------------------------------------------------------------------

function ConversationMode({ userId, hubAvailable, targetLanguage, ...rest }: { userId: string; hubAvailable: boolean; targetLanguage: string; targetLocale: string }) {
  void rest // targetLocale reserved for future locale-aware TTS
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [words, setWords] = useState<Word[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getWords(userId, { limit: 50 }).then(setWords).catch(() => {})
  }, [userId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const buildSystemPrompt = useCallback(() => {
    const vocabSample = words.slice(0, 20).map(w => w.lemma).join(', ')
    const lang = targetLanguage || words[0]?.language_from || 'the target language'
    return (
      `You are a friendly language tutor. Have a natural conversation in ${lang}. ` +
      `Keep responses short (1-3 sentences). Use simple, clear language appropriate for a learner. ` +
      `IMPORTANT: Only speak in ${lang}. Do NOT mix in other languages unless the student asks. ` +
      `Try to naturally incorporate some of these vocabulary words when possible: ${vocabSample}. ` +
      `If the learner makes a mistake, gently correct them inline. ` +
      `Start by greeting the learner in ${lang}.`
    )
  }, [words, targetLanguage])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    if (!hubAvailable) {
      toast.error('Creative Hub backend is offline')
      return
    }

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setSending(true)

    try {
      // Build conversation context for the LLM
      const conversationContext = updated
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')

      const prompt = conversationContext || text
      const system = buildSystemPrompt()
      const response = await generateText(prompt, system)

      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get response')
    } finally {
      setSending(false)
    }
  }

  const handleNewConversation = () => {
    setMessages([])
    setInput('')
  }

  const handleStartConversation = async () => {
    if (!hubAvailable) {
      toast.error('Creative Hub backend is offline')
      return
    }
    setSending(true)
    try {
      const system = buildSystemPrompt()
      const response = await generateText('Start the conversation with a greeting.', system)
      setMessages([{ role: 'assistant', content: response }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start conversation')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {targetLanguage
            ? `Conversation in ${targetLanguage}`
            : 'Conversation Practice'}
        </span>
        <button
          onClick={handleNewConversation}
          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
          style={{
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            background: 'var(--color-surface)',
          }}
        >
          New Conversation
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-lg p-4 mb-3 space-y-3"
        style={{
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
        }}
      >
        {messages.length === 0 && !sending ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Start a conversation to practice your language skills.
            </p>
            <button
              onClick={handleStartConversation}
              disabled={!hubAvailable}
              className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
                text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--color-primary-main)' }}
            >
              Start Conversation
            </button>
            {!hubAvailable && (
              <div
                className="rounded-lg px-3 py-2 text-xs max-w-xs text-center"
                style={{
                  background: 'var(--color-accent-faded)',
                  border: '1px solid var(--color-accent-light)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                AI conversation requires the Creative Hub backend.
                Pronunciation practice is still available using browser TTS.
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed"
                style={
                  msg.role === 'user'
                    ? {
                        background: 'var(--color-primary-main)',
                        color: '#FFFFFF',
                        borderBottomRightRadius: 4,
                      }
                    : {
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                        borderBottomLeftRadius: 4,
                      }
                }
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex justify-start">
            <div
              className="rounded-xl px-4 py-2.5 text-sm"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hubAvailable ? 'Type your message...' : 'Backend offline'}
          disabled={!hubAvailable || sending}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
            disabled:opacity-50"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!hubAvailable || sending || !input.trim()}
          className="px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer
            text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
