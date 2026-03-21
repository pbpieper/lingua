import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import type { Word } from '@/types/word'

// ---------------------------------------------------------------------------
// Fallback high-frequency words for when no user words exist
// ---------------------------------------------------------------------------

interface FallbackWord {
  lemma: string
  translation: string
  pronunciation: string | null
  part_of_speech: string | null
  example_sentence: string | null
  example_translation: string | null
}

const FALLBACK_WORDS: Record<string, FallbackWord[]> = {
  es: [
    { lemma: 'hola', translation: 'hello', pronunciation: '/o.la/', part_of_speech: 'interjection', example_sentence: 'Hola, \u00BFc\u00F3mo est\u00E1s?', example_translation: 'Hello, how are you?' },
    { lemma: 'gracias', translation: 'thank you', pronunciation: '/gra.sjas/', part_of_speech: 'interjection', example_sentence: 'Muchas gracias por tu ayuda.', example_translation: 'Thank you very much for your help.' },
    { lemma: 'amigo', translation: 'friend', pronunciation: '/a.mi.go/', part_of_speech: 'noun', example_sentence: '\u00C9l es mi mejor amigo.', example_translation: 'He is my best friend.' },
    { lemma: 'tiempo', translation: 'time / weather', pronunciation: '/tjem.po/', part_of_speech: 'noun', example_sentence: 'No tengo tiempo hoy.', example_translation: "I don't have time today." },
    { lemma: 'querer', translation: 'to want / to love', pronunciation: '/ke.rer/', part_of_speech: 'verb', example_sentence: 'Quiero aprender espa\u00F1ol.', example_translation: 'I want to learn Spanish.' },
  ],
  fr: [
    { lemma: 'bonjour', translation: 'hello / good day', pronunciation: '/b\u0254\u0303.\u0292u\u0281/', part_of_speech: 'interjection', example_sentence: 'Bonjour, comment allez-vous?', example_translation: 'Hello, how are you?' },
    { lemma: 'merci', translation: 'thank you', pronunciation: '/m\u025B\u0281.si/', part_of_speech: 'interjection', example_sentence: 'Merci beaucoup!', example_translation: 'Thank you very much!' },
    { lemma: 'maison', translation: 'house', pronunciation: '/m\u025B.z\u0254\u0303/', part_of_speech: 'noun', example_sentence: 'La maison est grande.', example_translation: 'The house is big.' },
  ],
  de: [
    { lemma: 'Freund', translation: 'friend', pronunciation: '/f\u0281\u0254\u028Fnt/', part_of_speech: 'noun', example_sentence: 'Er ist mein bester Freund.', example_translation: 'He is my best friend.' },
    { lemma: 'Danke', translation: 'thank you', pronunciation: '/da\u014B.k\u0259/', part_of_speech: 'interjection', example_sentence: 'Danke f\u00FCr Ihre Hilfe.', example_translation: 'Thank you for your help.' },
  ],
}

// ---------------------------------------------------------------------------
// Deterministic "word of the day" pick based on date
// ---------------------------------------------------------------------------

function getDayIndex(): number {
  const now = new Date()
  // Days since epoch — gives a different index each day
  return Math.floor(now.getTime() / 86400000)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  words: Word[]
  targetLanguage: string
  onAddToWordBank?: () => void
}

export function WordOfTheDay({ words, targetLanguage, onAddToWordBank }: Props) {
  const [flipped, setFlipped] = useState(false)

  const word = useMemo(() => {
    const dayIdx = getDayIndex()

    // Prefer user's words (unseen or low exposure first)
    if (words.length > 0) {
      // Sort by exposure_count ascending to prioritize new words
      const sorted = [...words].sort((a, b) => a.exposure_count - b.exposure_count)
      const idx = dayIdx % sorted.length
      return sorted[idx]
    }

    // Fallback: use built-in words
    const fallback = FALLBACK_WORDS[targetLanguage] ?? FALLBACK_WORDS.es ?? []
    if (fallback.length === 0) return null
    const idx = dayIdx % fallback.length
    const fw = fallback[idx]
    return {
      id: -1,
      lemma: fw.lemma,
      translation: fw.translation,
      pronunciation: fw.pronunciation,
      part_of_speech: fw.part_of_speech,
      example_sentence: fw.example_sentence,
      example_translation: fw.example_translation,
    } as Partial<Word>
  }, [words, targetLanguage])

  const handleFlip = useCallback(() => {
    setFlipped(f => !f)
  }, [])

  if (!word) return null

  const isFromBank = (word as Word).id > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">&#127775;</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Word of the Day
        </h3>
      </div>

      <button
        type="button"
        onClick={handleFlip}
        className="w-full text-left cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-shadow hover:shadow-md"
        style={{ perspective: 1000 }}
      >
        <AnimatePresence mode="wait">
          {!flipped ? (
            /* Front: word + pronunciation */
            <motion.div
              key="front"
              className="px-5 py-4"
              initial={{ rotateY: -90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: 90, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-bold text-[var(--color-text-primary)]">
                    {word.lemma}
                  </p>
                  {word.pronunciation && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">
                      {word.pronunciation}
                    </p>
                  )}
                  {word.part_of_speech && (
                    <span className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-primary-faded)] text-[var(--color-primary-main)]">
                      {word.part_of_speech}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0 mt-1">
                  Tap to flip
                </span>
              </div>
            </motion.div>
          ) : (
            /* Back: translation + example */
            <motion.div
              key="back"
              className="px-5 py-4"
              initial={{ rotateY: -90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: 90, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <p className="text-lg font-bold text-[var(--color-primary-main)]">
                {word.translation}
              </p>
              {word.example_sentence && (
                <div className="mt-2 space-y-0.5">
                  <p className="text-sm text-[var(--color-text-primary)] italic">
                    &ldquo;{word.example_sentence}&rdquo;
                  </p>
                  {word.example_translation && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {word.example_translation}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-[var(--color-text-muted)]">
                  Tap to flip back
                </span>
                {!isFromBank && onAddToWordBank && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddToWordBank()
                      toast.success('Navigate to Upload to add this word')
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onAddToWordBank() } }}
                    className="text-xs font-medium px-3 py-1 rounded-lg bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity"
                  >
                    + Add to Word Bank
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  )
}
