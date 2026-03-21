import { useMemo } from 'react'
import { usePreferences } from './usePreferences'

export interface LearningLocales {
  /** Language code for the UI interface (defaults to 'en') */
  uiLocale: string
  /** User's native language — used for translations and hints */
  nativeLocale: string
  /** The language being learned — all target content should be in this language */
  targetLocale: string
  /** Language for hints (usually same as nativeLocale) */
  hintLocale: string
  /** Display name for the target language */
  targetName: string
  /** Display name for the native language */
  nativeName: string
}

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  nl: 'Dutch',
  pt: 'Portuguese',
  ru: 'Russian',
  tr: 'Turkish',
  zh: 'Chinese',
}

function langName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code
}

/**
 * Centralized locale hook — single source of truth for language config.
 * All AI-generation and display code should use this instead of ad-hoc language params.
 *
 * - targetLocale = language_from on words (the language being learned)
 * - nativeLocale = language_to on words (the user's known language)
 */
export function useLearningLocales(): LearningLocales {
  const { prefs } = usePreferences()

  return useMemo(() => {
    const targetLocale = prefs.defaultLangFrom || 'ar'
    const nativeLocale = prefs.defaultLangTo || 'en'

    return {
      uiLocale: 'en',
      nativeLocale,
      targetLocale,
      hintLocale: nativeLocale,
      targetName: langName(targetLocale),
      nativeName: langName(nativeLocale),
    }
  }, [prefs.defaultLangFrom, prefs.defaultLangTo])
}

/**
 * Dev-mode assertion: logs a warning if content language doesn't match expected locale.
 * Call this in components that generate or display localized content.
 */
export function assertLocaleMatch(
  context: string,
  expected: string,
  actual: string,
): void {
  if (import.meta.env.DEV && expected && actual && expected.toLowerCase() !== actual.toLowerCase()) {
    console.warn(
      `[Lingua locale mismatch] ${context}: expected "${expected}", got "${actual}"`,
    )
  }
}
