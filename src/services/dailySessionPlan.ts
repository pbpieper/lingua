/**
 * Builds the guided daily session with mandatory categories,
 * day-to-day tool rotation, and level-adaptive task selection.
 */

import type { VocabSession } from '@/types/word'
import type { SessionStep, SessionCategory, ProficiencyLevel } from '@/types/session'
import type { LinguaToolId } from '@/types/tools'
import { TOOLS } from '@/types/tools'
import { todayKey, getLastToolForCategory, getUserLevel, recordCategoryToolUsage } from '@/services/clientStore'

function nameFor(toolId: LinguaToolId): string {
  return TOOLS.find(t => t.id === toolId)?.label ?? toolId
}

// --- Tool pools per category ---

/** Tools available for each category, ordered by preference */
const CATEGORY_TOOLS: Record<SessionCategory, LinguaToolId[]> = {
  'new-words': ['upload', 'wordbank', 'prelearn'],
  reading: ['stories', 'cloze', 'prelearn', 'reading'],
  writing: ['writing', 'fillblank', 'phrases'],
  speaking: ['speaking'],
  listening: ['listening'],
  review: ['flashcards', 'multichoice', 'match', 'fillblank'],
  intake: ['upload', 'wordbank', 'prelearn'],
  reflect: ['universe', 'dashboard'],
}

/** Level-based tool adjustments: restrict or prefer certain tools per level band */
const LEVEL_ADJUSTMENTS: Record<string, Partial<Record<SessionCategory, LinguaToolId[]>>> = {
  beginner: {
    // A1-A2: more visual, simpler
    reading: ['stories', 'reading'],
    writing: ['fillblank', 'phrases'],
    review: ['flashcards', 'match', 'multichoice'],
  },
  intermediate: {
    // B1-B2: balanced mix
    reading: ['stories', 'cloze', 'prelearn', 'reading'],
    writing: ['writing', 'fillblank', 'phrases'],
    review: ['flashcards', 'multichoice', 'match', 'fillblank'],
  },
  advanced: {
    // C1-C2: emphasis on reading/writing, complex tasks
    reading: ['prelearn', 'stories', 'cloze', 'reading'],
    writing: ['writing', 'phrases', 'fillblank'],
    review: ['flashcards', 'fillblank', 'multichoice'],
  },
}

function levelBand(level: ProficiencyLevel): 'beginner' | 'intermediate' | 'advanced' {
  if (level === 'A1' || level === 'A2') return 'beginner'
  if (level === 'B1' || level === 'B2') return 'intermediate'
  return 'advanced'
}

/** Category display metadata */
const CATEGORY_META: Record<SessionCategory, { icon: string; label: string; estimatedMinutes: number }> = {
  'new-words': { icon: '\u2728', label: 'New Words', estimatedMinutes: 3 },
  reading: { icon: '\u{1F4D6}', label: 'Reading', estimatedMinutes: 5 },
  writing: { icon: '\u270D\uFE0F', label: 'Writing', estimatedMinutes: 4 },
  speaking: { icon: '\u{1F5E3}\uFE0F', label: 'Speaking', estimatedMinutes: 4 },
  listening: { icon: '\u{1F442}', label: 'Listening', estimatedMinutes: 3 },
  review: { icon: '\u{1F503}', label: 'Review', estimatedMinutes: 5 },
  intake: { icon: '\u{1F4E5}', label: 'Intake', estimatedMinutes: 8 },
  reflect: { icon: '\u{1F30C}', label: 'Reflect', estimatedMinutes: 2 },
}

/**
 * Pick the next tool for a category using rotation logic.
 * Avoids repeating the same tool as last time.
 */
function pickToolForCategory(
  category: SessionCategory,
  level: ProficiencyLevel,
  _dateKey: string,
): LinguaToolId {
  const band = levelBand(level)
  const adjustments = LEVEL_ADJUSTMENTS[band]
  const pool = adjustments?.[category] ?? CATEGORY_TOOLS[category]

  if (pool.length <= 1) return pool[0]

  const lastUsed = getLastToolForCategory(category)

  // Pick the first tool that isn't the same as last used
  const candidate = pool.find(t => t !== lastUsed)
  return candidate ?? pool[0]
}

/** Generate a description for a step given its category and tool */
function descriptionForStep(category: SessionCategory, toolId: LinguaToolId, wordsDue: number, newWordsTarget: number): string {
  switch (category) {
    case 'new-words':
      if (toolId === 'upload') return `Introduce ${newWordsTarget} new words from your upload bank`
      if (toolId === 'wordbank') return `Browse and add ${newWordsTarget} new words`
      if (toolId === 'prelearn') return `Pre-learn vocabulary from a text`
      return `Learn ${newWordsTarget} new words today`
    case 'reading':
      if (toolId === 'stories') return 'Read a graded story with comprehension'
      if (toolId === 'cloze') return 'Fill missing words in context sentences'
      if (toolId === 'prelearn') return 'Read a text and learn new vocabulary'
      if (toolId === 'reading') return 'Interactive reading practice'
      return 'Reading practice'
    case 'writing':
      if (toolId === 'writing') return 'Free writing with AI correction'
      if (toolId === 'fillblank') return 'Complete sentences with the right words'
      if (toolId === 'phrases') return 'Practice real-world phrase scenarios'
      return 'Writing practice'
    case 'speaking':
      return 'Pronunciation and conversation drills'
    case 'listening':
      return 'Listen and type what you hear'
    case 'review': {
      if (toolId === 'flashcards') {
        const n = Math.min(wordsDue, 20)
        return wordsDue > 0
          ? `Spaced repetition \u2014 ${n} card${n === 1 ? '' : 's'} due`
          : 'All caught up! Quick refresher quiz instead'
      }
      if (toolId === 'multichoice') return 'Test recall with a quick quiz'
      if (toolId === 'match') return 'Match words to translations'
      if (toolId === 'fillblank') return 'Type words in context'
      return 'Review your vocabulary'
    }
    default:
      return 'Practice activity'
  }
}

// --- Public API ---

export interface BuildSessionPlanInput {
  wordsDue: number
  totalWords: number
  streak: number
  recentSessions: VocabSession[]
  listsExist: boolean
  newWordsTarget?: number
}

/**
 * Build the daily session as mandatory category-based micro-tasks.
 * Each category gets exactly one task, with tool rotation for variety.
 */
export function buildDailySessionSteps(input: BuildSessionPlanInput): SessionStep[] {
  const { wordsDue, totalWords, listsExist, newWordsTarget = 20 } = input
  const dateKey = todayKey()
  const level = getUserLevel()

  const steps: SessionStep[] = []

  // Category order: New Words, Reading, Writing, Speaking, Listening, Review
  const categories: SessionCategory[] = [
    'new-words',
    'reading',
    'writing',
    'speaking',
    'listening',
    'review',
  ]

  for (const category of categories) {
    let toolId: LinguaToolId

    // Special logic for review: always use flashcards if words are due
    if (category === 'review') {
      if (wordsDue > 0) {
        toolId = 'flashcards'
      } else if (totalWords >= 4) {
        toolId = pickToolForCategory(category, level, dateKey)
        // Ensure we don't pick flashcards when nothing is due
        if (toolId === 'flashcards') {
          const pool = CATEGORY_TOOLS.review.filter(t => t !== 'flashcards')
          toolId = pool[0] ?? 'multichoice'
        }
      } else {
        // Too few words, skip review or point to upload
        toolId = listsExist ? 'wordbank' : 'upload'
      }
    } else if (category === 'new-words') {
      // New words: prefer upload if no lists, wordbank if lists exist
      if (totalWords === 0 && !listsExist) {
        toolId = 'upload'
      } else {
        toolId = pickToolForCategory(category, level, dateKey)
      }
    } else {
      toolId = pickToolForCategory(category, level, dateKey)
    }

    const meta = CATEGORY_META[category]
    const description = descriptionForStep(category, toolId, wordsDue, newWordsTarget)

    steps.push({
      id: `session-${category}`,
      category,
      toolId,
      icon: meta.icon,
      name: `${meta.label}: ${nameFor(toolId)}`,
      description,
      estimatedMinutes: meta.estimatedMinutes,
    })
  }

  return steps
}

/**
 * Record that a category step was completed with a specific tool.
 * Called when user marks a step done, to inform next day's rotation.
 */
export function recordStepCompletion(category: SessionCategory, toolId: LinguaToolId): void {
  recordCategoryToolUsage(category, toolId)
}

/** Get the category icon for display */
export function categoryIcon(category: SessionCategory): string {
  return CATEGORY_META[category]?.icon ?? '\u{1F4DD}'
}

/** Get the category label for display */
export function categoryLabel(category: SessionCategory): string {
  return CATEGORY_META[category]?.label ?? category
}
