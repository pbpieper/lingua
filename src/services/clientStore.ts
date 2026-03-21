/**
 * Typed localStorage layer — keeps UI/session state out of vocabApi (HTTP).
 */

import type { DailyPlanProgress, LinguaLearningPrefs, CategoryToolHistory, SessionCategory, ProficiencyLevel } from '@/types/session'
import type { LinguaToolId } from '@/types/tools'

const PREFS_KEY = 'lingua-learning-prefs'
const TOOL_HISTORY_KEY = 'lingua-category-tool-history'

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function planStorageKey(dateKey: string): string {
  return `lingua-daily-plan-${dateKey}`
}

export function loadDailyPlanProgress(dateKey: string = todayKey()): DailyPlanProgress {
  try {
    const raw = localStorage.getItem(planStorageKey(dateKey))
    if (raw) {
      const data = JSON.parse(raw) as Partial<DailyPlanProgress> & { completedSteps?: string[] }
      return {
        dateKey,
        completedStepIds: data.completedStepIds ?? data.completedSteps ?? [],
        debriefShown: data.debriefShown ?? false,
      }
    }
  } catch { /* ignore */ }
  return { dateKey, completedStepIds: [], debriefShown: false }
}

export function saveDailyPlanProgress(progress: DailyPlanProgress): void {
  localStorage.setItem(planStorageKey(progress.dateKey), JSON.stringify(progress))
}

export function markStepComplete(dateKey: string, stepId: string): DailyPlanProgress {
  const cur = loadDailyPlanProgress(dateKey)
  if (cur.completedStepIds.includes(stepId)) return cur
  const next: DailyPlanProgress = {
    ...cur,
    completedStepIds: [...cur.completedStepIds, stepId],
  }
  saveDailyPlanProgress(next)
  return next
}

export function setDebriefShown(dateKey: string, shown: boolean): void {
  const cur = loadDailyPlanProgress(dateKey)
  saveDailyPlanProgress({ ...cur, debriefShown: shown })
}

// --- Learning Preferences ---

const DEFAULT_PREFS: LinguaLearningPrefs = {
  targetNewWordsPerDay: 20,
  lastNewWordsFeedback: null,
  lastToolsFeedback: null,
  lastTomorrowFocus: null,
  updatedAt: new Date(0).toISOString(),
}

export function loadLearningPrefs(): LinguaLearningPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS, updatedAt: new Date().toISOString() }
    const p = JSON.parse(raw) as Partial<LinguaLearningPrefs>
    return {
      targetNewWordsPerDay: Math.min(60, Math.max(5, p.targetNewWordsPerDay ?? DEFAULT_PREFS.targetNewWordsPerDay)),
      lastNewWordsFeedback: p.lastNewWordsFeedback ?? null,
      lastToolsFeedback: p.lastToolsFeedback ?? null,
      lastTomorrowFocus: p.lastTomorrowFocus ?? null,
      updatedAt: p.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return { ...DEFAULT_PREFS, updatedAt: new Date().toISOString() }
  }
}

export function saveLearningPrefs(prefs: LinguaLearningPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, updatedAt: new Date().toISOString() }))
}

/** Seed prefs from onboarding once (first run). */
export function syncPrefsFromOnboardingIfNeeded(): void {
  if (localStorage.getItem(PREFS_KEY)) return
  const base = (): LinguaLearningPrefs => ({
    targetNewWordsPerDay: 20,
    lastNewWordsFeedback: null,
    lastToolsFeedback: null,
    lastTomorrowFocus: null,
    updatedAt: new Date().toISOString(),
  })
  try {
    const raw = localStorage.getItem('lingua-onboarding')
    if (!raw) {
      saveLearningPrefs(base())
      return
    }
    const o = JSON.parse(raw) as { dailyMinutes?: number }
    const minutes = o.dailyMinutes ?? 10
    const approxWords = Math.min(40, Math.max(10, Math.round(minutes * 2)))
    saveLearningPrefs({
      ...base(),
      targetNewWordsPerDay: approxWords,
    })
  } catch {
    saveLearningPrefs(base())
  }
}

// --- Category Tool Rotation History ---

export function loadCategoryToolHistory(): CategoryToolHistory {
  try {
    const raw = localStorage.getItem(TOOL_HISTORY_KEY)
    if (raw) {
      const data = JSON.parse(raw) as Partial<CategoryToolHistory>
      return {
        history: data.history ?? {},
        updatedAt: data.updatedAt ?? new Date().toISOString(),
      }
    }
  } catch { /* ignore */ }
  return { history: {}, updatedAt: new Date().toISOString() }
}

export function saveCategoryToolHistory(h: CategoryToolHistory): void {
  localStorage.setItem(TOOL_HISTORY_KEY, JSON.stringify(h))
}

/** Record that a tool was used for a category today. Keeps max 10 entries per category. */
export function recordCategoryToolUsage(category: SessionCategory, toolId: LinguaToolId): void {
  const h = loadCategoryToolHistory()
  const list = h.history[category] ?? []
  list.push(toolId)
  if (list.length > 10) list.splice(0, list.length - 10)
  h.history[category] = list
  h.updatedAt = new Date().toISOString()
  saveCategoryToolHistory(h)
}

/** Get the last tool used for a category. */
export function getLastToolForCategory(category: SessionCategory): LinguaToolId | null {
  const h = loadCategoryToolHistory()
  const list = h.history[category]
  if (!list || list.length === 0) return null
  return list[list.length - 1]
}

// --- Proficiency helpers ---

export function getUserLevel(): ProficiencyLevel {
  try {
    const raw = localStorage.getItem('lingua-onboarding')
    if (raw) {
      const data = JSON.parse(raw) as { level?: string }
      const level = data.level?.toUpperCase()
      if (level && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
        return level as ProficiencyLevel
      }
    }
  } catch { /* ignore */ }
  return 'A1'
}
