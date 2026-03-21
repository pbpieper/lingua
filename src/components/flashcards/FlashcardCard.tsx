import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Word } from '@/types/word'
import { isRTL } from '@/lib/csvParser'

const LANG_BCP47: Record<string, string> = {
  ar: 'ar-SA', de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR',
  it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', nl: 'nl-NL', pt: 'pt-BR',
  ru: 'ru-RU', tr: 'tr-TR', zh: 'zh-CN',
}

function speakWord(text: string, lang: string) {
  if (!window.speechSynthesis) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = LANG_BCP47[lang] ?? lang
  u.rate = 0.85
  speechSynthesis.speak(u)
}

interface FlashcardCardProps {
  word: Word
  flipped: boolean
  onFlip: () => void
  reversed?: boolean
  onEnrich?: (wordId: number) => void
}

export function FlashcardCard({ word, flipped, onFlip, reversed, onEnrich }: FlashcardCardProps) {
  const [enriching, setEnriching] = useState(false)

  const handleSpeak = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const text = reversed ? word.translation : word.lemma
    const lang = reversed ? word.language_to : word.language_from
    speakWord(text, lang)
  }, [word, reversed])

  const handleEnrich = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEnrich && !enriching) {
      setEnriching(true)
      onEnrich(word.id)
    }
  }
  return (
    <div
      className="cursor-pointer select-none"
      style={{ perspective: 1200 }}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label={flipped ? 'Flip card back' : 'Flip card to reveal answer'}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onFlip()
        }
      }}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformStyle: 'preserve-3d', position: 'relative' }}
      >
        {/* Front */}
        <div
          className="rounded-2xl px-8 py-12 flex flex-col items-center justify-center gap-4 min-h-[320px]"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            backfaceVisibility: 'hidden',
          }}
        >
          {reversed ? (
            <>
              <span
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-accent-dark)' }}
              >
                {word.language_to}
              </span>
              <h2
                className="text-4xl font-bold text-center leading-tight"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {word.translation}
              </h2>
            </>
          ) : (
            <>
              <span
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-primary-main)' }}
              >
                {word.language_from}
              </span>
              <h2
                className="text-4xl font-bold text-center leading-tight"
                style={{ color: 'var(--color-text-primary)' }}
                dir={isRTL(word.language_from) ? 'rtl' : undefined}
              >
                {word.lemma}
              </h2>
              {word.pronunciation && (
                <span
                  className="text-base italic"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {word.pronunciation}
                </span>
              )}
              {word.part_of_speech && (
                <span
                  className="mt-2 px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: 'var(--color-primary-faded)',
                    color: 'var(--color-primary-main)',
                  }}
                >
                  {word.part_of_speech}
                </span>
              )}
              {/* Audio button */}
              <button
                onClick={handleSpeak}
                className="mt-2 p-2 rounded-full border-none cursor-pointer transition-colors"
                style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
                aria-label="Listen to pronunciation"
                title="Listen"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </button>
            </>
          )}

          <span
            className="mt-4 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Tap to reveal
          </span>
        </div>

        {/* Back */}
        <div
          className="rounded-2xl px-8 py-12 flex flex-col items-center justify-center gap-4 min-h-[320px] absolute inset-0"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {reversed ? (
            <>
              <span
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-primary-main)' }}
              >
                {word.language_from}
              </span>
              <h2
                className="text-4xl font-bold text-center leading-tight"
                style={{ color: 'var(--color-text-primary)' }}
                dir={isRTL(word.language_from) ? 'rtl' : undefined}
              >
                {word.lemma}
              </h2>
              {word.pronunciation && (
                <span
                  className="text-base italic"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {word.pronunciation}
                </span>
              )}
              {word.part_of_speech && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: 'var(--color-primary-faded)',
                    color: 'var(--color-primary-main)',
                  }}
                >
                  {word.part_of_speech}
                </span>
              )}
              {word.gender && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: 'var(--color-accent-light)',
                    color: 'var(--color-accent-dark)',
                  }}
                >
                  {word.gender}
                </span>
              )}
            </>
          ) : (
            <>
              <span
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-accent-dark)' }}
              >
                {word.language_to}
              </span>
              <h2
                className="text-4xl font-bold text-center leading-tight"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {word.translation}
              </h2>
              {word.gender && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: 'var(--color-accent-light)',
                    color: 'var(--color-accent-dark)',
                  }}
                >
                  {word.gender}
                </span>
              )}
            </>
          )}

          {word.example_sentence ? (
            <div className="mt-4 text-center max-w-md">
              <p
                className="text-sm italic leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                &ldquo;{word.example_sentence}&rdquo;
              </p>
              {word.example_translation && (
                <p
                  className="text-xs mt-1.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {word.example_translation}
                </p>
              )}
            </div>
          ) : onEnrich ? (
            <button
              className="mt-4 text-xs px-3 py-1 rounded-full cursor-pointer border-none transition-opacity disabled:opacity-50"
              style={{
                background: 'var(--color-primary-faded)',
                color: 'var(--color-primary-main)',
              }}
              disabled={enriching}
              onClick={handleEnrich}
            >
              {enriching ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'var(--color-primary-main)', borderTopColor: 'transparent' }}
                  />
                  Generating...
                </span>
              ) : (
                '\u2728 Generate example'
              )}
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
