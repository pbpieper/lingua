import React, { useState, useRef, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { generateGrammarLesson } from '@/services/vocabApi'
import type { GrammarLesson, GrammarExercise } from '@/services/vocabApi'
import { useLearningLocales } from '@/hooks/useLearningLocales'

// ── Constants ──

const LANGUAGES = [
  'German', 'Spanish', 'French', 'Italian', 'Portuguese',
  'Japanese', 'Mandarin', 'Arabic', 'Korean', 'Russian',
  'Dutch', 'Turkish', 'Chinese', 'English',
]

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const TOPICS_BY_LEVEL: Record<string, string[]> = {
  A1: ['Present tense', 'Articles', 'Plurals', 'Basic word order', 'Negation', 'Numbers'],
  A2: ['Past tense', 'Prepositions', 'Adjectives', 'Comparisons', 'Modal verbs', 'Pronouns'],
  B1: ['Subjunctive', 'Passive voice', 'Relative clauses', 'Conditionals', 'Indirect speech', 'Conjunctions'],
  B2: ['Participial phrases', 'Advanced subjunctive', 'Nominalizations', 'Stylistic inversions'],
  C1: ['Participial phrases', 'Advanced subjunctive', 'Nominalizations', 'Stylistic inversions'],
  C2: ['Participial phrases', 'Advanced subjunctive', 'Nominalizations', 'Stylistic inversions'],
}

type Phase = 'picker' | 'loading' | 'lesson'

// ── Exercise State ──

interface ExerciseState {
  userAnswer: string
  submitted: boolean
  correct: boolean | null
}

// ── Highlight helper ──

function highlightText(text: string, highlight: string): React.ReactElement {
  if (!highlight) return <>{text}</>
  const idx = text.toLowerCase().indexOf(highlight.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: 'var(--color-primary-main)' }}>
        {text.slice(idx, idx + highlight.length)}
      </strong>
      {text.slice(idx + highlight.length)}
    </>
  )
}

// ── Component ──

export function GrammarLessons() {
  const { targetName, nativeName } = useLearningLocales()
  const [phase, setPhase] = useState<Phase>('picker')
  const [language, setLanguage] = useState(targetName || 'German')
  const [level, setLevel] = useState('A1')
  const [customTopic, setCustomTopic] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [lesson, setLesson] = useState<GrammarLesson | null>(null)
  const [exerciseStates, setExerciseStates] = useState<ExerciseState[]>([])
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([])

  const topics = TOPICS_BY_LEVEL[level] ?? TOPICS_BY_LEVEL.B2

  const score = exerciseStates.filter(s => s.submitted && s.correct).length
  const totalAnswered = exerciseStates.filter(s => s.submitted).length

  async function handleGenerate() {
    const topic = customTopic.trim() || selectedTopic
    if (!topic) {
      toast.error('Pick or type a topic first')
      return
    }
    setPhase('loading')
    try {
      const result = await generateGrammarLesson(topic, language, level, nativeName)
      setLesson(result)
      setExerciseStates(result.exercises.map(() => ({ userAnswer: '', submitted: false, correct: null })))
      setPhase('lesson')
    } catch (err) {
      toast.error('Failed to generate lesson. Is the backend running?')
      setPhase('picker')
    }
  }

  function handleBack() {
    setPhase('picker')
    setLesson(null)
    setExerciseStates([])
    setCustomTopic('')
    setSelectedTopic(null)
  }

  function normalizeAnswer(s: string): string {
    return s.trim().toLowerCase().replace(/[.!?,;:'"]/g, '').replace(/\s+/g, ' ')
  }

  function handleSubmitExercise(idx: number) {
    if (!lesson) return
    const ex = lesson.exercises[idx]
    const state = exerciseStates[idx]
    if (state.submitted) return

    const isCorrect = normalizeAnswer(state.userAnswer) === normalizeAnswer(ex.answer)
    setExerciseStates(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], submitted: true, correct: isCorrect }
      return next
    })
  }

  function handleExerciseInput(idx: number, value: string) {
    setExerciseStates(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], userAnswer: value }
      return next
    })
  }

  function handleKeyDown(e: KeyboardEvent, idx: number) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmitExercise(idx)
    }
  }

  // ── Topic Picker ──

  if (phase === 'picker') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Grammar Lessons
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          AI-generated grammar explanations with interactive exercises
        </p>

        {/* Language selector */}
        <div className="mb-5">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Language
          </label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="w-full max-w-xs px-3 py-2 rounded-lg text-sm border"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              borderColor: 'var(--color-border)',
            }}
          >
            {LANGUAGES.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* CEFR level chips */}
        <div className="mb-5">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            CEFR Level
          </label>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className="px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer border transition-colors"
                style={{
                  background: level === l ? 'var(--color-primary-main)' : 'var(--color-surface)',
                  color: level === l ? '#fff' : 'var(--color-text-secondary)',
                  borderColor: level === l ? 'var(--color-primary-main)' : 'var(--color-border)',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Suggested topics */}
        <div className="mb-5">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Suggested Topics
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {topics.map(t => (
              <button
                key={t}
                onClick={() => { setSelectedTopic(t); setCustomTopic('') }}
                className="px-3 py-2 rounded-lg text-sm text-left cursor-pointer border transition-colors"
                style={{
                  background: selectedTopic === t ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                  color: selectedTopic === t ? 'var(--color-primary-main)' : 'var(--color-text-primary)',
                  borderColor: selectedTopic === t ? 'var(--color-primary-main)' : 'var(--color-border)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Custom topic */}
        <div className="mb-6">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Or type a custom topic
          </label>
          <input
            value={customTopic}
            onChange={e => { setCustomTopic(e.target.value); if (e.target.value) setSelectedTopic(null) }}
            placeholder="e.g. Dative prepositions"
            className="w-full max-w-md px-3 py-2 rounded-lg text-sm border"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              borderColor: 'var(--color-border)',
            }}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!customTopic.trim() && !selectedTopic}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border-none text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Generate Lesson
        </button>
      </div>
    )
  }

  // ── Loading ──

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Generating your grammar lesson...
        </p>
      </div>
    )
  }

  // ── Lesson View ──

  if (!lesson) return null

  return (
    <div>
      {/* Back button */}
      <button
        onClick={handleBack}
        className="mb-4 px-3 py-1.5 rounded-lg text-sm cursor-pointer border bg-transparent transition-colors hover:opacity-80"
        style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
      >
        &larr; Back to topics
      </button>

      {/* Title */}
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
        {lesson.title}
      </h1>

      {/* Explanation card */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{
          background: 'var(--color-primary-bg)',
          border: '1px solid var(--color-primary-main)',
        }}
      >
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-primary-main)' }}>
          Explanation
        </h2>
        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-primary)' }}>
          {lesson.explanation}
        </p>
      </div>

      {/* Examples */}
      {lesson.examples.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Examples
          </h2>
          <div className="flex flex-col gap-3">
            {lesson.examples.map((ex, i) => (
              <div
                key={i}
                className="pl-4 py-3 pr-4 rounded-lg"
                style={{
                  borderLeft: '3px solid var(--color-primary-main)',
                  background: 'var(--color-surface)',
                }}
              >
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  {highlightText(ex.original, ex.highlight)}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {ex.translation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules */}
      {lesson.rules.length > 0 && (
        <div
          className="rounded-xl p-5 mb-6"
          style={{
            background: 'var(--color-accent-bg, var(--color-surface))',
            border: '1px solid var(--color-border)',
          }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Rules
          </h2>
          <ol className="list-decimal list-inside flex flex-col gap-2">
            {lesson.rules.map((rule, i) => (
              <li key={i} className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {rule}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Practice exercises */}
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          Practice
        </h2>
        <AnimatePresence mode="sync">
          <div className="flex flex-col gap-4">
            {lesson.exercises.map((ex, idx) => (
              <ExerciseCard
                key={idx}
                exercise={ex}
                index={idx}
                state={exerciseStates[idx]}
                onInput={v => handleExerciseInput(idx, v)}
                onSubmit={() => handleSubmitExercise(idx)}
                onKeyDown={e => handleKeyDown(e, idx)}
                inputRef={el => { inputRefs.current[idx] = el }}
              />
            ))}
          </div>
        </AnimatePresence>
      </div>

      {/* Score tracker */}
      {totalAnswered > 0 && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-medium mb-6"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          Score: {score} / {totalAnswered} correct
          {totalAnswered === lesson.exercises.length && (
            <span className="ml-2" style={{ color: score === totalAnswered ? 'var(--color-success, #22c55e)' : 'var(--color-text-muted)' }}>
              {score === totalAnswered ? '  Perfect!' : '  Keep practicing!'}
            </span>
          )}
        </div>
      )}

      {/* Generate another */}
      <button
        onClick={handleBack}
        className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer border-none text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--color-primary-main)' }}
      >
        Generate Another Lesson
      </button>
    </div>
  )
}

// ── Exercise Card ──

interface ExerciseCardProps {
  exercise: GrammarExercise
  index: number
  state: ExerciseState
  onInput: (value: string) => void
  onSubmit: () => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  inputRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void
}

function ExerciseCard({ exercise, index, state, onInput, onSubmit, onKeyDown, inputRef }: ExerciseCardProps) {
  const typeLabel = exercise.type === 'fill' ? 'Fill in the blank'
    : exercise.type === 'translate' ? 'Translate'
    : exercise.type === 'correct' ? 'Correct the error'
    : 'Choose the correct option'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl p-4"
      style={{
        background: 'var(--color-surface)',
        border: state.submitted
          ? `1px solid ${state.correct ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)'}`
          : '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--color-primary-bg)',
            color: 'var(--color-primary-main)',
          }}
        >
          {index + 1}. {typeLabel}
        </span>
      </div>

      <p className="text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
        {exercise.prompt}
      </p>

      {exercise.hint && !state.submitted && (
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Hint: {exercise.hint}
        </p>
      )}

      {/* Input area based on type */}
      {exercise.type === 'choose' && exercise.options ? (
        <div className="flex flex-col gap-2 mb-3">
          {exercise.options.map((opt, oi) => (
            <label
              key={oi}
              className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors"
              style={{
                background: state.userAnswer === opt ? 'var(--color-primary-bg)' : 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                opacity: state.submitted ? 0.8 : 1,
              }}
            >
              <input
                type="radio"
                name={`exercise-${index}`}
                value={opt}
                checked={state.userAnswer === opt}
                disabled={state.submitted}
                onChange={() => onInput(opt)}
                className="accent-[var(--color-primary-main)]"
              />
              {opt}
            </label>
          ))}
        </div>
      ) : exercise.type === 'translate' ? (
        <textarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={state.userAnswer}
          onChange={e => onInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={state.submitted}
          rows={2}
          placeholder="Type your translation..."
          className="w-full px-3 py-2 rounded-lg text-sm border mb-3 resize-none"
          style={{
            background: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
            borderColor: 'var(--color-border)',
          }}
        />
      ) : (
        <input
          ref={inputRef as React.Ref<HTMLInputElement>}
          value={state.userAnswer}
          onChange={e => onInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={state.submitted}
          placeholder="Type your answer..."
          className="w-full px-3 py-2 rounded-lg text-sm border mb-3"
          style={{
            background: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
            borderColor: 'var(--color-border)',
          }}
        />
      )}

      {/* Submit button */}
      {!state.submitted && (
        <button
          onClick={onSubmit}
          disabled={!state.userAnswer.trim()}
          className="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-primary-main)' }}
        >
          Check
        </button>
      )}

      {/* Feedback */}
      {state.submitted && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 rounded-lg px-3 py-2 text-sm"
          style={{
            background: state.correct
              ? 'rgba(34, 197, 94, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            color: state.correct
              ? 'var(--color-success, #22c55e)'
              : 'var(--color-error, #ef4444)',
          }}
        >
          {state.correct ? (
            <span>Correct!</span>
          ) : (
            <div>
              <span className="font-medium">Incorrect.</span>{' '}
              <span style={{ color: 'var(--color-text-primary)' }}>
                Answer: <strong>{exercise.answer}</strong>
              </span>
              {exercise.error && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {exercise.error}
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
