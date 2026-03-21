import { useState, useCallback } from 'react'

interface VirtualKeyboardProps {
  /** Target language code (e.g. 'ar', 'ru', 'ja', 'ko', 'zh') */
  locale: string
  /** Callback when a character is pressed */
  onChar: (char: string) => void
  /** Callback for backspace */
  onBackspace?: () => void
  /** Callback for space */
  onSpace?: () => void
}

// Character layouts by language
const LAYOUTS: Record<string, string[][]> = {
  ar: [
    ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
    ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
    ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ'],
    ['ذ', 'أ', 'إ', 'آ', 'ّ', 'َ', 'ُ', 'ِ', 'ً', 'ٌ', 'ٍ'],
  ],
  ru: [
    ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
    ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
    ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', 'ё'],
  ],
  ja: [
    ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ'],
    ['さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と'],
    ['な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ'],
    ['ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ', 'ら', 'り'],
    ['る', 'れ', 'ろ', 'わ', 'を', 'ん', 'っ', 'ー'],
  ],
  ko: [
    ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ'],
    ['ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ'],
    ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ'],
  ],
  zh: [
    // Pinyin helpers — common finals and tones
    ['ā', 'á', 'ǎ', 'à', 'ē', 'é', 'ě', 'è', 'ī', 'í', 'ǐ', 'ì'],
    ['ō', 'ó', 'ǒ', 'ò', 'ū', 'ú', 'ǔ', 'ù', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
  ],
}

/** Languages that have a virtual keyboard layout available */
const SUPPORTED_LOCALES = new Set(Object.keys(LAYOUTS))

export function hasKeyboardLayout(locale: string): boolean {
  return SUPPORTED_LOCALES.has(locale.toLowerCase())
}

export function VirtualKeyboard({ locale, onChar, onBackspace, onSpace }: VirtualKeyboardProps) {
  const layout = LAYOUTS[locale.toLowerCase()]
  if (!layout) return null

  const isRtl = locale === 'ar'

  return (
    <div
      className="flex flex-col gap-1 py-2"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {layout.map((row, rowIdx) => (
        <div key={rowIdx} className="flex justify-center gap-1">
          {row.map(char => (
            <button
              key={char}
              onClick={() => onChar(char)}
              className="min-w-[28px] h-9 px-1 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              type="button"
            >
              {char}
            </button>
          ))}
        </div>
      ))}

      {/* Bottom row: backspace + space */}
      <div className="flex justify-center gap-1 mt-1">
        {onBackspace && (
          <button
            onClick={onBackspace}
            className="px-3 h-9 rounded-lg text-xs font-medium cursor-pointer"
            style={{
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            type="button"
          >
            ← Backspace
          </button>
        )}
        {onSpace && (
          <button
            onClick={onSpace}
            className="px-8 h-9 rounded-lg text-xs font-medium cursor-pointer"
            style={{
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            type="button"
          >
            Space
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Toggleable keyboard wrapper — adds a show/hide button.
 * Use this in tool components near text inputs.
 */
export function ToggleableKeyboard({ locale, onChar, onBackspace, onSpace }: VirtualKeyboardProps) {
  const [visible, setVisible] = useState(false)

  const handleChar = useCallback((char: string) => onChar(char), [onChar])

  if (!hasKeyboardLayout(locale)) return null

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => setVisible(v => !v)}
        className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1.5"
        style={{
          background: visible ? 'var(--color-primary-faded)' : 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: visible ? 'var(--color-primary-main)' : 'var(--color-text-muted)',
        }}
        type="button"
      >
        <span>⌨</span>
        <span>{visible ? 'Hide keyboard' : 'Show keyboard'}</span>
      </button>
      {visible && (
        <VirtualKeyboard
          locale={locale}
          onChar={handleChar}
          onBackspace={onBackspace}
          onSpace={onSpace}
        />
      )}
    </div>
  )
}
