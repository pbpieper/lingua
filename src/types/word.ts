export interface Word {
  id: number
  user_id: string
  list_id: number | null
  lemma: string
  translation: string
  language_from: string
  language_to: string
  part_of_speech: string | null
  gender: string | null
  pronunciation: string | null
  example_sentence: string | null
  example_translation: string | null
  tags: string[]
  cefr_level: string | null
  exposure_count: number
  last_seen: string | null
  ease_factor: number
  interval_days: number
  next_review: string | null
  stability: number
  difficulty: number
  reps: number
  created_at: string
}

export interface WordInput {
  lemma: string
  translation: string
  language_from?: string
  language_to?: string
  part_of_speech?: string
  gender?: string
  pronunciation?: string
  example_sentence?: string
  example_translation?: string
  tags?: string[]
  cefr_level?: string
}

export interface ReviewResult {
  word_id: number
  quality: number // 0-5: 0=blackout, 3=correct-hard, 5=perfect
  user_id: string
}

export interface VocabList {
  id: number
  user_id: string
  name: string
  language_from: string
  language_to: string
  description: string | null
  word_count: number
  deadline?: string | null
  created_at: string
}

export interface VocabSession {
  id: number
  user_id: string
  tool_id: string
  list_id: number | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  words_reviewed: number
  correct: number
  wrong: number
  score_data: Record<string, unknown> | null
}

export interface VocabStats {
  total_words: number
  words_learned: number
  words_due: number
  total_reviews: number
  accuracy: number
  streak: { current: number; longest: number; total_days: number }
  daily_stats: Array<{
    date: string
    reviews: number
    correct: number
    new_words: number
    time_seconds: number
  }>
}
