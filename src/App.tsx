import { useState, useCallback } from 'react'
import { ThemeProvider } from '@/design/theme'
import { AuthProvider } from '@/context/AuthContext'
import { AppProvider, useApp } from '@/context/AppContext'
import { AppShell } from '@/components/layout/AppShell'
import { Onboarding, type OnboardingData } from '@/components/onboarding/Onboarding'
import { Toaster } from 'react-hot-toast'
import { XPNotificationHost } from '@/components/atoms/XPNotification'
import { LevelUpCelebration } from '@/components/atoms/LevelUpCelebration'
import * as api from '@/services/vocabApi'
import { getStarterPack } from '@/data/starterPacks'

const ONBOARDING_KEY = 'lingua-onboarding'

function isOnboardingCompleted(): boolean {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY)
    if (!raw) return false
    const data = JSON.parse(raw)
    return data?.completed === true
  } catch {
    return false
  }
}

/** Map onboarding level to CEFR */
function levelToCEFR(level: string): string {
  if (level === 'beginner') return 'A1'
  if (level === 'intermediate') return 'B1'
  return 'B2'
}

/** Map language code to full name for AI generation */
const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic', de: 'German', es: 'Spanish', fr: 'French', it: 'Italian',
  ja: 'Japanese', ko: 'Korean', nl: 'Dutch', pt: 'Portuguese', ru: 'Russian',
  tr: 'Turkish', zh: 'Chinese', hi: 'Hindi', sv: 'Swedish', pl: 'Polish',
}

function AppContent() {
  const [onboarded, setOnboarded] = useState(isOnboardingCompleted)
  const { userId, hubAvailable, refreshLists, setTotalWords } = useApp()

  const handleOnboardingComplete = useCallback((data: OnboardingData) => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(data))
    // Propagate language choices to preferences so Upload/PreLearn use correct defaults
    try {
      const raw = localStorage.getItem('lingua-preferences')
      const prefs = raw ? JSON.parse(raw) : {}
      prefs.defaultLangFrom = data.targetLanguage || ''
      prefs.defaultLangTo = data.nativeLanguage || ''
      localStorage.setItem('lingua-preferences', JSON.stringify(prefs))
    } catch { /* ignore */ }

    // Auto-generate a starter vocabulary list in the background
    if (hubAvailable && data.targetLanguage && data.nativeLanguage) {
      const langName = LANG_NAMES[data.targetLanguage] || data.targetLanguage
      const nativeName = LANG_NAMES[data.nativeLanguage] || data.nativeLanguage
      const cefr = levelToCEFR(data.level)

      api.generateTopicVocab('Essential everyday phrases and greetings', langName, nativeName, cefr, 15)
        .then(async (words) => {
          if (words.length > 0) {
            const list = await api.createList(userId, 'Getting Started', data.targetLanguage, data.nativeLanguage, 'Your first words!')
            await api.uploadWords(userId, list.id, words)
            refreshLists()
            setTotalWords(words.length)
          }
        })
        .catch(() => { /* silently fail — user can still upload manually */ })
    } else if (!hubAvailable && data.targetLanguage) {
      // Offline fallback: load hardcoded starter pack into localStorage
      const pack = getStarterPack(data.targetLanguage)
      if (pack) {
        const starterWords = pack.words.map(w => ({
          ...w,
          language_from: data.targetLanguage,
          language_to: data.nativeLanguage || 'en',
        }))
        try {
          const existing = localStorage.getItem('lingua-local-words')
          const localWords = existing ? JSON.parse(existing) : []
          const merged = [...localWords, ...starterWords]
          localStorage.setItem('lingua-local-words', JSON.stringify(merged))

          // Also store as a local list so the word bank can display it
          const existingLists = localStorage.getItem('lingua-local-lists')
          const localLists = existingLists ? JSON.parse(existingLists) : []
          localLists.push({
            id: Date.now(),
            name: 'Getting Started',
            language_from: data.targetLanguage,
            language_to: data.nativeLanguage || 'en',
            description: 'Your first words!',
            word_count: starterWords.length,
            created_at: new Date().toISOString(),
          })
          localStorage.setItem('lingua-local-lists', JSON.stringify(localLists))
          setTotalWords(starterWords.length)
        } catch { /* silently fail */ }
      }
    }

    setOnboarded(true)
  }, [hubAvailable, userId, refreshLists, setTotalWords])

  if (!onboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return <AppShell />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <AppContent />
          <XPNotificationHost />
          <LevelUpCelebration />
          <Toaster position="bottom-right" />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
