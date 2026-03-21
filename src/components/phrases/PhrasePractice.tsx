import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { generatePhraseScenario } from '@/services/vocabApi'
import type { PhraseScenario, PhraseEntry, DialogueLine } from '@/services/vocabApi'
import { useLearningLocales } from '@/hooks/useLearningLocales'

const LANGUAGES = [
  'German', 'Spanish', 'French', 'Italian', 'Portuguese',
  'Japanese', 'Mandarin', 'Arabic', 'Korean', 'Russian',
  'Dutch', 'Turkish', 'Polish', 'Swedish', 'Hindi',
  'Chinese', 'English',
]

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const SCENARIO_CATEGORIES = [
  { label: 'Travel', scenarios: ['Ordering at a restaurant', 'Checking into a hotel', 'Asking for directions', 'Buying a train ticket', 'At the airport'] },
  { label: 'Daily Life', scenarios: ['Grocery shopping', 'Visiting the doctor', 'Making a phone call', 'At the bank', 'Renting an apartment'] },
  { label: 'Social', scenarios: ['Introducing yourself', 'Making small talk', 'Inviting someone out', 'Giving compliments', 'Saying goodbye'] },
  { label: 'Work', scenarios: ['Job interview', 'Meeting a colleague', 'Giving a presentation', 'Scheduling a meeting', 'Asking for help at work'] },
  { label: 'Emergency', scenarios: ['Calling for help', 'Reporting an accident', 'At the pharmacy', 'Lost luggage', 'Car breakdown'] },
]

type Phase = 'picker' | 'loading' | 'scenario'
type View = 'phrases' | 'dialogue' | 'practice'

export function PhrasePractice() {
  const { targetName, nativeName } = useLearningLocales()
  const [phase, setPhase] = useState<Phase>('picker')
  const [language, setLanguage] = useState(targetName || 'German')
  const [level, setLevel] = useState('A2')
  const [customSituation, setCustomSituation] = useState('')
  const [selectedSituation, setSelectedSituation] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState(0)
  const [scenario, setScenario] = useState<PhraseScenario | null>(null)
  const [view, setView] = useState<View>('phrases')
  const [revealedPhrases, setRevealedPhrases] = useState<Set<number>>(new Set())
  const [revealedDialogue, setRevealedDialogue] = useState<Set<number>>(new Set())
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({})
  const [practiceChecked, setPracticeChecked] = useState<Set<number>>(new Set())

  async function handleGenerate() {
    const situation = customSituation.trim() || selectedSituation
    if (!situation) {
      toast.error('Pick or type a situation')
      return
    }
    setPhase('loading')
    try {
      const result = await generatePhraseScenario(situation, level, language, nativeName)
      setScenario(result)
      setView('phrases')
      setRevealedPhrases(new Set())
      setRevealedDialogue(new Set())
      setPracticeAnswers({})
      setPracticeChecked(new Set())
      setPhase('scenario')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
      setPhase('picker')
    }
  }

  function handleBack() {
    setPhase('picker')
    setScenario(null)
  }

  // --- Picker ---
  if (phase === 'picker') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Phrase Practice</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Learn practical phrases for real-world situations</p>
        </div>

        {/* Language & Level */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)]"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Level</label>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)]"
            >
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Category tabs */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Situation</label>
          <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
            {SCENARIO_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(i)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer border-none transition-colors"
                style={{
                  background: activeCategory === i ? 'var(--color-primary-main)' : 'var(--color-surface-alt)',
                  color: activeCategory === i ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Scenario chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {SCENARIO_CATEGORIES[activeCategory].scenarios.map(s => (
              <button
                key={s}
                onClick={() => { setSelectedSituation(s); setCustomSituation('') }}
                className="px-3 py-2 rounded-lg text-sm cursor-pointer border transition-colors"
                style={{
                  background: selectedSituation === s ? 'var(--color-primary-faded)' : 'var(--color-surface)',
                  borderColor: selectedSituation === s ? 'var(--color-primary-main)' : 'var(--color-border)',
                  color: selectedSituation === s ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
                  fontWeight: selectedSituation === s ? 600 : 400,
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Custom situation */}
          <input
            type="text"
            value={customSituation}
            onChange={e => { setCustomSituation(e.target.value); if (e.target.value) setSelectedSituation(null) }}
            placeholder="Or type your own situation..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={!customSituation.trim() && !selectedSituation}
          className="w-full py-3 rounded-xl text-white font-bold text-sm cursor-pointer border-none transition-opacity"
          style={{
            background: 'var(--color-primary-main)',
            opacity: (!customSituation.trim() && !selectedSituation) ? 0.5 : 1,
          }}
        >
          Generate Phrases
        </button>
      </div>
    )
  }

  // --- Loading ---
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-3 border-[var(--color-primary-main)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-muted)]">Generating phrases for: {customSituation || selectedSituation}...</p>
      </div>
    )
  }

  // --- Scenario View ---
  if (!scenario) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={handleBack}
            className="text-xs text-[var(--color-primary-main)] cursor-pointer border-none bg-transparent mb-1 hover:underline"
          >
            &larr; New scenario
          </button>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{scenario.situation}</h2>
          <p className="text-xs text-[var(--color-text-muted)]">{language} &middot; {level}</p>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {(['phrases', 'dialogue', 'practice'] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-4 py-2 text-sm font-medium cursor-pointer border-none bg-transparent transition-colors capitalize"
            style={{
              color: view === v ? 'var(--color-primary-main)' : 'var(--color-text-muted)',
              borderBottom: view === v ? '2px solid var(--color-primary-main)' : '2px solid transparent',
            }}
          >
            {v === 'phrases' ? `Phrases (${scenario.phrases.length})` : v === 'dialogue' ? 'Dialogue' : 'Practice'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {view === 'phrases' && (
          <motion.div
            key="phrases"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {scenario.phrases.map((p, i) => (
              <PhraseCard
                key={i}
                phrase={p}
                revealed={revealedPhrases.has(i)}
                onReveal={() => setRevealedPhrases(prev => new Set(prev).add(i))}
              />
            ))}
            <button
              onClick={() => setRevealedPhrases(new Set(scenario.phrases.map((_, i) => i)))}
              className="text-xs text-[var(--color-primary-main)] cursor-pointer border-none bg-transparent hover:underline"
            >
              Reveal all
            </button>
          </motion.div>
        )}

        {view === 'dialogue' && (
          <motion.div
            key="dialogue"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-1"
          >
            {scenario.dialogue.map((line, i) => (
              <DialogueCard
                key={i}
                line={line}
                index={i}
                revealed={revealedDialogue.has(i)}
                onReveal={() => setRevealedDialogue(prev => new Set(prev).add(i))}
              />
            ))}
            <button
              onClick={() => setRevealedDialogue(new Set(scenario.dialogue.map((_, i) => i)))}
              className="text-xs text-[var(--color-primary-main)] cursor-pointer border-none bg-transparent hover:underline mt-2"
            >
              Show all translations
            </button>
          </motion.div>
        )}

        {view === 'practice' && (
          <motion.div
            key="practice"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <p className="text-sm text-[var(--color-text-muted)]">
              Translate these phrases into {language}:
            </p>
            {scenario.phrases.map((p, i) => {
              const checked = practiceChecked.has(i)
              const answer = practiceAnswers[i] || ''
              const isCorrect = checked && answer.toLowerCase().trim() === p.phrase.toLowerCase().trim()
              return (
                <div key={i} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {p.translation}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] italic">{p.context}</p>
                  <input
                    type="text"
                    value={answer}
                    onChange={e => setPracticeAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                    disabled={checked}
                    placeholder={`Type in ${language}...`}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      borderColor: checked ? (isCorrect ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)') : 'var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text-primary)',
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !checked) {
                        setPracticeChecked(prev => new Set(prev).add(i))
                      }
                    }}
                  />
                  {!checked && answer.trim() && (
                    <button
                      onClick={() => setPracticeChecked(prev => new Set(prev).add(i))}
                      className="text-xs px-3 py-1 rounded-lg bg-[var(--color-primary-main)] text-white border-none cursor-pointer"
                    >
                      Check
                    </button>
                  )}
                  {checked && (
                    <div className="text-xs">
                      {isCorrect ? (
                        <span className="text-green-500 font-semibold">Correct!</span>
                      ) : (
                        <div>
                          <span className="text-red-400">Answer: </span>
                          <span className="font-semibold text-[var(--color-text-primary)]">{p.phrase}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {practiceChecked.size === scenario.phrases.length && (
              <div className="text-center py-3">
                <p className="text-lg font-bold text-[var(--color-text-primary)]">
                  {scenario.phrases.filter((_, i) => {
                    const a = practiceAnswers[i] || ''
                    return a.toLowerCase().trim() === scenario.phrases[i].phrase.toLowerCase().trim()
                  }).length} / {scenario.phrases.length} correct
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cultural notes & vocabulary */}
      {scenario.cultural_notes && (
        <div className="p-3 rounded-lg bg-[var(--color-accent-faded)] border border-[var(--color-accent-main)]">
          <p className="text-xs font-semibold text-[var(--color-accent-dark)] mb-1">Cultural Notes</p>
          <p className="text-sm text-[var(--color-text-primary)]">{scenario.cultural_notes}</p>
        </div>
      )}

      {scenario.key_vocabulary && scenario.key_vocabulary.length > 0 && (
        <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Key Vocabulary</p>
          <div className="flex flex-wrap gap-2">
            {scenario.key_vocabulary.map((v, i) => (
              <span key={i} className="px-2 py-1 rounded-md text-xs bg-[var(--color-primary-faded)] text-[var(--color-primary-dark)]">
                <strong>{v.word}</strong> — {v.translation} <span className="text-[var(--color-text-muted)]">({v.part_of_speech})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PhraseCard({ phrase, revealed, onReveal }: {
  phrase: PhraseEntry
  revealed: boolean
  onReveal: () => void
}) {
  return (
    <div
      onClick={!revealed ? onReveal : undefined}
      className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer transition-colors hover:border-[var(--color-primary-main)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{phrase.translation}</p>
          {revealed ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <p className="text-sm font-bold text-[var(--color-primary-main)] mt-1">{phrase.phrase}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 italic">{phrase.context}</p>
            </motion.div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Tap to reveal</p>
          )}
        </div>
        {phrase.formality && revealed && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
            {phrase.formality}
          </span>
        )}
      </div>
    </div>
  )
}

function DialogueCard({ line, index, revealed, onReveal }: {
  line: DialogueLine
  index: number
  revealed: boolean
  onReveal: () => void
}) {
  const isA = line.speaker === 'A' || index % 2 === 0

  return (
    <div className={`flex ${isA ? 'justify-start' : 'justify-end'}`}>
      <div
        onClick={!revealed ? onReveal : undefined}
        className="max-w-[80%] p-3 rounded-2xl cursor-pointer"
        style={{
          background: isA ? 'var(--color-primary-faded)' : 'var(--color-surface-alt)',
          borderBottomLeftRadius: isA ? 4 : undefined,
          borderBottomRightRadius: isA ? undefined : 4,
        }}
      >
        <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-0.5">
          {line.speaker || (isA ? 'Person A' : 'Person B')}
        </p>
        <p className="text-sm text-[var(--color-text-primary)]">{line.line}</p>
        {revealed ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-[var(--color-text-muted)] mt-1 italic"
          >
            {line.translation}
          </motion.p>
        ) : (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Tap for translation</p>
        )}
      </div>
    </div>
  )
}
