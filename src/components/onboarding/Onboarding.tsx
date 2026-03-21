import { useState, useCallback } from 'react'

/* ── Types ─────────────────────────────────────────────── */

export interface OnboardingData {
  completed: boolean
  targetLanguage: string
  nativeLanguage: string
  level: 'beginner' | 'intermediate' | 'advanced'
  goals: string[]
  dailyMinutes: number
  completedAt: string
}

interface Language {
  code: string
  name: string
  flag: string
}

interface Props {
  onComplete: (data: OnboardingData) => void
}

/* ── Data ──────────────────────────────────────────────── */

const LANGUAGES: Language[] = [
  { code: 'ar', name: 'Arabic', flag: '\u{1F1E6}\u{1F1EA}' },
  { code: 'de', name: 'German', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'es', name: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'fr', name: 'French', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'it', name: 'Italian', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'ja', name: 'Japanese', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'ko', name: 'Korean', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: 'nl', name: 'Dutch', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: 'pt', name: 'Portuguese', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'ru', name: 'Russian', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'tr', name: 'Turkish', flag: '\u{1F1F9}\u{1F1F7}' },
  { code: 'zh', name: 'Chinese', flag: '\u{1F1E8}\u{1F1F3}' },
]

const LEVELS = [
  { id: 'beginner' as const, label: 'Beginner', tag: 'A1-A2', desc: 'I know a few words and simple phrases' },
  { id: 'intermediate' as const, label: 'Intermediate', tag: 'B1-B2', desc: 'I can hold a conversation on familiar topics' },
  { id: 'advanced' as const, label: 'Advanced', tag: 'C1-C2', desc: 'I can read news and discuss complex topics' },
]

const GOALS = [
  { id: 'class', label: 'Pass a class or exam' },
  { id: 'travel', label: 'Travel' },
  { id: 'heritage', label: 'Connect with family / heritage' },
  { id: 'career', label: 'Career' },
  { id: 'enrichment', label: 'Personal enrichment' },
  { id: 'media', label: 'Read literature / consume media' },
]

const TIME_OPTIONS = [5, 15, 30, 60]

const TOTAL_STEPS = 5

/* ── Step Indicator ────────────────────────────────────── */

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-2 justify-center mb-10">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: i === current ? 32 : 8,
            background: i === current
              ? 'var(--color-primary-main)'
              : i < current
                ? 'var(--color-primary-light)'
                : 'var(--color-border)',
          }}
        />
      ))}
    </div>
  )
}

/* ── Shared card style ─────────────────────────────────── */

const cardBase =
  'rounded-xl border-2 cursor-pointer transition-all duration-200 select-none'

function selectionCard(selected: boolean) {
  return `${cardBase} ${
    selected
      ? 'border-[var(--color-primary-main)] bg-[var(--color-primary-pale)] shadow-md'
      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-light)] hover:shadow-sm'
  }`
}

/* ── Primary button ────────────────────────────────────── */

function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-8 py-3 rounded-xl font-semibold text-white text-base cursor-pointer
        transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
        hover:brightness-110 active:scale-[0.97]"
      style={{
        background: disabled ? 'var(--color-gray-400)' : 'var(--color-primary-main)',
      }}
    >
      {children}
    </button>
  )
}

/* ── Step 1: Welcome ───────────────────────────────────── */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-6 py-12">
      <div className="text-7xl mb-2">
        {'\u{1F30D}'}
      </div>
      <h1
        className="text-4xl font-bold"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Welcome to Lingua
      </h1>
      <p
        className="text-lg max-w-md"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Your personal language learning companion
      </p>
      <div>
        <PrimaryButton onClick={onNext}>Get Started</PrimaryButton>
      </div>
    </div>
  )
}

/* ── Step 2: Language Selection ─────────────────────────── */

function LanguageStep({
  target,
  setTarget,
  native,
  setNative,
  onNext,
  onBack,
}: {
  target: string
  setTarget: (v: string) => void
  native: string
  setNative: (v: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      {/* Target language */}
      <div>
        <h2
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          What language are you learning?
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Pick your primary target language
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setTarget(lang.code)}
              className={`${selectionCard(target === lang.code)} px-3 py-3 flex flex-col items-center gap-1`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {lang.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Native language */}
      <div>
        <h2
          className="text-xl font-bold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          What's your native language?
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          We'll use this for translations and explanations
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {[
            { code: 'en', name: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
            ...LANGUAGES,
          ].map((lang) => (
            <button
              key={`native-${lang.code}`}
              onClick={() => setNative(lang.code)}
              className={`${selectionCard(native === lang.code)} px-3 py-3 flex flex-col items-center gap-1`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {lang.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl font-medium cursor-pointer
            border border-[var(--color-border)] bg-[var(--color-surface)]
            text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]
            transition-colors"
        >
          Back
        </button>
        <PrimaryButton onClick={onNext} disabled={!target}>
          Continue
        </PrimaryButton>
      </div>
    </div>
  )
}

/* ── Step 3: Proficiency Level ─────────────────────────── */

function LevelStep({
  level,
  setLevel,
  onNext,
  onBack,
}: {
  level: OnboardingData['level'] | null
  setLevel: (v: OnboardingData['level']) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      <div>
        <h2
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          How would you describe your level?
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          This helps us tailor difficulty to you
        </p>
        <div className="flex flex-col gap-4">
          {LEVELS.map((lv) => (
            <button
              key={lv.id}
              onClick={() => setLevel(lv.id)}
              className={`${selectionCard(level === lv.id)} px-5 py-4 text-left flex items-start gap-4`}
            >
              <div
                className="w-5 h-5 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                style={{
                  borderColor:
                    level === lv.id
                      ? 'var(--color-primary-main)'
                      : 'var(--color-gray-300)',
                  background:
                    level === lv.id ? 'var(--color-primary-main)' : 'transparent',
                }}
              >
                {level === lv.id && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {lv.label}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: 'var(--color-primary-faded)',
                      color: 'var(--color-primary-main)',
                    }}
                  >
                    {lv.tag}
                  </span>
                </div>
                <p
                  className="text-sm mt-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {lv.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl font-medium cursor-pointer
            border border-[var(--color-border)] bg-[var(--color-surface)]
            text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]
            transition-colors"
        >
          Back
        </button>
        <PrimaryButton onClick={onNext} disabled={!level}>
          Continue
        </PrimaryButton>
      </div>
    </div>
  )
}

/* ── Step 4: Goals ─────────────────────────────────────── */

function GoalsStep({
  goals,
  toggleGoal,
  dailyMinutes,
  setDailyMinutes,
  onNext,
  onBack,
}: {
  goals: string[]
  toggleGoal: (id: string) => void
  dailyMinutes: number
  setDailyMinutes: (v: number) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      {/* Goals */}
      <div>
        <h2
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          What's your goal?
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
          Select all that apply
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GOALS.map((g) => {
            const selected = goals.includes(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggleGoal(g.id)}
                className={`${selectionCard(selected)} px-4 py-3 flex items-center gap-3 text-left`}
              >
                <div
                  className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors"
                  style={{
                    borderColor: selected
                      ? 'var(--color-primary-main)'
                      : 'var(--color-gray-300)',
                    background: selected
                      ? 'var(--color-primary-main)'
                      : 'transparent',
                  }}
                >
                  {selected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {g.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Daily time */}
      <div>
        <h2
          className="text-xl font-bold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          How much time per day?
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Even a few minutes a day adds up
        </p>
        <div className="flex gap-3">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setDailyMinutes(t)}
              className={`${selectionCard(dailyMinutes === t)} flex-1 py-3 flex flex-col items-center gap-0.5`}
            >
              <span
                className="text-lg font-bold"
                style={{
                  color:
                    dailyMinutes === t
                      ? 'var(--color-primary-main)'
                      : 'var(--color-text-primary)',
                }}
              >
                {t}
              </span>
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                min
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl font-medium cursor-pointer
            border border-[var(--color-border)] bg-[var(--color-surface)]
            text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]
            transition-colors"
        >
          Back
        </button>
        <PrimaryButton onClick={onNext} disabled={goals.length === 0}>
          Continue
        </PrimaryButton>
      </div>
    </div>
  )
}

/* ── Step 5: Ready ─────────────────────────────────────── */

function ReadyStep({
  target,
  native,
  level,
  goals,
  dailyMinutes,
  onBack,
  onFinish,
}: {
  target: string
  native: string
  level: string
  goals: string[]
  dailyMinutes: number
  onBack: () => void
  onFinish: () => void
}) {
  const langName = (code: string) =>
    code === 'en'
      ? 'English'
      : LANGUAGES.find((l) => l.code === code)?.name ?? code
  const langFlag = (code: string) =>
    code === 'en'
      ? '\u{1F1FA}\u{1F1F8}'
      : LANGUAGES.find((l) => l.code === code)?.flag ?? ''
  const levelLabel = LEVELS.find((l) => l.id === level)?.label ?? level
  const goalLabels = goals
    .map((id) => GOALS.find((g) => g.id === id)?.label ?? id)

  return (
    <div className="flex flex-col items-center text-center gap-8 max-w-md mx-auto py-6">
      <div className="text-6xl">
        {'\u{1F680}'}
      </div>

      <div>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          You're all set!
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Here's your learning profile
        </p>
      </div>

      <div
        className="w-full rounded-xl border p-5 text-left flex flex-col gap-3"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <SummaryRow label="Learning" value={`${langFlag(target)} ${langName(target)}`} />
        <SummaryRow label="Native" value={`${langFlag(native)} ${langName(native)}`} />
        <SummaryRow label="Level" value={levelLabel} />
        <SummaryRow label="Daily goal" value={`${dailyMinutes} minutes`} />
        <div>
          <span
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Goals
          </span>
          <div className="flex flex-wrap gap-2 mt-1">
            {goalLabels.map((g) => (
              <span
                key={g}
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: 'var(--color-primary-faded)',
                  color: 'var(--color-primary-main)',
                }}
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4 w-full justify-between pt-2">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl font-medium cursor-pointer
            border border-[var(--color-border)] bg-[var(--color-surface)]
            text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]
            transition-colors"
        >
          Back
        </button>
        <PrimaryButton onClick={onFinish}>Let's go!</PrimaryButton>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      <span
        className="text-sm font-semibold"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  )
}

/* ── Main Onboarding Component ─────────────────────────── */

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  // Form state
  const [targetLang, setTargetLang] = useState('')
  const [nativeLang, setNativeLang] = useState('en')
  const [level, setLevel] = useState<OnboardingData['level'] | null>(null)
  const [goals, setGoals] = useState<string[]>([])
  const [dailyMinutes, setDailyMinutes] = useState(15)

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  }, [])

  const goBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0))
  }, [])

  const toggleGoal = useCallback((id: string) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    )
  }, [])

  const handleFinish = useCallback(() => {
    const data: OnboardingData = {
      completed: true,
      targetLanguage: targetLang,
      nativeLanguage: nativeLang,
      level: level!,
      goals,
      dailyMinutes,
      completedAt: new Date().toISOString(),
    }
    onComplete(data)
  }, [targetLang, nativeLang, level, goals, dailyMinutes, onComplete])

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomeStep onNext={goNext} />
      case 1:
        return (
          <LanguageStep
            target={targetLang}
            setTarget={setTargetLang}
            native={nativeLang}
            setNative={setNativeLang}
            onNext={goNext}
            onBack={goBack}
          />
        )
      case 2:
        return (
          <LevelStep
            level={level}
            setLevel={setLevel}
            onNext={goNext}
            onBack={goBack}
          />
        )
      case 3:
        return (
          <GoalsStep
            goals={goals}
            toggleGoal={toggleGoal}
            dailyMinutes={dailyMinutes}
            setDailyMinutes={setDailyMinutes}
            onNext={goNext}
            onBack={goBack}
          />
        )
      case 4:
        return (
          <ReadyStep
            target={targetLang}
            native={nativeLang}
            level={level!}
            goals={goals}
            dailyMinutes={dailyMinutes}
            onBack={goBack}
            onFinish={handleFinish}
          />
        )
      default:
        return null
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-2xl">
        {step > 0 && <StepDots current={step} total={TOTAL_STEPS} />}

        <div>
          {renderStep()}
        </div>
      </div>
    </div>
  )
}
