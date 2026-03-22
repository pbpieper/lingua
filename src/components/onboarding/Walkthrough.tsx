import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { usePreferences } from '@/hooks/usePreferences'
import type { LinguaToolId } from '@/types/tools'

interface WalkthroughStep {
  toolId: LinguaToolId
  title: string
  description: string
}

const STEPS: WalkthroughStep[] = [
  {
    toolId: 'upload',
    title: 'Upload Your Words',
    description:
      'Start by importing a vocabulary list \u2014 paste words, drop a file, or let AI generate them for you.',
  },
  {
    toolId: 'media',
    title: 'Media Library',
    description:
      'Import poems, songs, dialogues, or articles to read, practice, and memorize in your target language.',
  },
  {
    toolId: 'flashcards',
    title: 'Review with Flashcards',
    description:
      'Review your words with spaced repetition flashcards. Come back daily to build long-term memory.',
  },
  {
    toolId: 'achievements',
    title: 'Track Your Progress',
    description:
      "Earn XP, unlock achievements, and track your learning streak. You're all set!",
  },
]

export function Walkthrough() {
  const { setActiveTool } = useApp()
  const { prefs, setPref } = usePreferences()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useEffect(() => {
    if (prefs.walkthroughDone) return
    // Small delay so the sidebar renders first
    const timer = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(timer)
  }, [prefs.walkthroughDone])

  const positionTooltip = useCallback((toolId: LinguaToolId) => {
    // Find the sidebar button for this tool by searching for buttons with the tool label
    const sidebar = document.querySelector('nav')
    if (!sidebar) return
    const buttons = sidebar.querySelectorAll('button')
    const labels: Record<LinguaToolId, string> = {
      home: 'Home', wordbank: 'Word Bank', upload: 'Upload', media: 'Media Library',
      flashcards: 'Flashcards', match: 'Match', fillblank: 'Fill Blank',
      multichoice: 'Quiz', speedtyping: 'Speed Typing', wordassociation: 'Word Association',
      speaking: 'Speaking', reading: 'Reading',
      prelearn: 'Pre-Learn', listening: 'Listening', writing: 'Writing', cloze: 'Sentence Cloze',
      stories: 'Stories', grammar: 'Grammar', phrases: 'Phrases', universe: 'Universe', teacher: 'School', community: 'Community', achievements: 'Achievements', dashboard: 'Progress', 'feedback-admin': 'Feedback', settings: 'Settings',
      rsvp: 'RSVP Reader', scenarios: 'Scenarios', documents: 'Documents', journey: 'Journey',
      dreamjournal: 'Dream Journal', pronunciationlab: 'Pronunciation', keyboardtrainer: 'Keyboard',
      'skit-trainer': 'Memorize', 'reading-prep': 'Reading Prep', 'sentence-creator': 'Sentence Creator', 'vocab-lifecycle': 'Vocab Lifecycle',
      'reading-hub': 'Reading', 'writing-hub': 'Writing', 'speaking-hub': 'Speaking',
      'listening-hub': 'Listening', 'games-hub': 'Games',
    }
    const label = labels[toolId]
    let targetBtn: Element | null = null
    buttons.forEach(btn => {
      if (btn.textContent?.includes(label)) targetBtn = btn
    })
    if (targetBtn) {
      const rect = (targetBtn as HTMLElement).getBoundingClientRect()
      setTooltipPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 16,
      })
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    const current = STEPS[step]
    if (!current) return
    setActiveTool(current.toolId)
    // Position after a frame so DOM updates
    const raf = requestAnimationFrame(() => positionTooltip(current.toolId))
    return () => cancelAnimationFrame(raf)
  }, [step, visible, setActiveTool, positionTooltip])

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      handleDone()
    }
  }

  const handleDone = () => {
    setPref('walkthroughDone', true)
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]
  if (!current) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={handleDone}>
      {/* Tooltip card */}
      <div
        className="absolute rounded-lg p-5 shadow-xl"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          transform: 'translateY(-50%)',
          maxWidth: 320,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Step indicator */}
        <div className="flex gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full flex-1"
              style={{
                background: i <= step ? 'var(--color-primary-main)' : 'var(--color-border)',
              }}
            />
          ))}
        </div>

        <h3
          className="text-base font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {current.title}
        </h3>
        <p
          className="text-sm leading-relaxed mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {current.description}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={handleDone}
            className="text-xs cursor-pointer bg-transparent border-none"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-none
              text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-primary-main)' }}
          >
            {step < STEPS.length - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  )
}
