import { useState, useCallback, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type XPSource =
  | 'flashcard_review'
  | 'daily_task_category'
  | 'daily_all_complete'
  | 'new_word'
  | 'master_word'
  | 'game_round'
  | 'streak_bonus'
  | 'writing_practice'
  | 'speaking_practice'
  | 'reading_story'
  | 'quick_practice'
  | 'milestone_bonus'

export const XP_VALUES: Record<XPSource, number> = {
  flashcard_review: 1,
  daily_task_category: 25,
  daily_all_complete: 50,
  new_word: 5,
  master_word: 20,
  game_round: 15,
  streak_bonus: 5, // multiplied by streak_days at call site
  writing_practice: 20,
  speaking_practice: 20,
  reading_story: 15,
  quick_practice: 10,
  milestone_bonus: 50,
}

export interface XPEvent {
  amount: number
  source: XPSource
  timestamp: number
}

export interface XPDayEntry {
  date: string // YYYY-MM-DD
  xp: number
}

export interface StreakFreezeData {
  available: number       // how many freezes the user has (starts at 1)
  usedDates: string[]     // dates when a freeze was used
  lastActiveDate: string  // last date user earned XP
}

export interface XPData {
  totalXP: number
  events: XPEvent[]
  history: XPDayEntry[] // last 30 days
  dailyXPGoal: number   // configurable daily target (default 50)
  streakFreeze: StreakFreezeData
}

// ---------------------------------------------------------------------------
// Level system
// ---------------------------------------------------------------------------

export interface LevelInfo {
  level: number
  name: string
  threshold: number
  nextThreshold: number | null
  progress: number // 0-1 within current level
}

const LEVELS = [
  { threshold: 0, name: 'Novice' },
  { threshold: 100, name: 'Bronze' },
  { threshold: 500, name: 'Silver' },
  { threshold: 1500, name: 'Gold' },
  { threshold: 3500, name: 'Platinum' },
  { threshold: 7500, name: 'Diamond' },
  { threshold: 15000, name: 'Master' },
  { threshold: 30000, name: 'Grandmaster' },
  { threshold: 60000, name: 'Legend' },
] as const

export function computeLevel(totalXP: number): LevelInfo {
  let idx = 0
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i].threshold) {
      idx = i
      break
    }
  }
  const current = LEVELS[idx]
  const next = idx + 1 < LEVELS.length ? LEVELS[idx + 1] : null
  const progress = next
    ? (totalXP - current.threshold) / (next.threshold - current.threshold)
    : 1
  return {
    level: idx,
    name: current.name,
    threshold: current.threshold,
    nextThreshold: next?.threshold ?? null,
    progress: Math.min(1, Math.max(0, progress)),
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'lingua-xp-data'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

const DEFAULT_STREAK_FREEZE: StreakFreezeData = {
  available: 1,
  usedDates: [],
  lastActiveDate: '',
}

function loadXPData(): XPData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as XPData
      return {
        ...parsed,
        dailyXPGoal: parsed.dailyXPGoal ?? 50,
        streakFreeze: parsed.streakFreeze ?? { ...DEFAULT_STREAK_FREEZE },
      }
    }
  } catch { /* ignore */ }
  return {
    totalXP: 0,
    events: [],
    history: [],
    dailyXPGoal: 50,
    streakFreeze: { ...DEFAULT_STREAK_FREEZE },
  }
}

function saveXPData(data: XPData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/** Trim history to last 30 days and aggregate by day. */
function trimHistory(history: XPDayEntry[]): XPDayEntry[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return history.filter(h => h.date >= cutoffStr)
}

// ---------------------------------------------------------------------------
// Notification bus (simple event emitter for XP toasts)
// ---------------------------------------------------------------------------

type XPListener = (amount: number, source: XPSource) => void
const listeners = new Set<XPListener>()

export function onXPGain(fn: XPListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emitXPGain(amount: number, source: XPSource): void {
  for (const fn of listeners) fn(amount, source)
}

// ---------------------------------------------------------------------------
// Level-up event bus
// ---------------------------------------------------------------------------

type LevelUpListener = (newLevel: LevelInfo, prevLevel: LevelInfo) => void
const levelUpListeners = new Set<LevelUpListener>()

export function onLevelUp(fn: LevelUpListener): () => void {
  levelUpListeners.add(fn)
  return () => levelUpListeners.delete(fn)
}

function emitLevelUp(newLevel: LevelInfo, prevLevel: LevelInfo): void {
  for (const fn of levelUpListeners) fn(newLevel, prevLevel)
}

// ---------------------------------------------------------------------------
// Streak freeze helpers
// ---------------------------------------------------------------------------

const FREEZE_COST = 100 // XP cost to buy additional freezes

export function canUseStreakFreeze(data: XPData): boolean {
  const today = todayStr()
  const yesterday = yesterdayStr()
  const freeze = data.streakFreeze
  // Can use if: has freezes, missed yesterday, and hasn't already used one today
  return freeze.available > 0
    && freeze.lastActiveDate !== today
    && freeze.lastActiveDate !== yesterday
    && !freeze.usedDates.includes(today)
}

export function useStreakFreeze(data: XPData): XPData {
  if (!canUseStreakFreeze(data)) return data
  const freeze = { ...data.streakFreeze }
  freeze.available -= 1
  freeze.usedDates = [...freeze.usedDates.slice(-30), todayStr()]
  freeze.lastActiveDate = todayStr()
  const next = { ...data, streakFreeze: freeze }
  saveXPData(next)
  return next
}

export function buyStreakFreeze(data: XPData): XPData | null {
  if (data.totalXP < FREEZE_COST) return null
  const next = {
    ...data,
    totalXP: data.totalXP - FREEZE_COST,
    streakFreeze: {
      ...data.streakFreeze,
      available: data.streakFreeze.available + 1,
    },
  }
  saveXPData(next)
  return next
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useXP() {
  const [data, setData] = useState<XPData>(loadXPData)

  const addXP = useCallback((amount: number, source: XPSource) => {
    if (amount <= 0) return

    setData(prev => {
      const prevLevel = computeLevel(prev.totalXP)
      const event: XPEvent = { amount, source, timestamp: Date.now() }
      const today = todayStr()

      // Update history
      const historyCopy = [...prev.history]
      const todayEntry = historyCopy.find(h => h.date === today)
      if (todayEntry) {
        todayEntry.xp += amount
      } else {
        historyCopy.push({ date: today, xp: amount })
      }

      // Update streak freeze last active date
      const streakFreeze = { ...prev.streakFreeze, lastActiveDate: today }

      const next: XPData = {
        ...prev,
        totalXP: prev.totalXP + amount,
        events: [...prev.events.slice(-200), event], // keep last 200 events
        history: trimHistory(historyCopy),
        streakFreeze,
      }
      saveXPData(next)

      // Check for level up (defer emit so state update completes first)
      const newLevel = computeLevel(next.totalXP)
      if (newLevel.level > prevLevel.level) {
        setTimeout(() => emitLevelUp(newLevel, prevLevel), 100)
      }

      return next
    })

    // Notify listeners (for toast display)
    emitXPGain(amount, source)
  }, [])

  const setDailyXPGoal = useCallback((goal: number) => {
    setData(prev => {
      const next = { ...prev, dailyXPGoal: Math.max(10, Math.min(500, goal)) }
      saveXPData(next)
      return next
    })
  }, [])

  const applyStreakFreeze = useCallback(() => {
    setData(prev => {
      if (!canUseStreakFreeze(prev)) return prev
      return useStreakFreeze(prev)
    })
  }, [])

  const purchaseStreakFreeze = useCallback((): boolean => {
    let success = false
    setData(prev => {
      const result = buyStreakFreeze(prev)
      if (result) {
        success = true
        return result
      }
      return prev
    })
    return success
  }, [])

  const totalXP = data.totalXP
  const level = useMemo(() => computeLevel(totalXP), [totalXP])
  const dailyXPGoal = data.dailyXPGoal

  const todayXP = useMemo(() => {
    const today = todayStr()
    return data.history.find(h => h.date === today)?.xp ?? 0
  }, [data.history])

  const dailyGoalProgress = useMemo(() => {
    return Math.min(1, todayXP / dailyXPGoal)
  }, [todayXP, dailyXPGoal])

  const xpHistory = useMemo(() => {
    // Fill in missing days in the last 30 days
    const result: XPDayEntry[] = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const existing = data.history.find(h => h.date === dateStr)
      result.push({ date: dateStr, xp: existing?.xp ?? 0 })
    }
    return result
  }, [data.history])

  const streakFreezeCount = data.streakFreeze.available
  const canFreeze = canUseStreakFreeze(data)

  return {
    totalXP,
    todayXP,
    level,
    xpHistory,
    addXP,
    dailyXPGoal,
    dailyGoalProgress,
    setDailyXPGoal,
    streakFreezeCount,
    canFreeze,
    applyStreakFreeze,
    purchaseStreakFreeze,
  }
}
