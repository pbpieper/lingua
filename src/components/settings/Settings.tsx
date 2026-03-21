import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import * as api from '@/services/vocabApi'
import { getHubUrl, setHubUrl } from '@/services/aiConfig'
import { syncToCloud, syncFromCloud, getSyncStatus, exportUserData } from '@/services/dataSync'
import { isSupabaseConfigured } from '@/services/supabase'
import { AuthModal } from '@/components/auth/AuthModal'
import type { WordInput } from '@/types/word'

interface OnboardingData {
  targetLang?: string
  nativeLang?: string
  level?: string
  goals?: string[]
}

const DAILY_GOAL_OPTIONS = [5, 10, 15, 20, 30, 50]

export function Settings() {
  const { userId, lists, refreshLists } = useApp()
  const { user, isAuthenticated, signOut } = useAuth()
  const { prefs, setPref } = usePreferences()

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(getSyncStatus)

  // Profile
  const [displayName, setDisplayName] = useState(prefs.userName)
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null)

  // Import state
  const [importProgress, setImportProgress] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Local state derived from preferences
  const dailyGoal = prefs.dailyGoal
  const autoPlayTTS = prefs.autoPlayTts
  const defaultSourceLang = prefs.defaultLangFrom
  const defaultTargetLang = prefs.defaultLangTo

  // Reset confirmation states
  const [confirmResetProgress, setConfirmResetProgress] = useState(false)
  const [confirmResetOnboarding, setConfirmResetOnboarding] = useState(false)

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

  // Persist profile name
  const handleNameSave = () => {
    setPref('userName', displayName)
    toast.success('Display name saved')
  }

  const setDailyGoal = (v: number) => setPref('dailyGoal', v)
  const setAutoPlayTTS = (v: boolean) => setPref('autoPlayTts', v)
  const setDefaultSourceLang = (v: string) => setPref('defaultLangFrom', v)
  const setDefaultTargetLang = (v: string) => setPref('defaultLangTo', v)

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
        preferences: { dailyGoal, autoPlayTTS, defaultSourceLang, defaultTargetLang },
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
      setConfirmResetProgress(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    }
  }

  // Reset onboarding
  const handleResetOnboarding = () => {
    localStorage.removeItem('lingua-onboarding')
    setOnboarding(null)
    setConfirmResetOnboarding(false)
    toast.success('Onboarding data cleared — reload to redo setup')
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

      {/* Account Section */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Account
        </h3>
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
                onClick={handleExportUserData}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                  border border-[var(--color-border)] text-[var(--color-text-primary)]
                  bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Export My Data
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                  border border-[var(--color-incorrect)] text-[var(--color-incorrect)]
                  bg-[var(--color-bg)] hover:bg-red-50 transition-colors"
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
      </section>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Profile Section */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Profile
        </h3>
        <div className="space-y-4">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Enter your name..."
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
                  placeholder:text-[var(--color-text-muted)]"
              />
              <button
                onClick={handleNameSave}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                  bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            </div>
          </div>

          {/* User ID */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              User ID
            </label>
            <p className="text-sm text-[var(--color-text-secondary)] font-mono bg-[var(--color-bg)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
              {userId}
            </p>
          </div>

          {/* Onboarding data */}
          {onboarding && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
                Onboarding Data
              </label>
              <div className="grid grid-cols-2 gap-3">
                {onboarding.targetLang && (
                  <div className="bg-[var(--color-bg)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
                    <span className="block text-xs text-[var(--color-text-muted)]">Target Language</span>
                    <span className="text-sm text-[var(--color-text-primary)]">{onboarding.targetLang}</span>
                  </div>
                )}
                {onboarding.nativeLang && (
                  <div className="bg-[var(--color-bg)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
                    <span className="block text-xs text-[var(--color-text-muted)]">Native Language</span>
                    <span className="text-sm text-[var(--color-text-primary)]">{onboarding.nativeLang}</span>
                  </div>
                )}
                {onboarding.level && (
                  <div className="bg-[var(--color-bg)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
                    <span className="block text-xs text-[var(--color-text-muted)]">Level</span>
                    <span className="text-sm text-[var(--color-text-primary)]">{onboarding.level}</span>
                  </div>
                )}
                {onboarding.goals && onboarding.goals.length > 0 && (
                  <div className="bg-[var(--color-bg)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
                    <span className="block text-xs text-[var(--color-text-muted)]">Goals</span>
                    <span className="text-sm text-[var(--color-text-primary)]">{onboarding.goals.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Preferences Section */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Preferences
        </h3>
        <div className="space-y-5">
          {/* Daily Goal */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
              Daily Goal: <span className="text-[var(--color-primary-main)] font-semibold">{dailyGoal} words/day</span>
            </label>
            <input
              type="range"
              min={0}
              max={DAILY_GOAL_OPTIONS.length - 1}
              value={DAILY_GOAL_OPTIONS.indexOf(dailyGoal)}
              onChange={e => setDailyGoal(DAILY_GOAL_OPTIONS[Number(e.target.value)])}
              className="w-full accent-[var(--color-primary-main)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              {DAILY_GOAL_OPTIONS.map(v => (
                <span key={v}>{v}</span>
              ))}
            </div>
          </div>

          {/* Default Source Language */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Default Source Language
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

          {/* Default Target Language */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Default Target Language
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

          {/* Auto-play TTS */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                Auto-play TTS
              </label>
              <p className="text-xs text-[var(--color-text-muted)]">
                Automatically play pronunciation audio in exercises
              </p>
            </div>
            <button
              onClick={() => setAutoPlayTTS(!autoPlayTTS)}
              role="switch"
              aria-checked={autoPlayTTS}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                autoPlayTTS ? 'bg-[var(--color-primary-main)]' : 'bg-[var(--color-border)]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  autoPlayTTS ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* AI Backend Section */}
      <AIBackendSettings />

      {/* Data Management Section */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Data Management
        </h3>
        <div className="space-y-3">
          {/* Export All */}
          <button
            onClick={handleExportAll}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer
              border border-[var(--color-border)] text-[var(--color-text-primary)]
              bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors text-left"
          >
            Export All Data
            <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
              Download words, lists, and stats as JSON
            </span>
          </button>

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
            {importProgress ?? 'Import Data'}
            <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
              Restore from a previously exported JSON file
            </span>
          </button>

          {/* Reset Progress */}
          {!confirmResetProgress ? (
            <button
              onClick={() => setConfirmResetProgress(true)}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer
                border border-[var(--color-incorrect)] text-[var(--color-incorrect)]
                bg-[var(--color-bg)] hover:bg-red-50 transition-colors text-left"
            >
              Reset Progress
              <span className="block text-xs opacity-70 mt-0.5">
                Clear all review data (SM-2 intervals, streaks)
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--color-incorrect)] bg-red-50">
              <span className="text-sm text-[var(--color-incorrect)] font-medium">
                Are you sure? This cannot be undone.
              </span>
              <button
                onClick={handleResetProgress}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                  bg-[var(--color-incorrect)] text-white hover:opacity-90 transition-opacity"
              >
                Yes, reset
              </button>
              <button
                onClick={() => setConfirmResetProgress(false)}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                  border border-[var(--color-border)] text-[var(--color-text-secondary)]
                  hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Reset Onboarding */}
          {!confirmResetOnboarding ? (
            <button
              onClick={() => setConfirmResetOnboarding(true)}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer
                border border-[var(--color-incorrect)] text-[var(--color-incorrect)]
                bg-[var(--color-bg)] hover:bg-red-50 transition-colors text-left"
            >
              Reset Onboarding
              <span className="block text-xs opacity-70 mt-0.5">
                Clear onboarding data and redo initial setup
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--color-incorrect)] bg-red-50">
              <span className="text-sm text-[var(--color-incorrect)] font-medium">
                Clear onboarding data?
              </span>
              <button
                onClick={handleResetOnboarding}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                  bg-[var(--color-incorrect)] text-white hover:opacity-90 transition-opacity"
              >
                Yes, clear
              </button>
              <button
                onClick={() => setConfirmResetOnboarding(false)}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
                  border border-[var(--color-border)] text-[var(--color-text-secondary)]
                  hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>

      {/* About Section */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          About
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          <span className="font-medium">Lingua v0.1.0</span>
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          A vocabulary learning app with spaced repetition, mini-games, TTS, AI chat, and interactive reading.
          Built on the Creative Hub backend.
        </p>
      </section>
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

  const statusDot = status === 'connected'
    ? 'bg-green-500'
    : status === 'checking'
      ? 'bg-yellow-400 animate-pulse'
      : 'bg-red-400'

  const statusText = status === 'connected'
    ? 'Connected'
    : status === 'checking'
      ? 'Checking...'
      : getHubUrl() ? 'Not connected' : 'AI disabled'

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
        AI Backend
      </h3>

      <div className="space-y-4">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusDot}`} />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {statusText}
          </span>
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
              placeholder="https://your-server.example.com or http://localhost:8420"
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
              onClick={() => handlePreset(import.meta.env.VITE_HUB_URL || '')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer
                border border-[var(--color-border)] text-[var(--color-text-secondary)]
                bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              Use Lingua Cloud
            </button>
            <button
              onClick={() => handlePreset('http://localhost:8420')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer
                border border-[var(--color-border)] text-[var(--color-text-secondary)]
                bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              Use Local (localhost:8420)
            </button>
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
        <div className="text-xs text-[var(--color-text-muted)] space-y-1">
          <p><strong>Lingua Cloud</strong> — connects to the hosted AI server (requires internet). Best for most users.</p>
          <p><strong>Local</strong> — for developers running the Creative Hub backend on their own machine.</p>
          <p><strong>Disable AI</strong> — the app works fully offline with flashcards, quizzes, and browser TTS. AI chat, story generation, and grammar lessons won't be available.</p>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer
            bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity"
        >
          Save
        </button>
      </div>
    </section>
  )
}
