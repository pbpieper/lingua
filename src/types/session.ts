/**
 * Client-side daily session & preferences (Creative Hub remains source of truth for words).
 */

import type { LinguaToolId } from '@/types/tools'

/** Daily session categories */
export type SessionCategory =
  | 'new-words'
  | 'reading'
  | 'writing'
  | 'speaking'
  | 'listening'
  | 'review'
  | 'intake'
  | 'reflect'

/** One row in the guided "today's session" checklist */
export interface SessionStep {
  id: string
  category: SessionCategory
  toolId: LinguaToolId
  icon: string
  name: string
  description: string
  estimatedMinutes: number
}

export interface DailyPlanProgress {
  /** ISO date YYYY-MM-DD this plan applies to */
  dateKey: string
  completedStepIds: string[]
  /** Shown debrief modal after full completion */
  debriefShown: boolean
}

/** Tracks which tool was last used per category for rotation */
export interface CategoryToolHistory {
  /** Map of category -> array of toolIds used (most recent last) */
  history: Partial<Record<SessionCategory, LinguaToolId[]>>
  /** Last updated ISO date */
  updatedAt: string
}

/** Proficiency level from onboarding */
export type ProficiencyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface LinguaLearningPrefs {
  /** Target new lemmas per day (drives copy + future queue logic) */
  targetNewWordsPerDay: number
  /** Last debrief: -1 too few, 0 ok, 1 too many */
  lastNewWordsFeedback: -1 | 0 | 1 | null
  /** Last debrief: tools enjoyment (true = liked, false = disliked, null = not answered) */
  lastToolsFeedback: boolean | null
  /** Last debrief: tomorrow focus preference */
  lastTomorrowFocus: 'same' | 'new' | 'surprise' | null
  updatedAt: string
}

export type ActiveStudySource = 'custom' | 'session'
