import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Word } from '@/types/word'

// ─── Types ────────────────────────────────────────────────────────

interface RecordingState {
  isRecording: boolean
  audioUrl: string | null
  stream: MediaStream | null
  recorder: MediaRecorder | null
}

// ─── Waveform Visualization ──────────────────────────────────────

function drawWaveform(canvas: HTMLCanvasElement, data: Float32Array | null, color: string, playing: boolean) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)

  if (!data || data.length === 0) {
    // Draw empty state
    ctx.strokeStyle = color + '40'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()
    return
  }

  ctx.strokeStyle = playing ? color : color + '90'
  ctx.lineWidth = 2
  ctx.beginPath()

  const sliceWidth = width / data.length
  let x = 0

  for (let i = 0; i < data.length; i++) {
    const v = data[i] * 0.5 + 0.5
    const y = v * height

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    x += sliceWidth
  }

  ctx.lineTo(width, height / 2)
  ctx.stroke()
}

// ─── Audio Analysis Helper ───────────────────────────────────────

async function getWaveformData(audioUrl: string): Promise<Float32Array> {
  const response = await fetch(audioUrl)
  const arrayBuffer = await response.arrayBuffer()
  const audioCtx = new AudioContext()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  const channelData = audioBuffer.getChannelData(0)

  // Downsample to ~200 points
  const samples = 200
  const blockSize = Math.floor(channelData.length / samples)
  const downsampled = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    let sum = 0
    for (let j = 0; j < blockSize; j++) {
      sum += channelData[i * blockSize + j]
    }
    downsampled[i] = sum / blockSize
  }
  audioCtx.close()
  return downsampled
}

// ─── TTS Helper ──────────────────────────────────────────────────

function speakText(text: string, lang: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'))
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    const langMap: Record<string, string> = {
      es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-BR',
      ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', ar: 'ar-SA', ru: 'ru-RU',
      nl: 'nl-NL', hi: 'hi-IN',
    }
    utterance.lang = langMap[lang] ?? lang
    utterance.rate = 0.85
    utterance.onend = () => resolve()
    utterance.onerror = () => reject(new Error('TTS failed'))
    speechSynthesis.cancel()
    speechSynthesis.speak(utterance)
  })
}

// ─── Component ────────────────────────────────────────────────────

export function PronunciationLab() {
  const { userId, activeLanguage } = useApp()
  const [words, setWords] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<'word' | 'phrase'>('word')
  const [customPhrase, setCustomPhrase] = useState('')
  const [recording, setRecording] = useState<RecordingState>({
    isRecording: false, audioUrl: null, stream: null, recorder: null,
  })
  const [ttsPlaying, setTtsPlaying] = useState(false)
  const [recordingPlaying, setRecordingPlaying] = useState(false)
  const [ttsWaveform, setTtsWaveform] = useState<Float32Array | null>(null)
  const [recWaveform, setRecWaveform] = useState<Float32Array | null>(null)
  const [selfRating, setSelfRating] = useState<number | null>(null)

  const ttsCanvasRef = useRef<HTMLCanvasElement>(null)
  const recCanvasRef = useRef<HTMLCanvasElement>(null)
  const recAudioRef = useRef<HTMLAudioElement | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Load words
  useEffect(() => {
    api.getWords(userId, { limit: 200 })
      .then(w => {
        // Shuffle for variety
        const shuffled = [...w].sort(() => Math.random() - 0.5)
        setWords(shuffled)
      })
      .catch(() => { /* offline */ })
  }, [userId])

  const currentWord = words[currentIndex]
  const targetText = mode === 'phrase' && customPhrase.trim()
    ? customPhrase.trim()
    : currentWord?.lemma ?? 'hello'

  // Draw waveforms when data changes
  useEffect(() => {
    if (ttsCanvasRef.current) drawWaveform(ttsCanvasRef.current, ttsWaveform, '#3b82f6', ttsPlaying)
  }, [ttsWaveform, ttsPlaying])

  useEffect(() => {
    if (recCanvasRef.current) drawWaveform(recCanvasRef.current, recWaveform, '#ef4444', recordingPlaying)
  }, [recWaveform, recordingPlaying])

  // Listen (TTS)
  const handleListen = useCallback(async () => {
    setTtsPlaying(true)
    try {
      await speakText(targetText, activeLanguage)
    } catch {
      toast.error('Text-to-speech not available')
    }
    setTtsPlaying(false)
  }, [targetText, activeLanguage])

  // Record
  const handleStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setRecording(prev => ({ ...prev, isRecording: false, audioUrl: url }))

        // Analyze waveform
        getWaveformData(url).then(setRecWaveform).catch(() => {})

        // Clean up stream
        stream.getTracks().forEach(t => t.stop())
      }

      recorder.start()
      setRecording({ isRecording: true, audioUrl: null, stream, recorder })
      setSelfRating(null)
    } catch {
      toast.error('Microphone access denied. Please allow microphone access in your browser settings.')
    }
  }, [])

  const handleStopRecording = useCallback(() => {
    if (recording.recorder && recording.recorder.state !== 'inactive') {
      recording.recorder.stop()
    }
  }, [recording.recorder])

  // Play recording
  const handlePlayRecording = useCallback(() => {
    if (!recording.audioUrl) return
    if (recAudioRef.current) {
      recAudioRef.current.pause()
    }
    const audio = new Audio(recording.audioUrl)
    recAudioRef.current = audio
    setRecordingPlaying(true)
    audio.onended = () => setRecordingPlaying(false)
    audio.play()
  }, [recording.audioUrl])

  // Next word
  const handleNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % Math.max(1, words.length))
    setRecording({ isRecording: false, audioUrl: null, stream: null, recorder: null })
    setRecWaveform(null)
    setTtsWaveform(null)
    setSelfRating(null)
  }, [words.length])

  const ratingLabels = ['Needs work', 'Getting there', 'Good', 'Great', 'Perfect!']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Pronunciation Lab</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Listen, record, compare, and improve</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('word')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${mode === 'word' ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'}`}
          >
            Words
          </button>
          <button
            onClick={() => setMode('phrase')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${mode === 'phrase' ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'}`}
          >
            Custom Phrase
          </button>
        </div>
      </div>

      {/* Target Text */}
      <motion.div
        key={currentIndex + mode}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center"
      >
        {mode === 'phrase' ? (
          <input
            type="text"
            value={customPhrase}
            onChange={e => setCustomPhrase(e.target.value)}
            placeholder="Type a phrase to practice..."
            className="w-full text-center text-xl font-bold text-[var(--color-text-primary)] bg-transparent border-none outline-none placeholder:text-[var(--color-text-muted)]"
          />
        ) : (
          <>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{currentWord?.lemma ?? 'No words loaded'}</p>
            {currentWord?.pronunciation && (
              <p className="text-sm text-[var(--color-text-muted)] mt-1 font-mono">{currentWord.pronunciation}</p>
            )}
            {currentWord?.translation && (
              <p className="text-sm text-[var(--color-primary-main)] mt-1">{currentWord.translation}</p>
            )}
          </>
        )}
      </motion.div>

      {/* Waveform Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* TTS Waveform */}
        <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Native</span>
            <button
              onClick={handleListen}
              disabled={ttsPlaying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer border-none transition-colors"
            >
              {ttsPlaying ? (
                <><span className="animate-pulse">&#9654;</span> Playing...</>
              ) : (
                <><span>&#128266;</span> Listen</>
              )}
            </button>
          </div>
          <canvas
            ref={ttsCanvasRef}
            width={300}
            height={60}
            className="w-full h-[60px] rounded-lg bg-white/50 dark:bg-black/20"
          />
        </div>

        {/* Recording Waveform */}
        <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Your Voice</span>
            <div className="flex items-center gap-2">
              {recording.audioUrl && (
                <button
                  onClick={handlePlayRecording}
                  disabled={recordingPlaying}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 cursor-pointer border-none transition-colors"
                >
                  {recordingPlaying ? '&#9654; Playing...' : '&#9654; Play'}
                </button>
              )}
              <button
                onClick={recording.isRecording ? handleStopRecording : handleStartRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none transition-colors ${
                  recording.isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {recording.isRecording ? (
                  <><span>&#9632;</span> Stop</>
                ) : (
                  <><span>&#9679;</span> Record</>
                )}
              </button>
            </div>
          </div>
          <canvas
            ref={recCanvasRef}
            width={300}
            height={60}
            className="w-full h-[60px] rounded-lg bg-white/50 dark:bg-black/20"
          />
        </div>
      </div>

      {/* Self Assessment */}
      <AnimatePresence>
        {recording.audioUrl && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <p className="text-xs font-bold text-[var(--color-text-primary)] mb-3">How did you sound?</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => setSelfRating(rating)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
                    selfRating === rating
                      ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)] scale-105'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                  }`}
                >
                  {'&#11088;'.repeat(rating)}
                </button>
              ))}
            </div>
            {selfRating && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-[var(--color-text-muted)] text-center mt-2"
              >
                {ratingLabels[selfRating - 1]}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      {mode === 'word' && words.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">
            {currentIndex + 1} / {words.length}
          </span>
          <button
            onClick={handleNext}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary-main)] text-white hover:bg-[var(--color-primary-dark)] cursor-pointer border-none transition-colors"
          >
            Next Word
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3">
        <p className="text-xs font-bold text-[var(--color-text-primary)] mb-1">Tips</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
          <li>1. Click "Listen" to hear the native pronunciation</li>
          <li>2. Click "Record" and say the word or phrase</li>
          <li>3. Play back your recording and compare side by side</li>
          <li>4. Rate yourself honestly to track improvement</li>
        </ul>
      </div>
    </div>
  )
}
