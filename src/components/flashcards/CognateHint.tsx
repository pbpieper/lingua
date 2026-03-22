import { useMemo } from 'react'
import { detectCognate, getLanguageName } from '@/lib/cognates'
import type { Word } from '@/types/word'

interface CognateHintProps {
  word: Word
  allWords: Word[]
}

/**
 * Shows a cognate hint on the back of a flashcard if the target word
 * is similar to a word the user already knows in another language.
 */
export function CognateHint({ word, allWords }: CognateHintProps) {
  const cognate = useMemo(() => {
    if (!word.lemma || word.lemma.length < 3) return null

    // Build pool from all words the user knows (excluding this word)
    const pool = allWords
      .filter(w => w.id !== word.id && w.lemma.length >= 3)
      .map(w => ({ word: w.lemma, language: w.language_from }))

    return detectCognate(word.lemma, word.language_from, pool, 0.65)
  }, [word, allWords])

  if (!cognate) return null

  return (
    <div
      className="mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
      style={{
        background: 'var(--color-primary-faded)',
        border: '1px solid var(--color-primary-light, var(--color-border))',
      }}
    >
      <span className="text-base">&#x1F517;</span>
      <span style={{ color: 'var(--color-text-secondary)' }}>
        Similar to <strong style={{ color: 'var(--color-primary-main)' }}>{cognate.word}</strong> in {getLanguageName(cognate.language)} you already know
        {cognate.pattern && (
          <span className="text-[var(--color-text-muted)]"> ({cognate.pattern})</span>
        )}
      </span>
    </div>
  )
}
