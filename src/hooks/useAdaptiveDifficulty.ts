import { useState, useCallback, useMemo } from 'react'

export type AnswerCategory =
  | 'spelling'
  | 'meaning'
  | 'grammar'
  | 'gender'
  | 'verb-forms'
  | 'listening'
  | 'general'

interface AnswerRecord {
  correct: boolean
  category: AnswerCategory
  timestamp: number
}

export interface AdaptiveState {
  difficulty: number          // 1-5 (1=easiest)
  recentAccuracy: number      // 0-100
  answerCount: number         // total answers in current window
  weakAreas: string[]         // e.g. ['spelling', 'gender', 'verb-forms']
  recommendation: string      // e.g. 'Focus on Fill Blank to practice spelling'
  recordAnswer: (correct: boolean, category?: string) => void
  resetSession: () => void
}

const WINDOW_SIZE = 50
const MIN_CATEGORY_ANSWERS = 5
const WEAK_THRESHOLD = 60

/** Map a 0-100 accuracy to difficulty 1-5 */
function accuracyToDifficulty(accuracy: number): number {
  if (accuracy < 40) return 1
  if (accuracy < 55) return 2
  if (accuracy < 70) return 3
  if (accuracy < 85) return 4
  return 5
}

/** Map weak areas to tool recommendations */
const CATEGORY_RECOMMENDATIONS: Record<AnswerCategory, string> = {
  spelling: 'Focus on Fill Blank to practice spelling',
  meaning: 'Try Flashcards or Match to reinforce word meanings',
  grammar: 'Work through Grammar lessons to strengthen your rules',
  gender: 'Practice Fill Blank with gendered articles',
  'verb-forms': 'Use Grammar and Cloze exercises for verb conjugation',
  listening: 'Do more Listening practice to train your ear',
  general: '',
}

/** Fallback recommendations based on difficulty when no weak areas found */
function difficultyRecommendation(difficulty: number): string {
  if (difficulty <= 2) return 'Try Match or Quiz for an easier warm-up'
  if (difficulty <= 3) return 'You are progressing well — try Flashcards or Fill Blank'
  return 'Challenge yourself with Writing or Speaking exercises'
}

function computeWeakAreas(answers: AnswerRecord[]): AnswerCategory[] {
  const categoryStats = new Map<AnswerCategory, { correct: number; total: number }>()

  for (const a of answers) {
    const stats = categoryStats.get(a.category) ?? { correct: 0, total: 0 }
    stats.total++
    if (a.correct) stats.correct++
    categoryStats.set(a.category, stats)
  }

  const weak: AnswerCategory[] = []
  for (const [category, stats] of categoryStats) {
    if (category === 'general') continue
    if (stats.total >= MIN_CATEGORY_ANSWERS) {
      const acc = (stats.correct / stats.total) * 100
      if (acc < WEAK_THRESHOLD) {
        weak.push(category)
      }
    }
  }

  return weak
}

function buildRecommendation(weakAreas: AnswerCategory[], difficulty: number): string {
  if (weakAreas.length === 0) {
    return difficultyRecommendation(difficulty)
  }
  // Recommend based on the first (worst) weak area
  return CATEGORY_RECOMMENDATIONS[weakAreas[0]] || difficultyRecommendation(difficulty)
}

export function useAdaptiveDifficulty(): AdaptiveState {
  const [answers, setAnswers] = useState<AnswerRecord[]>([])

  const recordAnswer = useCallback((correct: boolean, category?: string) => {
    const validCategories: AnswerCategory[] = [
      'spelling', 'meaning', 'grammar', 'gender', 'verb-forms', 'listening', 'general',
    ]
    const cat: AnswerCategory = (category && validCategories.includes(category as AnswerCategory))
      ? category as AnswerCategory
      : 'general'

    setAnswers(prev => {
      const next = [...prev, { correct, category: cat, timestamp: Date.now() }]
      // Keep only the last WINDOW_SIZE answers
      if (next.length > WINDOW_SIZE) {
        return next.slice(next.length - WINDOW_SIZE)
      }
      return next
    })
  }, [])

  const resetSession = useCallback(() => {
    setAnswers([])
  }, [])

  const recentAccuracy = useMemo(() => {
    if (answers.length === 0) return 0
    const correct = answers.filter(a => a.correct).length
    return Math.round((correct / answers.length) * 100)
  }, [answers])

  const difficulty = useMemo(() => accuracyToDifficulty(recentAccuracy), [recentAccuracy])

  const weakAreas = useMemo(() => computeWeakAreas(answers), [answers])

  const recommendation = useMemo(
    () => buildRecommendation(weakAreas, difficulty),
    [weakAreas, difficulty],
  )

  return {
    difficulty,
    recentAccuracy,
    answerCount: answers.length,
    weakAreas,
    recommendation,
    recordAnswer,
    resetSession,
  }
}
