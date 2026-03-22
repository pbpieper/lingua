import { useState, useCallback } from 'react'

export interface Preferences {
  userName: string
  dailyGoal: number
  defaultLangFrom: string
  defaultLangTo: string
  autoPlayTts: boolean
  sidebarCollapsed: Record<string, boolean>
  walkthroughDone: boolean
  showAllTools: boolean
  newWordsPerDay: number
  fontSize: string
  difficulty: string
  sessionLength: number
  /** Accessibility: increase all font sizes by 1.5x */
  largeTextMode: boolean
  /** Accessibility: hide advanced features, show only core tools */
  simpleMode: boolean
  /** Accessibility: high contrast mode */
  highContrast: boolean
}

const STORAGE_KEY = 'lingua-preferences'

const DEFAULTS: Preferences = {
  userName: '',
  dailyGoal: 10,
  defaultLangFrom: '',
  defaultLangTo: '',
  autoPlayTts: false,
  sidebarCollapsed: {},
  walkthroughDone: false,
  showAllTools: false,
  newWordsPerDay: 10,
  fontSize: 'medium',
  difficulty: 'normal',
  sessionLength: 15,
  largeTextMode: false,
  simpleMode: false,
  highContrast: false,
}

/** Legacy keys that were used before consolidation */
const LEGACY_KEYS = [
  'lingua-user-name',
  'lingua-daily-goal',
  'lingua-auto-tts',
  'lingua-default-source-lang',
  'lingua-default-target-lang',
  'lingua-sidebar-collapsed',
  'lingua-walkthrough-done',
] as const

function migrateLegacy(): Partial<Preferences> {
  const migrated: Partial<Preferences> = {}
  let found = false

  const name = localStorage.getItem('lingua-user-name')
  if (name !== null) { migrated.userName = name; found = true }

  const goal = localStorage.getItem('lingua-daily-goal')
  if (goal !== null) { migrated.dailyGoal = Number(goal) || 10; found = true }

  const tts = localStorage.getItem('lingua-auto-tts')
  if (tts !== null) { migrated.autoPlayTts = tts === 'true'; found = true }

  const srcLang = localStorage.getItem('lingua-default-source-lang')
  if (srcLang !== null) { migrated.defaultLangFrom = srcLang; found = true }

  const tgtLang = localStorage.getItem('lingua-default-target-lang')
  if (tgtLang !== null) { migrated.defaultLangTo = tgtLang; found = true }

  const sidebar = localStorage.getItem('lingua-sidebar-collapsed')
  if (sidebar !== null) {
    try { migrated.sidebarCollapsed = JSON.parse(sidebar); found = true } catch { /* ignore */ }
  }

  const walkthrough = localStorage.getItem('lingua-walkthrough-done')
  if (walkthrough !== null) { migrated.walkthroughDone = walkthrough === 'true'; found = true }

  if (found) {
    // Remove legacy keys after migration
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key)
    }
  }

  return found ? migrated : {}
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return { ...DEFAULTS, ...JSON.parse(raw) }
    }
  } catch { /* ignore */ }

  // Attempt legacy migration
  const legacy = migrateLegacy()
  const prefs = { ...DEFAULTS, ...legacy }
  if (Object.keys(legacy).length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }
  return prefs
}

function savePreferences(prefs: Preferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences)

  const setPref = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value }
      savePreferences(next)
      return next
    })
  }, [])

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULTS)
    savePreferences(DEFAULTS)
  }, [])

  return { prefs, setPref, resetPrefs }
}
