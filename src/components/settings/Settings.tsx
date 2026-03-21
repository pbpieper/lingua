import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import { usePreferences } from '@/hooks/usePreferences'
import * as api from '@/services/vocabApi'
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
  const { prefs, setPref } = usePreferences()

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
