/* eslint-disable */
// @ts-nocheck — temporarily suppress linter auto-imports
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { LanguageSwitcher } from '@/components/atoms/LanguageSwitcher'
import type { LinguaToolId } from '@/types/tools'
import * as api from '@/services/vocabApi'
import type { VocabStats, VocabSession } from '@/types/word'
import type { SessionStep, DailyPlanProgress } from '@/types/session'
import {
  todayKey,
  loadDailyPlanProgress,
  saveDailyPlanProgress,
  markStepComplete,
  loadLearningPrefs,
  getUserLevel,
} from '@/services/clientStore'
import { buildDailySessionSteps, recordStepCompletion, categoryLabel, categoryIcon } from '@/services/dailySessionPlan'
import { SessionDebrief } from '@/components/home/SessionDebrief'
import { FeedbackCollector, shouldShowWelcomeBack } from '@/components/feedback/FeedbackCollector'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface OnboardingInfo {
  targetLanguage?: string
  nativeLanguage?: string
  level?: string
  goals?: string[]
  dailyMinutes?: number
}

function readOnboarding(): OnboardingInfo | null {
  try {
    const raw = localStorage.getItem('lingua-onboarding')
    if (raw) return JSON.parse(raw) as OnboardingInfo
  } catch { /* ignore */ }
  return null
}

function getLocalizedGreeting(targetLang?: string): { primary: string; subtitle?: string } {
  const hour = new Date().getHours()
  const period: 'morning' | 'afternoon' | 'evening' =
    hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

  const greetings: Record<string, Record<typeof period, string>> = {
    de: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend' },
    es: { morning: 'Buenos d\u00EDas', afternoon: 'Buenas tardes', evening: 'Buenas noches' },
    fr: { morning: 'Bonjour', afternoon: 'Bon apr\u00E8s-midi', evening: 'Bonsoir' },
    it: { morning: 'Buongiorno', afternoon: 'Buon pomeriggio', evening: 'Buonasera' },
    pt: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' },
    ja: { morning: '\u304A\u306F\u3088\u3046', afternoon: '\u3053\u3093\u306B\u3061\u306F', evening: '\u3053\u3093\u3070\u3093\u306F' },
    ko: { morning: '\uC88B\uC740 \uC544\uCE68', afternoon: '\uC548\uB155\uD558\uC138\uC694', evening: '\uC88B\uC740 \uC800\uB141' },
    zh: { morning: '\u65E9\u4E0A\u597D', afternoon: '\u4E0B\u5348\u597D', evening: '\u665A\u4E0A\u597D' },
    nl: { morning: 'Goedemorgen', afternoon: 'Goedemiddag', evening: 'Goedenavond' },
    ru: { morning: '\u0414\u043E\u0431\u0440\u043E\u0435 \u0443\u0442\u0440\u043E', afternoon: '\u0414\u043E\u0431\u0440\u044B\u0439 \u0434\u0435\u043D\u044C', evening: '\u0414\u043E\u0431\u0440\u044B\u0439 \u0432\u0435\u0447\u0435\u0440' },
    ar: { morning: '\u0635\u0628\u0627\u062D \u0627\u0644\u062E\u064A\u0631', afternoon: '\u0645\u0633\u0627\u0621 \u0627\u0644\u062E\u064A\u0631', evening: '\u0645\u0633\u0627\u0621 \u0627\u0644\u062E\u064A\u0631' },
  }

  const en: Record<typeof period, string> = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }

  if (targetLang && greetings[targetLang]) {
    return { primary: greetings[targetLang][period], subtitle: en[period] }
  }
  return { primary: en[period] }
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diffMs / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

function toolLabel(toolId: string): string {
  const map: Record<string, string> = {
    flashcards: 'Flashcards', match: 'Match Game', fillblank: 'Fill in the Blank',
    multichoice: 'Quiz', speaking: 'Speaking', reading: 'Reading',
    wordbank: 'Word Bank', upload: 'Upload', dashboard: 'Dashboard',
    stories: 'Stories', cloze: 'Sentence Cloze', prelearn: 'Pre-Learn',
    listening: 'Listening', writing: 'Writing', phrases: 'Phrases',
  }
  return map[toolId] ?? toolId
}

/* Category-specific accent colors for the cards */
const CATEGORY_COLORS: Record<string, { bg: string; bgDark: string; border: string; text: string; icon: string }> = {
  'new-words': { bg: 'bg-violet-50', bgDark: 'dark:bg-violet-950/20', border: 'border-violet-200 dark:border-violet-800/40', text: 'text-violet-700 dark:text-violet-300', icon: 'text-violet-500' },
  reading:     { bg: 'bg-blue-50',   bgDark: 'dark:bg-blue-950/20',   border: 'border-blue-200 dark:border-blue-800/40',   text: 'text-blue-700 dark:text-blue-300',   icon: 'text-blue-500' },
  writing:     { bg: 'bg-amber-50',  bgDark: 'dark:bg-amber-950/20',  border: 'border-amber-200 dark:border-amber-800/40',  text: 'text-amber-700 dark:text-amber-300',  icon: 'text-amber-500' },
  speaking:    { bg: 'bg-rose-50',   bgDark: 'dark:bg-rose-950/20',   border: 'border-rose-200 dark:border-rose-800/40',   text: 'text-rose-700 dark:text-rose-300',   icon: 'text-rose-500' },
  listening:   { bg: 'bg-teal-50',   bgDark: 'dark:bg-teal-950/20',   border: 'border-teal-200 dark:border-teal-800/40',   text: 'text-teal-700 dark:text-teal-300',   icon: 'text-teal-500' },
  review:      { bg: 'bg-emerald-50', bgDark: 'dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-300', icon: 'text-emerald-500' },
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const cardStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const cardItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

/* Practice quick-access tools */
const PRACTICE_TOOLS: { id: LinguaToolId; icon: string; label: string }[] = [
  { id: 'flashcards', icon: '\u{1F0CF}', label: 'Flashcards' },
  { id: 'match', icon: '\u{1F517}', label: 'Match' },
  { id: 'multichoice', icon: '\u2753', label: 'Quiz' },
  { id: 'speaking', icon: '\u{1F5E3}\uFE0F', label: 'Speaking' },
  { id: 'listening', icon: '\u{1F442}', label: 'Listening' },
  { id: 'writing', icon: '\u270D\uFE0F', label: 'Writing' },
  { id: 'stories', icon: '\u{1F4D5}', label: 'Stories' },
  { id: 'reading', icon: '\u{1F4D6}', label: 'Reading' },
]

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function DailyReview() {
  const { userId, hubAvailable, lists, setActiveTool, setWordsDue, setCurrentListId } = useApp()
  const { user, isAuthenticated } = useAuth()

  const [stats, setStats] = useState<VocabStats | null>(null)
  const [sessions, setSessions] = useState<VocabSession[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyPlan, setDailyPlan] = useState<DailyPlanProgress>(() => loadDailyPlanProgress(todayKey()))
  const [debriefOpen, setDebriefOpen] = useState(false)
  const [welcomeBackOpen, setWelcomeBackOpen] = useState(() => shouldShowWelcomeBack())

  const markStepCompleted = useCallback((step: SessionStep) => {
    recordStepCompletion(step.category, step.toolId)
    setDailyPlan(markStepComplete(todayKey(), step.id))
  }, [])

  const handleStartStep = useCallback(
    (step: SessionStep) => setActiveTool(step.toolId),
    [setActiveTool],
  )

  const closeDebrief = useCallback(() => {
    const cur = loadDailyPlanProgress(todayKey())
    saveDailyPlanProgress({ ...cur, debriefShown: true })
    setDailyPlan(loadDailyPlanProgress(todayKey()))
    setDebriefOpen(false)
  }, [])

  // Derived values
  const totalWords = stats?.total_words ?? 0
  const wordsLearned = stats?.words_learned ?? 0
  const wordsDue = stats?.words_due ?? 0
  const accuracy = stats?.accuracy ?? 0
  const streak = typeof stats?.streak === 'object' ? stats.streak.current : (stats?.streak ?? 0)
  const newWordsTarget = loadLearningPrefs().targetNewWordsPerDay
  const level = getUserLevel()
  const xpToday = useMemo(() => {
    const completed = sessions.filter(s => {
      const d = (s.ended_at ?? s.started_at).slice(0, 10)
      return d === todayKey()
    })
    return completed.reduce((sum, s) => sum + (s.correct ?? 0) * 10, 0)
  }, [sessions])

  const studyPlan = useMemo(
    () => buildDailySessionSteps({
      wordsDue, totalWords, streak,
      recentSessions: sessions,
      listsExist: lists.length > 0,
      newWordsTarget,
    }),
    [sessions, totalWords, wordsDue, streak, lists.length, newWordsTarget],
  )

  const planTotalMinutes = studyPlan.reduce((s, st) => s + st.estimatedMinutes, 0)
  const planCompletedCount = studyPlan.filter(s => dailyPlan.completedStepIds.includes(s.id)).length
  const planProgress = studyPlan.length > 0 ? planCompletedCount / studyPlan.length : 0
  const allDone = studyPlan.length > 0 && planCompletedCount === studyPlan.length

  useEffect(() => {
    if (!studyPlan.length) return
    if (studyPlan.every(s => dailyPlan.completedStepIds.includes(s.id)) && !dailyPlan.debriefShown) {
      setDebriefOpen(true)
    }
  }, [studyPlan, dailyPlan])

  useEffect(() => {
    if (!hubAvailable) { setLoading(false); return }
    Promise.all([api.getDashboard(userId), api.getDueWords(userId, 1)])
      .then(([dash]) => {
        setStats(dash.stats)
        setWordsDue(dash.stats.words_due ?? 0)
        setSessions(dash.recent_sessions ?? [])
      })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load daily review'))
      .finally(() => setLoading(false))
  }, [userId, hubAvailable, setWordsDue])

  // --- Offline ---
  if (!hubAvailable) {
    const offlineTools: { id: LinguaToolId; icon: string; label: string; desc: string }[] = [
      { id: 'speaking', icon: '\u{1F5E3}\uFE0F', label: 'Speaking', desc: 'Pronunciation practice with browser TTS' },
      { id: 'listening', icon: '\u{1F442}', label: 'Listening', desc: 'Listening drills with browser TTS' },
      { id: 'writing', icon: '\u270D\uFE0F', label: 'Writing', desc: 'Free writing practice (self-check)' },
    ]
    return (
      <div className="space-y-6 py-4">
        <div className="rounded-xl px-5 py-4 flex items-start gap-4" style={{ background: 'var(--color-accent-faded)', border: '1px solid var(--color-accent-light)' }}>
          <span className="text-2xl mt-0.5">&#9889;</span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Offline Mode</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>The Creative Hub backend is not running. Some tools are still available.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {offlineTools.map(t => (
            <button key={t.id} onClick={() => setActiveTool(t.id)}
              className="flex flex-col items-start gap-2 rounded-xl px-5 py-4 text-left cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <span className="text-2xl">{t.icon}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t.label}</span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.desc}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="space-y-2 flex-1">
            <div className="h-6 w-48 rounded-lg bg-[var(--color-surface-alt)]" />
            <div className="h-4 w-32 rounded bg-[var(--color-surface-alt)]" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-lg bg-[var(--color-surface-alt)]" />)}
        </div>
        <div className="h-3 rounded-full bg-[var(--color-surface-alt)]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-36 rounded-xl bg-[var(--color-surface-alt)]" />)}
        </div>
      </div>
    )
  }

  // --- Main render ---
  const onboarding = readOnboarding()
  const greeting = getLocalizedGreeting(onboarding?.targetLanguage)
  const displayName = isAuthenticated && user?.displayName ? user.displayName.split(' ')[0] : null

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-5">

      {/* Welcome Header */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--color-text-primary)] leading-tight">
              {greeting.primary}{displayName ? `, ${displayName}` : ''}
            </h1>
            {greeting.subtitle && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 italic">{greeting.subtitle}</p>
            )}
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{formatDate()}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {streak > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40">
                <span className="text-sm">&#128293;</span>
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{streak}</span>
              </div>
            )}
            {xpToday > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40">
                <span className="text-sm">&#9889;</span>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{xpToday} XP</span>
              </div>
            )}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--color-primary-faded)] border border-[var(--color-primary-light)]">
              <span className="text-xs font-bold text-[var(--color-primary-dark)]">Lv {level}</span>
            </div>
          </div>
        </div>
        <div className="mt-2"><LanguageSwitcher compact /></div>
      </motion.div>

      {/* Quick Stats Row */}
      {totalWords > 0 && (
        <motion.div variants={fadeUp}>
          <div className="grid grid-cols-4 gap-2">
            <QuickStat icon="&#128218;" value={wordsLearned} label="Known" onClick={() => setActiveTool('universe')} />
            <QuickStat icon="&#128337;" value={wordsDue} label="Due" warn={wordsDue > 0} onClick={() => setActiveTool('flashcards')} />
            <QuickStat icon="&#127919;" value={`${Math.round(accuracy)}%`} label="Accuracy" accent={accuracy >= 70} />
            <QuickStat icon="&#128336;" value={`~${planTotalMinutes}m`} label="Today" />
          </div>
        </motion.div>
      )}

      {/* Import prompt (empty state) */}
      {totalWords === 0 && (
        <motion.div variants={fadeUp}>
          <button onClick={() => setActiveTool('upload')}
            className="w-full text-left px-5 py-4 rounded-xl border-2 border-dashed border-[var(--color-primary-light)] bg-[var(--color-primary-pale)] hover:bg-[var(--color-primary-faded)] transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <span className="text-3xl">&#128640;</span>
              <div>
                <p className="text-sm font-bold text-[var(--color-primary-dark)]">Import your first vocabulary list</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Upload a word list to start your learning journey</p>
              </div>
              <span className="ml-auto text-[var(--color-primary-main)] text-lg">&#8594;</span>
            </div>
          </button>
        </motion.div>
      )}

      {/* Daily Study Plan */}
      {studyPlan.length > 0 && (
        <>
          <motion.div variants={fadeUp}>
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Today&apos;s Study Plan</h2>
              <div className="flex items-center gap-2">
                {allDone && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Complete!</span>}
                <span className="text-xs text-[var(--color-text-muted)]">{planCompletedCount}/{studyPlan.length} &middot; ~{planTotalMinutes} min</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
              <motion.div className="h-full rounded-full"
                style={{ background: allDone ? 'var(--color-correct)' : 'var(--color-primary-main)' }}
                initial={{ width: 0 }} animate={{ width: `${planProgress * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }} />
            </div>
          </motion.div>

          <motion.div variants={cardStagger} initial="hidden" animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {studyPlan.map((step, idx) => {
              const isCompleted = dailyPlan.completedStepIds.includes(step.id)
              const isNext = !isCompleted && studyPlan.findIndex(s => !dailyPlan.completedStepIds.includes(s.id)) === idx
              return <CategoryCard key={step.id} step={step} isCompleted={isCompleted} isNext={isNext}
                onStart={() => handleStartStep(step)} onMarkDone={() => markStepCompleted(step)} />
            })}
          </motion.div>
        </>
      )}

      {/* Session Complete Celebration */}
      {allDone && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center py-8 px-4 rounded-2xl relative overflow-hidden bg-gradient-to-br from-green-50/80 to-emerald-50/60 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200 dark:border-green-800/40">
          <p className="text-xl font-bold text-green-700 dark:text-green-300">All done for today!</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Streak earned. Come back tomorrow to keep going.</p>
          <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-2">+{studyPlan.length * 10} bonus XP</p>
        </motion.div>
      )}

      {/* New Words Bank Status */}
      {totalWords > 0 && (
        <motion.div variants={fadeUp}>
          <NewWordsBankStatus totalWords={totalWords} newWordsTarget={newWordsTarget} setActiveTool={setActiveTool} />
        </motion.div>
      )}

      {/* Quick Practice Access */}
      {totalWords > 0 && (
        <motion.div variants={fadeUp}>
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Quick Practice</h2>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {PRACTICE_TOOLS.map(t => (
              <button key={t.id} onClick={() => setActiveTool(t.id)}
                className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] hover:shadow-sm">
                <span className="text-xl">{t.icon}</span>
                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] leading-tight text-center">{t.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Activity */}
      {sessions.length > 0 && (
        <motion.div variants={fadeUp}>
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Recent Activity</h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)] overflow-hidden">
            {sessions.slice(0, 5).map(session => (
              <div key={session.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-primary-faded)] text-[var(--color-primary-dark)] shrink-0">{toolLabel(session.tool_id)}</span>
                  <span className="text-sm text-[var(--color-text-secondary)] truncate">
                    {session.words_reviewed} word{session.words_reviewed === 1 ? '' : 's'}
                    {session.correct > 0 && <span className="text-[var(--color-correct)]"> &middot; {session.correct} correct</span>}
                  </span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0 ml-3">{timeAgo(session.ended_at ?? session.started_at)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Your Lists */}
      {lists.length > 0 && (
        <motion.div variants={fadeUp}>
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Your Lists</h2>
          <div className="flex flex-wrap gap-2">
            {lists.map(list => (
              <button key={list.id} onClick={() => { setCurrentListId(list.id); setActiveTool('wordbank') }}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-light)] hover:bg-[var(--color-primary-pale)] transition-colors cursor-pointer text-[var(--color-text-secondary)]">
                {list.name}<span className="ml-1.5 text-[var(--color-text-muted)]">{list.word_count}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <SessionDebrief open={debriefOpen} onClose={closeDebrief} completedCount={planCompletedCount} totalCount={studyPlan.length} />

      <AnimatePresence>
        {welcomeBackOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setWelcomeBackOpen(false)}
          >
            <motion.div
              className="max-w-md w-full rounded-2xl p-5 shadow-xl"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">{'\uD83D\uDC4B'}</div>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Welcome back!</h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">We missed you. Quick question about your last session:</p>
              </div>
              <FeedbackCollector embedded heading="How was your last session?" subtitle="Your feedback helps us improve"
                onComplete={() => setWelcomeBackOpen(false)} onDismiss={() => setWelcomeBackOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function QuickStat({ icon, value, label, warn, accent, onClick }: {
  icon: string; value: string | number; label: string; warn?: boolean; accent?: boolean; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-center transition-all ${onClick ? 'cursor-pointer hover:border-[var(--color-primary-light)] hover:shadow-sm' : ''}`}
    >
      <div className="text-xs mb-0.5" dangerouslySetInnerHTML={{ __html: icon }} />
      <div className={`text-base font-bold leading-tight ${warn ? 'text-orange-600 dark:text-orange-400' : accent ? 'text-[var(--color-correct)]' : 'text-[var(--color-text-primary)]'}`}>{value}</div>
      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{label}</div>
    </Tag>
  )
}

function CategoryCard({ step, isCompleted, isNext, onStart, onMarkDone }: {
  step: SessionStep; isCompleted: boolean; isNext: boolean; onStart: () => void; onMarkDone: () => void
}) {
  const colors = CATEGORY_COLORS[step.category] ?? CATEGORY_COLORS.review

  return (
    <motion.div variants={cardItem}
      className={`rounded-xl border px-4 py-4 flex flex-col gap-2.5 transition-all relative overflow-hidden
        ${isCompleted
          ? 'border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-900/10'
          : isNext
            ? `${colors.border} ${colors.bg} ${colors.bgDark} shadow-md ring-2 ring-[var(--color-primary-main)]/15`
            : `border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-light)]`
        }`}>

      {isCompleted && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-black/20 z-10 rounded-xl">
          <div className="flex flex-col items-center gap-1">
            <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-lg font-bold">&#10003;</span>
            <span className="text-xs font-bold text-green-700 dark:text-green-300">Done</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-lg ${isCompleted ? '' : colors.icon}`}>{categoryIcon(step.category)}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isCompleted ? 'text-green-600 dark:text-green-400' : colors.text}`}>
            {categoryLabel(step.category)}
          </span>
        </div>
        {!isCompleted && (
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-alt)] px-1.5 py-0.5 rounded">
            ~{step.estimatedMinutes}m
          </span>
        )}
      </div>

      <div className={isCompleted ? 'opacity-40' : ''}>
        <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
          {step.name.split(': ')[1] || step.name}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{step.description}</p>
      </div>

      {!isCompleted && (
        <div className="flex items-center gap-2 mt-auto pt-1">
          <button type="button" onClick={onStart}
            className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all
              ${isNext
                ? 'bg-[var(--color-primary-main)] text-white hover:bg-[var(--color-primary-dark)] border-none shadow-sm'
                : 'bg-[var(--color-surface)] text-[var(--color-primary-main)] border border-[var(--color-primary-light)] hover:bg-[var(--color-primary-pale)]'
              }`}>
            {isNext ? 'Start Now' : 'Start'}
          </button>
          <button type="button" onClick={onMarkDone}
            className="py-2 px-3 rounded-lg text-xs font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
            title="Mark as done">
            &#10003;
          </button>
        </div>
      )}
    </motion.div>
  )
}

function NewWordsBankStatus({ totalWords, newWordsTarget, setActiveTool }: {
  totalWords: number; newWordsTarget: number; setActiveTool: (id: LinguaToolId) => void
}) {
  const daysRemaining = totalWords > 0 ? Math.floor(totalWords / Math.max(1, newWordsTarget)) : 0
  if (daysRemaining > 3 || totalWords >= newWordsTarget * 5) return null

  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--color-accent-faded)', border: '1px solid var(--color-accent-light)' }}>
      <span className="text-xl shrink-0">&#128218;</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-accent-dark)]">Running low on new words!</p>
        <p className="text-xs text-[var(--color-text-muted)]">About {daysRemaining} day{daysRemaining === 1 ? '' : 's'} of new words left at your current pace.</p>
      </div>
      <button type="button" onClick={() => setActiveTool('upload')}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer bg-[var(--color-accent-dark)] text-white hover:opacity-90 transition-opacity border-none">
        Add Words
      </button>
    </div>
  )
}
