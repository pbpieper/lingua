import { useState } from 'react'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { usePreferences } from '@/hooks/usePreferences'
import { isRTL } from '@/lib/csvParser'
import * as api from '@/services/vocabApi'
import type { WritingCheck } from '@/services/vocabApi'

const LANGUAGES = [
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'he', label: 'Hebrew' },
  { code: 'en', label: 'English' },
]

const PROMPTS: Record<string, string[]> = {
  de: [
    'Beschreibe deinen Tagesablauf.',
    'Schreibe über dein Lieblingsessen.',
    'Erzähle von einer Reise, die du gemacht hast.',
    'Beschreibe das Wetter heute.',
    'Schreibe einen kurzen Brief an einen Freund.',
    'Was machst du am Wochenende gern?',
    'Beschreibe deine Wohnung oder dein Haus.',
    'Erzähle von deinem Lieblingsbuch oder Film.',
    'Was würdest du machen, wenn du unsichtbar wärst?',
    'Beschreibe deine Familie.',
    'Was hast du gestern gemacht?',
    'Schreibe über deinen Traumberuf.',
    'Beschreibe deine Stadt.',
    'Was ist dein liebstes Hobby und warum?',
    'Schreibe über eine besondere Erinnerung.',
  ],
  es: [
    'Describe tu rutina diaria.',
    'Escribe sobre tu comida favorita.',
    'Cuenta una historia sobre un viaje.',
    'Describe el clima de hoy.',
    'Escribe una carta corta a un amigo.',
    'Qué te gusta hacer los fines de semana?',
    'Describe tu casa o apartamento.',
    'Habla de tu libro o película favorita.',
    'Qué harías si fueras invisible?',
    'Describe a tu familia.',
    'Qué hiciste ayer?',
    'Escribe sobre tu trabajo soñado.',
    'Describe tu ciudad.',
    'Cuál es tu pasatiempo favorito y por qué?',
    'Escribe sobre un recuerdo especial.',
  ],
  fr: [
    'Décris ta routine quotidienne.',
    'Écris sur ton plat préféré.',
    'Raconte une histoire de voyage.',
    'Décris le temps qu\'il fait aujourd\'hui.',
    'Écris une courte lettre à un ami.',
    'Que fais-tu le week-end?',
    'Décris ton appartement ou ta maison.',
    'Parle de ton livre ou film préféré.',
    'Que ferais-tu si tu étais invisible?',
    'Décris ta famille.',
    'Qu\'as-tu fait hier?',
    'Écris sur ton métier de rêve.',
    'Décris ta ville.',
    'Quel est ton passe-temps préféré et pourquoi?',
    'Écris sur un souvenir spécial.',
  ],
  ar: [
    'صف روتينك اليومي.',
    'اكتب عن أكلتك المفضلة.',
    'احكِ قصة عن رحلة قمت بها.',
    'صف الطقس اليوم.',
    'اكتب رسالة قصيرة إلى صديق.',
    'ماذا تحب أن تفعل في عطلة نهاية الأسبوع؟',
    'صف منزلك أو شقتك.',
    'تحدث عن كتابك أو فيلمك المفضل.',
    'ماذا ستفعل لو كنت غير مرئي؟',
    'صف عائلتك.',
    'ماذا فعلت أمس؟',
    'اكتب عن وظيفة أحلامك.',
    'صف مدينتك.',
    'ما هي هوايتك المفضلة ولماذا؟',
    'اكتب عن ذكرى خاصة.',
  ],
  _default: [
    'Describe your daily routine.',
    'Write about your favorite meal.',
    'Tell a story about a trip.',
    'Describe the weather today.',
    'Write a short letter to a friend.',
    'What do you like to do on weekends?',
    'Describe your home.',
    'Talk about your favorite book or movie.',
    'What would you do if you were invisible?',
    'Describe your family.',
    'What did you do yesterday?',
    'Write about your dream job.',
    'Describe your city.',
    'What is your favorite hobby and why?',
    'Write about a special memory.',
  ],
}

function getPrompts(lang: string): string[] {
  return PROMPTS[lang] ?? PROMPTS._default
}

function getRandomPrompt(lang: string): string {
  const list = getPrompts(lang)
  return list[Math.floor(Math.random() * list.length)]
}

type Phase = 'setup' | 'writing' | 'results'

const ERROR_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  grammar: { bg: 'rgba(239,68,68,0.12)', text: 'var(--color-incorrect)', label: 'Grammar' },
  spelling: { bg: 'rgba(249,115,22,0.12)', text: '#f97316', label: 'Spelling' },
  word_choice: { bg: 'rgba(59,130,246,0.12)', text: 'var(--color-primary-main)', label: 'Word Choice' },
  style: { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', label: 'Style' },
}

function ErrorTypeBadge({ type }: { type: string }) {
  const style = ERROR_TYPE_STYLES[type] ?? ERROR_TYPE_STYLES.grammar
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-bold uppercase"
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}

function ScoreDisplay({ score }: { score: number }) {
  let color: string
  if (score < 50) color = 'var(--color-incorrect)'
  else if (score < 75) color = '#f97316'
  else if (score < 90) color = 'var(--color-correct)'
  else color = 'var(--color-primary-main)'

  return (
    <div className="text-center py-6">
      <div className="text-6xl font-bold mb-2" style={{ color }}>
        {score}
      </div>
      <p className="text-sm font-medium text-[var(--color-text-muted)]">
        Writing Score
      </p>
    </div>
  )
}

export function WritingPractice() {
  const { userId, hubAvailable } = useApp()
  const { prefs } = usePreferences()

  const [phase, setPhase] = useState<Phase>('setup')
  const [language, setLanguage] = useState(prefs.defaultLangFrom || 'de')
  const [promptMode, setPromptMode] = useState<'free' | 'random' | 'custom'>('random')
  const [customPrompt, setCustomPrompt] = useState('')
  const [activePrompt, setActivePrompt] = useState('')
  const [text, setText] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<WritingCheck | null>(null)

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const rtl = isRTL(language)

  function startWriting() {
    let prompt = ''
    if (promptMode === 'random') {
      prompt = getRandomPrompt(language)
    } else if (promptMode === 'custom') {
      prompt = customPrompt.trim()
      if (!prompt) {
        toast.error('Please enter a writing prompt')
        return
      }
    }
    setActivePrompt(prompt)
    setText('')
    setResult(null)
    setPhase('writing')
  }

  async function handleCheck() {
    if (!text.trim()) {
      toast.error('Write something first!')
      return
    }
    setChecking(true)
    try {
      const res = await api.checkWriting(userId, text.trim(), language, activePrompt)
      setResult(res)
      setPhase('results')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check writing')
    } finally {
      setChecking(false)
    }
  }

  function resetToSetup() {
    setPhase('setup')
    setText('')
    setResult(null)
    setActivePrompt('')
  }

  function newPrompt() {
    setActivePrompt(getRandomPrompt(language))
    setText('')
    setResult(null)
    setPhase('writing')
  }

  // ── Setup Phase ──
  if (phase === 'setup') {
    return (
      <div>
        <h2
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Writing Practice
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          {hubAvailable
            ? 'Practice writing in your target language and get AI-powered correction and feedback.'
            : 'Practice writing in your target language. AI correction is unavailable offline \u2014 self-check your work.'}
        </p>

        <div
          className="rounded-xl p-6 space-y-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {/* Language selector */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Target Language
            </label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Prompt mode */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Writing Prompt
            </label>
            <div className="flex gap-2 mb-3">
              {([['free', 'Free Write'], ['random', 'Random Prompt'], ['custom', 'Custom']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setPromptMode(mode)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  style={{
                    background: promptMode === mode ? 'var(--color-primary-main)' : 'var(--color-bg)',
                    color: promptMode === mode ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${promptMode === mode ? 'var(--color-primary-main)' : 'var(--color-border)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {promptMode === 'custom' && (
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Enter your writing prompt..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            )}

            {promptMode === 'free' && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Write about anything you want. No prompt will be shown.
              </p>
            )}

            {promptMode === 'random' && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                A random writing prompt will be generated for you.
              </p>
            )}
          </div>

          <button
            onClick={startWriting}
            className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
            style={{
              background: 'var(--color-primary-main)',
              color: '#fff',
              border: 'none',
            }}
          >
            Start Writing
          </button>
        </div>
      </div>
    )
  }

  // ── Writing Phase ──
  if (phase === 'writing') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={resetToSetup}
            className="text-sm cursor-pointer"
            style={{ color: 'var(--color-primary-main)', background: 'none', border: 'none' }}
          >
            &larr; Back
          </button>
          <h2
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Writing Practice
          </h2>
        </div>

        {activePrompt && (
          <div
            className="rounded-lg px-4 py-3 mb-4"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              direction: rtl ? 'rtl' : 'ltr',
            }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)', direction: 'ltr' }}>
              Prompt
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {activePrompt}
            </p>
          </div>
        )}

        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={rtl ? '...اكتب هنا' : 'Start writing here...'}
            rows={10}
            autoFocus
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              direction: rtl ? 'rtl' : 'ltr',
              textAlign: rtl ? 'right' : 'left',
              minHeight: '200px',
            }}
          />

          {!hubAvailable && (
            <div
              className="rounded-lg px-3 py-2 text-xs mt-3"
              style={{
                background: 'var(--color-accent-faded)',
                border: '1px solid var(--color-accent-light)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <strong>Offline Mode:</strong> AI correction is unavailable. Write freely and self-check your work, or start the Creative Hub backend for AI-powered feedback.
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
            <div className="flex gap-2">
              {!hubAvailable && (
                <button
                  onClick={() => {
                    toast.success('Great job practicing! Review your writing carefully.')
                    resetToSetup()
                  }}
                  disabled={!text.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Done (Self-Check)
                </button>
              )}
              <button
                onClick={handleCheck}
                disabled={checking || !text.trim() || !hubAvailable}
                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: hubAvailable ? 'var(--color-primary-main)' : 'var(--color-gray-200)',
                  color: hubAvailable ? '#fff' : 'var(--color-text-muted)',
                  border: 'none',
                }}
              >
                {checking ? 'Checking...' : 'Check Writing'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Results Phase ──
  if (phase === 'results' && result) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={resetToSetup}
            className="text-sm cursor-pointer"
            style={{ color: 'var(--color-primary-main)', background: 'none', border: 'none' }}
          >
            &larr; Back
          </button>
          <h2
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Results
          </h2>
        </div>

        {/* Score */}
        <div
          className="rounded-xl mb-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <ScoreDisplay score={result.score} />
        </div>

        {/* Feedback */}
        {result.feedback && (
          <div
            className="rounded-xl px-5 py-4 mb-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {result.feedback}
            </p>
          </div>
        )}

        {/* Corrected text comparison */}
        <div
          className="rounded-xl px-5 py-4 mb-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Your Text vs Corrected
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Original
              </p>
              <div
                className="rounded-lg px-3 py-2 text-sm leading-relaxed"
                style={{
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)',
                  direction: rtl ? 'rtl' : 'ltr',
                  textAlign: rtl ? 'right' : 'left',
                }}
              >
                {text}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Corrected
              </p>
              <div
                className="rounded-lg px-3 py-2 text-sm leading-relaxed"
                style={{
                  background: 'var(--color-bg)',
                  color: 'var(--color-correct, var(--color-text-primary))',
                  direction: rtl ? 'rtl' : 'ltr',
                  textAlign: rtl ? 'right' : 'left',
                }}
              >
                {result.corrected_text}
              </div>
            </div>
          </div>
        </div>

        {/* Errors list */}
        {result.errors.length > 0 && (
          <div
            className="rounded-xl px-5 py-4 mb-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Errors ({result.errors.length})
            </h3>
            <div className="space-y-3">
              {result.errors.map((err, i) => (
                <div
                  key={i}
                  className="rounded-lg px-4 py-3"
                  style={{ background: 'var(--color-bg)' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="line-through text-sm"
                        style={{ color: 'var(--color-incorrect)' }}
                      >
                        {err.original}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)' }}>&rarr;</span>
                      <span
                        className="font-medium text-sm"
                        style={{ color: 'var(--color-correct)' }}
                      >
                        {err.correction}
                      </span>
                    </div>
                    <ErrorTypeBadge type={err.type} />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {err.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.errors.length === 0 && (
          <div
            className="rounded-xl px-5 py-4 mb-4 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--color-correct)' }}>
              No errors found! Great job!
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setText('')
              setResult(null)
              setPhase('writing')
            }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            Write Again
          </button>
          <button
            onClick={newPrompt}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
            style={{
              background: 'var(--color-primary-main)',
              color: '#fff',
              border: 'none',
            }}
          >
            New Prompt
          </button>
        </div>
      </div>
    )
  }

  return null
}
