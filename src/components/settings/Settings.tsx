import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { useTheme } from '@/design/theme'
import * as api from '@/services/vocabApi'
import { getHubUrl, setHubUrl } from '@/services/aiConfig'
import { syncToCloud, syncFromCloud, getSyncStatus, exportUserData } from '@/services/dataSync'
import { isSupabaseConfigured } from '@/services/supabase'
import { AuthModal } from '@/components/auth/AuthModal'
import type { WordInput } from '@/types/word'

/* ── Constants ─────────────────────────────────────── */

interface OnboardingData {
  targetLang?: string
  nativeLang?: string
  level?: string
  goals?: string[]
}

const DAILY_GOAL_OPTIONS = [5, 10, 15, 20, 30, 50]
const SESSION_LENGTH_OPTIONS = [5, 10, 15, 20, 30]
const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]
const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Relaxed', desc: 'More hints, gentler spacing' },
  { value: 'normal', label: 'Balanced', desc: 'Standard spaced repetition' },
  { value: 'hard', label: 'Challenge', desc: 'Fewer hints, tighter intervals' },
]

const APP_VERSION = '0.2.0'

/* ── Toggle Component ──────────────────────────────── */

function Toggle({ checked, onChange, label, description }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
        {description && (
          <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-[var(--color-primary-main)]' : 'bg-[var(--color-border)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

/* ── Section Header ────────────────────────────────── */

function SectionCard({ title, children, danger }: {
  title: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <section className={`rounded-xl border p-5 ${
      danger
        ? 'border-[var(--color-incorrect)] bg-[var(--color-surface)]'
        : 'border-[var(--color-border)] bg-[var(--color-surface)]'
    }`}>
      <h3 className={`text-sm font-semibold mb-4 ${
        danger ? 'text-[var(--color-incorrect)]' : 'text-[var(--color-text-primary)]'
      }`}>
        {title}
      </h3>
      {children}
    </section>
  )
}

/* ── Confirm Button ────────────────────────────────── */

function DangerAction({ label, description, confirmLabel, onConfirm }: {
  label: string
  description: string
  confirmLabel: string
  onConfirm: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [doubleConfirm, setDoubleConfirm] = useState(false)

  if (doubleConfirm) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--color-incorrect)] bg-red-50">
        <span className="text-sm text-[var(--color-incorrect)] font-medium flex-1">
          This action is permanent. Are you absolutely sure?
        </span>
        <button
          onClick={() => { onConfirm(); setDoubleConfirm(false); setConfirming(false) }}
          className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
            bg-[var(--color-incorrect)] text-white hover:opacity-90 transition-opacity"
        >
          {confirmLabel}
        </button>
        <button
          onClick={() => { setDoubleConfirm(false); setConfirming(false) }}
          className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
            border border-[var(--color-border)] text-[var(--color-text-secondary)]
            hover:bg-[var(--color-surface-alt)] transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--color-incorrect)] bg-red-50">
        <span className="text-sm text-[var(--color-incorrect)] font-medium flex-1">
          Are you sure? This cannot be undone.
        </span>
        <button
          onClick={() => setDoubleConfirm(true)}
          className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
            bg-[var(--color-incorrect)] text-white hover:opacity-90 transition-opacity"
        >
          Yes, continue
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
            border border-[var(--color-border)] text-[var(--color-text-secondary)]
            hover:bg-[var(--color-surface-alt)] transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer
        border border-[var(--color-incorrect)] text-[var(--color-incorrect)]
        bg-[var(--color-bg)] hover:bg-red-50 transition-colors text-left"
    >
      {label}
      <span className="block text-xs opacity-70 mt-0.5">{description}</span>
    </button>
  )
}

/* ── Main Settings Component ──────────────────────── */

export function Settings() {
  const { userId, lists, refreshLists } = useApp()
  const { user, isAuthenticated, signOut } = useAuth()
  const { prefs, setPref, resetPrefs } = usePreferences()
  const { isDark, toggle: toggleTheme } = useTheme()

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(getSyncStatus)

  // Profile (displayName used in data export)
  const displayName = prefs.userName
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null)

  // Import state
  const [importProgress, setImportProgress] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Local state derived from preferences
  const dailyGoal = prefs.dailyGoal
  const autoPlayTTS = prefs.autoPlayTts
  const defaultSourceLang = prefs.defaultLangFrom
  const defaultTargetLang = prefs.defaultLangTo

  // Font size & difficulty & session length
  const fontSize = prefs.fontSize || 'medium'
  const difficulty = prefs.difficulty || 'normal'
  const sessionLength = prefs.sessionLength || 15

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lingua-onboarding')
      if (raw) setOnboarding(JSON.parse(raw))
    } catch {
      // ignore parse errors
    }
  }, [])

  // Sync handlers
  const handleSync = async () => {
    if (!isAuthenticated || !user) return
    setSyncing(true)
    try {
      await syncToCloud(user.id)
      await syncFromCloud(user.id)
      setSyncStatus(getSyncStatus())
      toast.success('Data synced successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleExportUserData = async () => {
    try {
      const data = await exportUserData(userId)
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lingua-full-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('All data exported')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
  }

  const setDailyGoal = (v: number) => setPref('dailyGoal', v)
  const setAutoPlayTTS = (v: boolean) => setPref('autoPlayTts', v)
  const setDefaultSourceLang = (v: string) => setPref('defaultLangFrom', v)
  const setDefaultTargetLang = (v: string) => setPref('defaultLangTo', v)
  const setFontSize = (v: string) => setPref('fontSize', v)
  const setDifficulty = (v: string) => setPref('difficulty', v)
  const setSessionLength = (v: number) => setPref('sessionLength', v)

  // Export all data as JSON
  const handleExportAll = async () => {
    try {
      const [words, stats] = await Promise.all([
        api.getWords(userId),
        api.getStats(userId),
      ])
      const data = {
        exportedAt: new Date().toISOString(),
        userId,
        displayName,
        onboarding,
        preferences: { dailyGoal, autoPlayTTS, defaultSourceLang, defaultTargetLang, fontSize, difficulty, sessionLength },
        lists,
        words,
        stats,
      }
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lingua-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('All data exported')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  // Reset progress (clear review data)
  const handleResetProgress = async () => {
    try {
      await api.resetProgress(userId)
      toast.success('Progress has been reset')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    }
  }

  // Reset onboarding
  const handleResetOnboarding = () => {
    localStorage.removeItem('lingua-onboarding')
    setOnboarding(null)
    toast.success('Onboarding data cleared -- reload to redo setup')
  }

  // Clear all data
  const handleClearAllData = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('lingua-'))
    keys.forEach(k => localStorage.removeItem(k))
    resetPrefs()
    toast.success('All data cleared. Reload to start fresh.')
    setTimeout(() => window.location.reload(), 1200)
  }

  // Import data from JSON export
  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate structure
      if (!Array.isArray(data.lists) || !Array.isArray(data.words)) {
        toast.error('Invalid import file: missing "lists" or "words" arrays')
        return
      }

      const totalLists = data.lists.length
      let importedWords = 0

      for (let i = 0; i < totalLists; i++) {
        const list = data.lists[i]
        setImportProgress(`Importing... (${i + 1}/${totalLists} lists)`)

        // Create the list
        const newList = await api.createList(
          userId,
          list.name,
          list.language_from,
          list.language_to,
          list.description || undefined,
        )

        // Find words belonging to this list
        const listWords: WordInput[] = data.words
          .filter((w: Record<string, unknown>) => w.list_id === list.id)
          .map((w: Record<string, unknown>) => ({
            lemma: w.lemma as string,
            translation: w.translation as string,
            language_from: (w.language_from as string) || list.language_from,
            language_to: (w.language_to as string) || list.language_to,
            part_of_speech: w.part_of_speech as string | undefined,
            gender: w.gender as string | undefined,
            pronunciation: w.pronunciation as string | undefined,
            example_sentence: w.example_sentence as string | undefined,
            example_translation: w.example_translation as string | undefined,
            tags: w.tags as string[] | undefined,
          }))

        if (listWords.length > 0) {
          const result = await api.uploadWords(userId, newList.id, listWords)
          importedWords += result.added
        }
      }

      setImportProgress(null)
      refreshLists()
      toast.success(`Imported ${totalLists} list${totalLists === 1 ? '' : 's'} with ${importedWords} word${importedWords === 1 ? '' : 's'}`)
    } catch (err) {
      setImportProgress(null)
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      // Reset file input so the same file can be re-selected
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }

  // Collect unique languages from lists
  const languages = Array.from(
    new Set(lists.flatMap(l => [l.language_from, l.language_to]))
  ).filter(Boolean).sort()

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        Settings
      </h2>

      {/* ─── Account Section ───────────────────── */}
      <SectionCard title="Account">
        {isAuthenticated && user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary-main)] flex items-center justify-center text-white font-semibold text-sm">
                  {(user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                  {user.displayName || 'Unnamed user'}
                </p>
                {user.email && (
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                )}
              </div>
            </div>

            {/* Sync status */}
            {isSupabaseConfigured() && (
              <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                <p>Last synced: {syncStatus.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : 'Never'}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {isSupabaseConfigured() && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                    bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? 'Syncing...' : 'Sync Data'}
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                  border border-[var(--color-border)] text-[var(--color-text-secondary)]
                  bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Sign in to sync your vocabulary and progress across devices.
            </p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer
                bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity"
            >
              Sign In / Create Account
            </button>
            <p className="text-xs text-[var(--color-text-muted)]">
              Your data stays on this device until you sign in. No account required to use Lingua.
            </p>
          </div>
        )}
      </SectionCard>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* ─── AI Backend Section ────────────────── */}
      <AIBackendSettings />

      {/* ─── Learning Preferences ──────────────── */}
      <SectionCard title="Learning Preferences">
        <div className="space-y-6">
          {/* Daily Word Target */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
              Daily word target
            </label>
            <div className="flex gap-2">
              {DAILY_GOAL_OPTIONS.map(v => (
                <button
                  key={v}
                  onClick={() => setDailyGoal(v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    dailyGoal === v
                      ? 'bg-[var(--color-primary-main)] text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
              New words to learn each day
            </p>
          </div>

          {/* Session Length */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
              Session length
            </label>
            <div className="flex gap-2">
              {SESSION_LENGTH_OPTIONS.map(v => (
                <button
                  key={v}
                  onClick={() => setSessionLength(v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    sessionLength === v
                      ? 'bg-[var(--color-primary-main)] text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  {v}m
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
              Target study session duration in minutes
            </p>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
              Difficulty
            </label>
            <div className="flex flex-col gap-2">
              {DIFFICULTY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDifficulty(opt.value)}
                  className={`px-4 py-3 rounded-lg text-left cursor-pointer transition-colors ${
                    difficulty === opt.value
                      ? 'bg-[var(--color-primary-pale)] border-2 border-[var(--color-primary-main)]'
                      : 'bg-[var(--color-bg)] border border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{opt.label}</span>
                  <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Default Languages */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                Default source language
              </label>
              <select
                value={defaultSourceLang}
                onChange={e => setDefaultSourceLang(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] cursor-pointer"
              >
                <option value="">Auto-detect</option>
                {languages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                Default target language
              </label>
              <select
                value={defaultTargetLang}
                onChange={e => setDefaultTargetLang(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)] cursor-pointer"
              >
                <option value="">Auto-detect</option>
                {languages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-play TTS */}
          <Toggle
            checked={autoPlayTTS}
            onChange={setAutoPlayTTS}
            label="Auto-play pronunciation"
            description="Automatically play audio in exercises and flashcards"
          />
        </div>
      </SectionCard>

      {/* ─── Appearance ────────────────────────── */}
      <SectionCard title="Appearance">
        <div className="space-y-5">
          <Toggle
            checked={isDark}
            onChange={() => toggleTheme()}
            label="Dark mode"
            description="Switch between light and dark theme"
          />

          {/* Font Size */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
              Font size
            </label>
            <div className="flex gap-2">
              {FONT_SIZE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFontSize(opt.value)}
                  className={`flex-1 py-2 rounded-lg font-medium cursor-pointer transition-colors ${
                    fontSize === opt.value
                      ? 'bg-[var(--color-primary-main)] text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
                  }`}
                  style={{ fontSize: opt.value === 'small' ? '12px' : opt.value === 'large' ? '16px' : '14px' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ─── Data Management ───────────────────── */}
      <SectionCard title="Data Management">
        <div className="space-y-3">
          {/* Export All */}
          <button
            onClick={handleExportAll}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer
              border border-[var(--color-border)] text-[var(--color-text-primary)]
              bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors text-left"
          >
            Export all data
            <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
              Download words, lists, and stats as JSON
            </span>
          </button>

          {isAuthenticated && (
            <button
              onClick={handleExportUserData}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer
                border border-[var(--color-border)] text-[var(--color-text-primary)]
                bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors text-left"
            >
              Export account data
              <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
                Download your synced cloud data
              </span>
            </button>
          )}

          {/* Import Data */}
          <input
            ref={importFileRef}
            type="file"
            accept=".json"
            onChange={handleImportData}
            className="hidden"
          />
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={importProgress !== null}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer
              border border-[var(--color-border)] text-[var(--color-text-primary)]
              bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors text-left
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importProgress ?? 'Import data'}
            <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
              Restore from a previously exported JSON file
            </span>
          </button>

          {/* Reset Onboarding */}
          <button
            onClick={handleResetOnboarding}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer
              border border-[var(--color-border)] text-[var(--color-text-secondary)]
              bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors text-left"
          >
            Redo initial setup
            <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
              Clear onboarding data and restart the welcome flow
            </span>
          </button>
        </div>
      </SectionCard>

      {/* ─── About ─────────────────────────────── */}
      <SectionCard title="About">
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-text-primary)]">
            <span className="font-semibold">Lingua</span>{' '}
            <span className="text-[var(--color-text-muted)]">v{APP_VERSION}</span>
          </p>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            A vocabulary learning app with spaced repetition, mini-games,
            text-to-speech, AI chat, and interactive reading.
            Works offline with browser TTS and local flashcards.
          </p>
          <div className="flex gap-4 pt-1">
            <span className="text-xs text-[var(--color-text-muted)]">
              Built with React + Vite
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              AI features available
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ─── Accessibility ──────────────────────── */}
      <SectionCard title="Accessibility">
        <div className="space-y-4">
          <Toggle
            checked={prefs.largeTextMode || false}
            onChange={(v) => setPref('largeTextMode', v)}
            label="Large Text Mode"
            description="Increase all font sizes by 1.5x for easier reading"
          />
          <Toggle
            checked={prefs.simpleMode || false}
            onChange={(v) => setPref('simpleMode', v)}
            label="Simple Mode"
            description="Show only core tools: Home, Flashcards, Match Game, Word Bank"
          />
          <Toggle
            checked={prefs.highContrast || false}
            onChange={(v) => setPref('highContrast', v)}
            label="High Contrast"
            description="Increase contrast for better visibility"
          />
        </div>
      </SectionCard>

      {/* ─── Danger Zone ───────────────────────── */}
      <SectionCard title="Danger Zone" danger>
        <div className="space-y-3">
          <DangerAction
            label="Reset learning progress"
            description="Clear all review data (study streaks and review schedules). Your words and lists are kept."
            confirmLabel="Yes, reset progress"
            onConfirm={handleResetProgress}
          />
          <DangerAction
            label="Delete all data"
            description="Remove all words, lists, progress, and preferences. This is permanent."
            confirmLabel="Yes, delete everything"
            onConfirm={handleClearAllData}
          />
        </div>
      </SectionCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI Backend Settings sub-component
// ---------------------------------------------------------------------------

function AIBackendSettings() {
  const [url, setUrl] = useState(getHubUrl())
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [testing, setTesting] = useState(false)

  const checkConnection = useCallback(async (targetUrl?: string) => {
    const checkUrl = targetUrl ?? getHubUrl()
    if (!checkUrl) {
      setStatus('disconnected')
      return
    }
    setStatus('checking')
    try {
      const healthUrl = `${checkUrl.replace(/\/$/, '')}/health`
      await fetch(healthUrl, { signal: AbortSignal.timeout(3000) })
      setStatus('connected')
    } catch {
      setStatus('disconnected')
    }
  }, [])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  const handleSave = async () => {
    const trimmed = url.trim()
    setHubUrl(trimmed)
    if (trimmed) {
      await checkConnection(trimmed)
      toast.success('AI backend URL saved')
    } else {
      setStatus('disconnected')
      toast.success('AI features disabled')
    }
  }

  const handleTestConnection = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error('Enter a URL first')
      return
    }
    setTesting(true)
    try {
      const healthUrl = `${trimmed.replace(/\/$/, '')}/health`
      await fetch(healthUrl, { signal: AbortSignal.timeout(5000) })
      toast.success('Connection successful!')
      setStatus('connected')
    } catch {
      toast.error('Could not reach the server')
      setStatus('disconnected')
    } finally {
      setTesting(false)
    }
  }

  const handlePreset = (preset: string) => {
    setUrl(preset)
  }

  const statusColor = status === 'connected'
    ? 'bg-green-500'
    : status === 'checking'
      ? 'bg-yellow-400 animate-pulse'
      : 'bg-[var(--color-text-muted)]'

  const statusText = status === 'connected'
    ? 'Connected'
    : status === 'checking'
      ? 'Checking...'
      : getHubUrl() ? 'Not connected' : 'Not configured'

  return (
    <SectionCard title="AI Backend">
      <div className="space-y-4">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {statusText}
          </span>
          {status === 'disconnected' && !getHubUrl() && (
            <span className="text-xs text-[var(--color-text-muted)] ml-1">
              -- Lingua works fully offline without AI
            </span>
          )}
        </div>

        {/* URL input */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            Server URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://localhost:8420"
              className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)]
                bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
                placeholder:text-[var(--color-text-muted)]"
            />
            <button
              onClick={handleTestConnection}
              disabled={testing || !url.trim()}
              className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer
                border border-[var(--color-border)] text-[var(--color-text-secondary)]
                bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {testing ? 'Testing...' : 'Test'}
            </button>
          </div>
        </div>

        {/* Presets */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
            Quick presets
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePreset('http://localhost:8420')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer
                border border-[var(--color-border)] text-[var(--color-text-secondary)]
                bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              Local (localhost:8420)
            </button>
            {import.meta.env.VITE_HUB_URL && (
              <button
                onClick={() => handlePreset(import.meta.env.VITE_HUB_URL)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer
                  border border-[var(--color-border)] text-[var(--color-text-secondary)]
                  bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Lingua Cloud
              </button>
            )}
            <button
              onClick={() => handlePreset('')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer
                border border-[var(--color-border)] text-[var(--color-text-secondary)]
                bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              Disable AI
            </button>
          </div>
        </div>

        {/* Help text */}
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Flashcards, quizzes, word bank, and browser TTS always work without AI.
          Connect a backend to unlock AI chat, story generation, grammar lessons,
          and high-quality text-to-speech.
        </p>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer
            bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity"
        >
          Save
        </button>
      </div>
    </SectionCard>
  )
}
