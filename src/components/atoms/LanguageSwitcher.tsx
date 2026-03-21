import { useApp } from '@/context/AppContext'

/* ------------------------------------------------------------------ */
/*  Language flag / label map                                          */
/* ------------------------------------------------------------------ */

const LANG_META: Record<string, { flag: string; label: string }> = {
  ar: { flag: '\uD83C\uDDF8\uD83C\uDDE6', label: 'Arabic' },
  de: { flag: '\uD83C\uDDE9\uD83C\uDDEA', label: 'German' },
  es: { flag: '\uD83C\uDDEA\uD83C\uDDF8', label: 'Spanish' },
  fr: { flag: '\uD83C\uDDEB\uD83C\uDDF7', label: 'French' },
  hi: { flag: '\uD83C\uDDEE\uD83C\uDDF3', label: 'Hindi' },
  it: { flag: '\uD83C\uDDEE\uD83C\uDDF9', label: 'Italian' },
  ja: { flag: '\uD83C\uDDEF\uD83C\uDDF5', label: 'Japanese' },
  ko: { flag: '\uD83C\uDDF0\uD83C\uDDF7', label: 'Korean' },
  nl: { flag: '\uD83C\uDDF3\uD83C\uDDF1', label: 'Dutch' },
  pl: { flag: '\uD83C\uDDF5\uD83C\uDDF1', label: 'Polish' },
  pt: { flag: '\uD83C\uDDE7\uD83C\uDDF7', label: 'Portuguese' },
  ru: { flag: '\uD83C\uDDF7\uD83C\uDDFA', label: 'Russian' },
  sv: { flag: '\uD83C\uDDF8\uD83C\uDDEA', label: 'Swedish' },
  tr: { flag: '\uD83C\uDDF9\uD83C\uDDF7', label: 'Turkish' },
  zh: { flag: '\uD83C\uDDE8\uD83C\uDDF3', label: 'Chinese' },
  en: { flag: '\uD83C\uDDEC\uD83C\uDDE7', label: 'English' },
}

function getMeta(code: string) {
  return LANG_META[code] ?? { flag: '\uD83C\uDF10', label: code.toUpperCase() }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface LanguageSwitcherProps {
  compact?: boolean
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { learningLanguages, activeLanguage, setActiveLanguage } = useApp()

  if (learningLanguages.length <= 1) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {learningLanguages.map(lang => {
        const meta = getMeta(lang)
        const isActive = lang === activeLanguage
        return (
          <button
            key={lang}
            onClick={() => setActiveLanguage(lang)}
            title={meta.label}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer
              ${isActive
                ? 'bg-[var(--color-primary-main)] text-white shadow-sm scale-105'
                : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
              }`}
          >
            <span className="text-sm">{meta.flag}</span>
            {!compact && <span>{meta.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
