import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { LinguaToolId } from '@/types/tools'
import type { VocabList, Word } from '@/types/word'
import type { ActiveStudySource } from '@/types/session'
import * as api from '@/services/vocabApi'
import { syncPrefsFromOnboardingIfNeeded } from '@/services/clientStore'

interface AppContextValue {
  activeTool: LinguaToolId
  setActiveTool: (id: LinguaToolId) => void
  lists: VocabList[]
  currentListId: number | null
  setCurrentListId: (id: number | null) => void
  refreshLists: () => void
  userId: string
  hubAvailable: boolean
  wordsDue: number
  setWordsDue: (n: number) => void
  totalWords: number
  setTotalWords: (n: number) => void
  totalReviewed: number
  setTotalReviewed: (n: number) => void
  wordsMastered: number
  setWordsMastered: (n: number) => void
  daysUsed: number
  setDaysUsed: (n: number) => void
  /** Words shared across practice tools (custom selection or session hint) */
  activeStudyWords: Word[] | null
  activeStudyLabel: string | null
  activeStudySource: ActiveStudySource | null
  activeStudyVersion: number
  setActiveStudyWords: (words: Word[], opts?: { label?: string; source?: ActiveStudySource }) => void
  clearActiveStudyWords: () => void
  /** Multi-language support */
  learningLanguages: string[]
  activeLanguage: string
  setActiveLanguage: (lang: string) => void
  addLearningLanguage: (lang: string) => void
  removeLearningLanguage: (lang: string) => void
}

const AppCtx = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}

const USER_ID = (() => {
  const stored = localStorage.getItem('lingua-user-id')
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem('lingua-user-id', id)
  return id
})()

/** Read initial languages from onboarding + preferences */
function getInitialLanguages(): { learning: string[]; active: string } {
  try {
    const onboarding = localStorage.getItem('lingua-onboarding')
    const prefs = localStorage.getItem('lingua-preferences')
    const onb = onboarding ? JSON.parse(onboarding) : null
    const prf = prefs ? JSON.parse(prefs) : null

    // Gather unique language codes from onboarding + any saved list of learning languages
    const langs = new Set<string>()
    if (onb?.targetLanguage) langs.add(onb.targetLanguage)
    if (prf?.learningLanguages && Array.isArray(prf.learningLanguages)) {
      for (const l of prf.learningLanguages) if (l) langs.add(l)
    }
    const arr = Array.from(langs)
    const active = prf?.activeLanguage || arr[0] || ''
    return { learning: arr, active }
  } catch {
    return { learning: [], active: '' }
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<LinguaToolId>('home')
  const [lists, setLists] = useState<VocabList[]>([])
  const [currentListId, setCurrentListId] = useState<number | null>(null)
  const [hubAvailable, setHubAvailable] = useState(false)
  const [wordsDue, setWordsDue] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [totalReviewed, setTotalReviewed] = useState(0)
  const [wordsMastered, setWordsMastered] = useState(0)
  const [daysUsed, setDaysUsed] = useState(0)
  const [activeStudyWords, setActiveStudyWordsState] = useState<Word[] | null>(null)
  const [activeStudyLabel, setActiveStudyLabel] = useState<string | null>(null)
  const [activeStudySource, setActiveStudySource] = useState<ActiveStudySource | null>(null)
  const [activeStudyVersion, setActiveStudyVersion] = useState(0)

  // Multi-language state
  const [langInit] = useState(getInitialLanguages)
  const [learningLanguages, setLearningLanguages] = useState<string[]>(langInit.learning)
  const [activeLanguage, setActiveLanguageState] = useState<string>(langInit.active)

  const setActiveStudyWords = useCallback((words: Word[], opts?: { label?: string; source?: ActiveStudySource }) => {
    const w = words.filter(Boolean)
    if (w.length === 0) {
      setActiveStudyWordsState(null)
      setActiveStudyLabel(null)
      setActiveStudySource(null)
      return
    }
    setActiveStudyWordsState(w)
    setActiveStudyLabel(opts?.label ?? `${w.length} words`)
    setActiveStudySource(opts?.source ?? 'custom')
    setActiveStudyVersion(v => v + 1)
  }, [])

  const clearActiveStudyWords = useCallback(() => {
    setActiveStudyWordsState(null)
    setActiveStudyLabel(null)
    setActiveStudySource(null)
    setActiveStudyVersion(v => v + 1)
  }, [])

  // Persist language changes to preferences
  const persistLanguages = useCallback((langs: string[], active: string) => {
    try {
      const raw = localStorage.getItem('lingua-preferences')
      const prefs = raw ? JSON.parse(raw) : {}
      prefs.learningLanguages = langs
      prefs.activeLanguage = active
      localStorage.setItem('lingua-preferences', JSON.stringify(prefs))
    } catch { /* ignore */ }
  }, [])

  const setActiveLanguage = useCallback((lang: string) => {
    setActiveLanguageState(lang)
    setLearningLanguages(prev => {
      const next = prev.includes(lang) ? prev : [...prev, lang]
      persistLanguages(next, lang)
      return next
    })
  }, [persistLanguages])

  const addLearningLanguage = useCallback((lang: string) => {
    setLearningLanguages(prev => {
      if (prev.includes(lang)) return prev
      const next = [...prev, lang]
      persistLanguages(next, activeLanguage || lang)
      if (!activeLanguage) setActiveLanguageState(lang)
      return next
    })
  }, [persistLanguages, activeLanguage])

  const removeLearningLanguage = useCallback((lang: string) => {
    setLearningLanguages(prev => {
      const next = prev.filter(l => l !== lang)
      const newActive = lang === activeLanguage ? (next[0] || '') : activeLanguage
      if (lang === activeLanguage) setActiveLanguageState(newActive)
      persistLanguages(next, newActive)
      return next
    })
  }, [persistLanguages, activeLanguage])

  useEffect(() => {
    syncPrefsFromOnboardingIfNeeded()
  }, [])

  useEffect(() => {
    api.isAvailable().then(ok => {
      setHubAvailable(ok)
      if (ok) {
        api.getLists(USER_ID).then(setLists)
        api.getStats(USER_ID).then(s => {
          setTotalWords(s.total_words)
          setTotalReviewed(s.total_reviews)
          setWordsMastered(s.words_learned)
          setDaysUsed(s.streak?.total_days ?? 0)
        }).catch(() => {})
      }
    })
  }, [])

  const refreshLists = () => {
    api.getLists(USER_ID).then(setLists)
  }

  return (
    <AppCtx.Provider value={{
      activeTool, setActiveTool,
      lists, currentListId, setCurrentListId,
      refreshLists, userId: USER_ID, hubAvailable,
      wordsDue, setWordsDue,
      totalWords, setTotalWords,
      totalReviewed, setTotalReviewed,
      wordsMastered, setWordsMastered,
      daysUsed, setDaysUsed,
      activeStudyWords, activeStudyLabel, activeStudySource, activeStudyVersion,
      setActiveStudyWords, clearActiveStudyWords,
      learningLanguages, activeLanguage, setActiveLanguage,
      addLearningLanguage, removeLearningLanguage,
    }}>
      {children}
    </AppCtx.Provider>
  )
}
