/**
 * Helpers for reading local (offline) vocabulary stored in localStorage.
 * Used by practice tools when the backend is not available.
 */

import type { Word } from '@/types/word'

const LS_WORDS_KEY = 'lingua-local-words'

/**
 * Load locally stored words as full Word objects.
 * The starter pack and manual imports store partial data, so we fill in defaults.
 */
export function getLocalWords(): Word[] {
  try {
    const raw = localStorage.getItem(LS_WORDS_KEY)
    if (!raw) return []
    const items = JSON.parse(raw) as Array<Record<string, unknown>>
    return items.map((w, i) => ({
      id: (w.id as number) ?? i + 1,
      user_id: (w.user_id as string) ?? '',
      list_id: (w.list_id as number | null) ?? null,
      lemma: (w.lemma as string) ?? '',
      translation: (w.translation as string) ?? '',
      language_from: (w.language_from as string) ?? '',
      language_to: (w.language_to as string) ?? '',
      part_of_speech: (w.part_of_speech as string | null) ?? null,
      gender: (w.gender as string | null) ?? null,
      pronunciation: (w.pronunciation as string | null) ?? null,
      example_sentence: (w.example_sentence as string | null) ?? null,
      example_translation: (w.example_translation as string | null) ?? null,
      tags: (w.tags as string[]) ?? [],
      cefr_level: (w.cefr_level as string | null) ?? null,
      exposure_count: (w.exposure_count as number) ?? 0,
      last_seen: (w.last_seen as string | null) ?? null,
      ease_factor: (w.ease_factor as number) ?? 2.5,
      interval_days: (w.interval_days as number) ?? 0,
      next_review: (w.next_review as string | null) ?? null,
      stability: (w.stability as number) ?? 0,
      difficulty: (w.difficulty as number) ?? 0,
      reps: (w.reps as number) ?? 0,
      created_at: (w.created_at as string) ?? new Date().toISOString(),
    }))
  } catch {
    return []
  }
}

/** Shuffle an array (Fisher-Yates) */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
