/**
 * Spaced Reading — Word Encounter Tracking System
 *
 * Logs every time a user encounters a word across reading, stories, media, etc.
 * Tracks: encounter count, source texts, timestamps, context snippets.
 * All data stored in localStorage for offline-first operation.
 */

export interface WordEncounter {
  word: string
  timestamp: string
  source: string        // e.g., "Reading: My First Story", "Media: Podcast Ep 3"
  sourceType: 'reading' | 'story' | 'media' | 'clipboard' | 'journal' | 'other'
  contextSnippet?: string  // surrounding sentence fragment
}

export interface WordEncounterSummary {
  word: string
  totalEncounters: number
  firstSeen: string
  lastSeen: string
  sources: string[]
  encounters: WordEncounter[]
  timeSpanDays: number
}

const STORAGE_KEY = 'lingua-word-encounters'

function loadEncounters(): WordEncounter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveEncounters(encounters: WordEncounter[]) {
  // Keep last 50,000 encounters to avoid localStorage limits
  const trimmed = encounters.slice(-50000)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

/**
 * Log one or more word encounters from a reading session.
 */
export function logEncounters(
  words: string[],
  source: string,
  sourceType: WordEncounter['sourceType'],
  contextMap?: Record<string, string>,
): void {
  const existing = loadEncounters()
  const timestamp = new Date().toISOString()
  const newEncounters: WordEncounter[] = words.map(word => ({
    word: word.toLowerCase().trim(),
    timestamp,
    source,
    sourceType,
    contextSnippet: contextMap?.[word],
  }))
  saveEncounters([...existing, ...newEncounters])
}

/**
 * Log a single word encounter.
 */
export function logSingleEncounter(
  word: string,
  source: string,
  sourceType: WordEncounter['sourceType'],
  context?: string,
): void {
  logEncounters([word], source, sourceType, context ? { [word]: context } : undefined)
}

/**
 * Get encounter summary for a specific word.
 */
export function getWordEncounters(word: string): WordEncounterSummary | null {
  const all = loadEncounters()
  const matches = all.filter(e => e.word === word.toLowerCase().trim())
  if (matches.length === 0) return null

  const sources = [...new Set(matches.map(e => e.source))]
  const first = matches[0].timestamp
  const last = matches[matches.length - 1].timestamp
  const spanMs = new Date(last).getTime() - new Date(first).getTime()

  return {
    word: word.toLowerCase(),
    totalEncounters: matches.length,
    firstSeen: first,
    lastSeen: last,
    sources,
    encounters: matches,
    timeSpanDays: Math.max(1, Math.floor(spanMs / 86400000)),
  }
}

/**
 * Get encounter summaries for all tracked words.
 */
export function getAllEncounterSummaries(): WordEncounterSummary[] {
  const all = loadEncounters()
  const grouped = new Map<string, WordEncounter[]>()

  all.forEach(e => {
    const existing = grouped.get(e.word) ?? []
    existing.push(e)
    grouped.set(e.word, existing)
  })

  const summaries: WordEncounterSummary[] = []
  grouped.forEach((encounters, word) => {
    const sources = [...new Set(encounters.map(e => e.source))]
    const first = encounters[0].timestamp
    const last = encounters[encounters.length - 1].timestamp
    const spanMs = new Date(last).getTime() - new Date(first).getTime()
    summaries.push({
      word,
      totalEncounters: encounters.length,
      firstSeen: first,
      lastSeen: last,
      sources,
      encounters,
      timeSpanDays: Math.max(1, Math.floor(spanMs / 86400000)),
    })
  })

  return summaries.sort((a, b) => b.totalEncounters - a.totalEncounters)
}

/**
 * Get encounter data grouped by date for a word (for timeline visualization).
 */
export function getWordTimeline(word: string): { date: string; count: number; sources: string[] }[] {
  const summary = getWordEncounters(word)
  if (!summary) return []

  const byDate = new Map<string, { count: number; sources: Set<string> }>()
  summary.encounters.forEach(e => {
    const date = e.timestamp.slice(0, 10)
    const existing = byDate.get(date) ?? { count: 0, sources: new Set() }
    existing.count++
    existing.sources.add(e.source)
    byDate.set(date, existing)
  })

  return Array.from(byDate.entries())
    .map(([date, data]) => ({ date, count: data.count, sources: [...data.sources] }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Get total encounter stats.
 */
export function getEncounterStats(): {
  totalEncounters: number
  uniqueWords: number
  totalSources: number
  averageEncountersPerWord: number
} {
  const all = loadEncounters()
  const words = new Set(all.map(e => e.word))
  const sources = new Set(all.map(e => e.source))
  return {
    totalEncounters: all.length,
    uniqueWords: words.size,
    totalSources: sources.size,
    averageEncountersPerWord: words.size > 0 ? Math.round(all.length / words.size * 10) / 10 : 0,
  }
}

/**
 * Clear all encounter data.
 */
export function clearEncounters(): void {
  localStorage.removeItem(STORAGE_KEY)
}
