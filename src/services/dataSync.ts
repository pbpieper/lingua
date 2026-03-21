/**
 * Data synchronisation service — syncs localStorage data to/from Supabase.
 *
 * When Supabase is not configured the functions are no-ops that resolve
 * immediately, so the rest of the app never needs to guard against it.
 */

import { supabase, isSupabaseConfigured } from './supabase'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SyncStatus {
  lastSyncedAt: string | null
  pendingChanges: number
  inProgress: boolean
  error: string | null
}

/* ------------------------------------------------------------------ */
/*  localStorage keys we sync                                          */
/* ------------------------------------------------------------------ */

const LS_KEYS = {
  words: 'lingua-local-words',
  lists: 'lingua-local-lists',
  preferences: 'lingua-preferences',
  xp: 'lingua-xp',
  feedback: 'lingua-feedback',
  media: 'lingua-media',
  sessions: 'lingua-sessions',
  onboarding: 'lingua-onboarding',
} as const

const SYNC_META_KEY = 'lingua-sync-meta'

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function readLS(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeLS(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function getSyncMeta(): { lastSyncedAt: string | null } {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY)
    return raw ? JSON.parse(raw) : { lastSyncedAt: null }
  } catch {
    return { lastSyncedAt: null }
  }
}

function saveSyncMeta(meta: { lastSyncedAt: string | null }): void {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta))
}

/** Safe upsert — silently ignores if table doesn't exist */
async function safeUpsert(table: string, data: unknown, opts?: { onConflict?: string }) {
  if (!supabase) return
  try {
    await supabase.from(table).upsert(data as Record<string, unknown>, opts as { onConflict: string })
  } catch { /* table may not exist yet */ }
}

/** Safe select — returns null if table doesn't exist */
async function safeSelect<T>(
  table: string,
  column: string,
  value: string,
  selectCols = '*',
  single = false,
): Promise<T | null> {
  if (!supabase) return null
  try {
    const q = supabase.from(table).select(selectCols).eq(column, value)
    const { data } = single ? await q.maybeSingle() : await q
    return data as T | null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Sync to cloud                                                      */
/* ------------------------------------------------------------------ */

export async function syncToCloud(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return

  const now = new Date().toISOString()

  // 1. Upsert profile
  const onboarding = readLS(LS_KEYS.onboarding) as Record<string, unknown> | null
  const prefs = readLS(LS_KEYS.preferences) as Record<string, unknown> | null

  await safeUpsert('user_profiles', {
    id: userId,
    display_name: (prefs?.userName as string) || '',
    native_language: (onboarding?.nativeLanguage as string) || '',
    learning_languages: onboarding?.targetLanguage ? [onboarding.targetLanguage as string] : [],
    onboarding_data: onboarding,
    updated_at: now,
  }, { onConflict: 'id' })

  // 2. Words
  const localWords = readLS(LS_KEYS.words) as Array<Record<string, unknown>> | null
  if (localWords && localWords.length > 0) {
    const rows = localWords.map(w => ({
      user_id: userId,
      list_id: w.list_id ?? null,
      lemma: w.lemma,
      translation: w.translation,
      language_from: w.language_from ?? '',
      language_to: w.language_to ?? '',
      pos: w.part_of_speech ?? null,
      gender: w.gender ?? null,
      pronunciation: w.pronunciation ?? null,
      example_sentence: w.example_sentence ?? null,
      tags: w.tags ?? [],
      cefr_level: w.cefr_level ?? null,
      stability: w.stability ?? 0,
      difficulty: w.difficulty ?? 0,
      reps: w.reps ?? 0,
      interval_days: w.interval_days ?? 0,
      ease_factor: w.ease_factor ?? 2.5,
      next_review: w.next_review ?? null,
      exposure_count: w.exposure_count ?? 0,
      created_at: w.created_at ?? now,
      updated_at: now,
    }))
    await safeUpsert('user_words', rows)
  }

  // 3. Lists
  const localLists = readLS(LS_KEYS.lists) as Array<Record<string, unknown>> | null
  if (localLists && localLists.length > 0) {
    const rows = localLists.map(l => ({
      user_id: userId,
      name: l.name,
      language_from: l.language_from ?? '',
      language_to: l.language_to ?? '',
      created_at: l.created_at ?? now,
    }))
    await safeUpsert('user_lists', rows)
  }

  // 4. Preferences
  if (prefs) {
    await safeUpsert('user_preferences', {
      user_id: userId,
      prefs_json: prefs,
      updated_at: now,
    }, { onConflict: 'user_id' })
  }

  // 5. XP
  const xp = readLS(LS_KEYS.xp) as Record<string, unknown> | null
  if (xp) {
    await safeUpsert('user_xp', {
      user_id: userId,
      total_xp: xp.totalXp ?? 0,
      xp_history_json: xp,
      updated_at: now,
    }, { onConflict: 'user_id' })
  }

  // 6. Feedback
  const feedback = readLS(LS_KEYS.feedback) as unknown
  if (feedback) {
    await safeUpsert('user_feedback', {
      user_id: userId,
      feedback_json: feedback,
      created_at: now,
    }, { onConflict: 'user_id' })
  }

  // 7. Media
  const media = readLS(LS_KEYS.media) as unknown
  if (media) {
    await safeUpsert('user_media', {
      user_id: userId,
      media_json: media,
      created_at: now,
      updated_at: now,
    }, { onConflict: 'user_id' })
  }

  // 8. Sessions
  const sessions = readLS(LS_KEYS.sessions) as unknown
  if (sessions) {
    await safeUpsert('user_sessions', {
      user_id: userId,
      session_json: sessions,
      created_at: now,
    }, { onConflict: 'user_id' })
  }

  saveSyncMeta({ lastSyncedAt: now })
}

/* ------------------------------------------------------------------ */
/*  Sync from cloud                                                    */
/* ------------------------------------------------------------------ */

export async function syncFromCloud(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return

  const now = new Date().toISOString()

  // 1. Profile
  const profile = await safeSelect<Record<string, unknown>>('user_profiles', 'id', userId, '*', true)
  if (profile?.onboarding_data) {
    writeLS(LS_KEYS.onboarding, { ...(profile.onboarding_data as Record<string, unknown>), completed: true })
  }

  // 2. Words — cloud wins
  const cloudWords = await safeSelect<Array<Record<string, unknown>>>('user_words', 'user_id', userId)
  if (cloudWords && cloudWords.length > 0) {
    const localWords = (readLS(LS_KEYS.words) as Array<Record<string, unknown>> | null) ?? []
    const merged = mergeByTimestamp(localWords, cloudWords, 'lemma')
    writeLS(LS_KEYS.words, merged)
  }

  // 3. Lists
  const cloudLists = await safeSelect<Array<Record<string, unknown>>>('user_lists', 'user_id', userId)
  if (cloudLists && cloudLists.length > 0) {
    const localLists = (readLS(LS_KEYS.lists) as Array<Record<string, unknown>> | null) ?? []
    const merged = mergeByTimestamp(localLists, cloudLists, 'name')
    writeLS(LS_KEYS.lists, merged)
  }

  // 4. Preferences — cloud wins
  const cloudPrefs = await safeSelect<{ prefs_json: Record<string, unknown> }>('user_preferences', 'user_id', userId, 'prefs_json', true)
  if (cloudPrefs?.prefs_json) {
    const local = (readLS(LS_KEYS.preferences) as Record<string, unknown>) ?? {}
    writeLS(LS_KEYS.preferences, { ...local, ...cloudPrefs.prefs_json })
  }

  // 5. XP — cloud wins
  const cloudXp = await safeSelect<{ xp_history_json: Record<string, unknown> }>('user_xp', 'user_id', userId, 'xp_history_json', true)
  if (cloudXp?.xp_history_json) {
    writeLS(LS_KEYS.xp, cloudXp.xp_history_json)
  }

  // 6. Media
  const cloudMedia = await safeSelect<{ media_json: unknown }>('user_media', 'user_id', userId, 'media_json', true)
  if (cloudMedia?.media_json) {
    writeLS(LS_KEYS.media, cloudMedia.media_json)
  }

  saveSyncMeta({ lastSyncedAt: now })
  void now // suppress unused warning
}

/* ------------------------------------------------------------------ */
/*  Merge helper — newest timestamp wins, dedup by key                 */
/* ------------------------------------------------------------------ */

function mergeByTimestamp(
  local: Array<Record<string, unknown>>,
  cloud: Array<Record<string, unknown>>,
  dedupeKey: string,
): Array<Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()

  for (const item of local) {
    const key = String(item[dedupeKey] ?? '')
    map.set(key, item)
  }

  for (const item of cloud) {
    const key = String(item[dedupeKey] ?? '')
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
    } else {
      const cloudTime = new Date(item.updated_at as string || item.created_at as string || 0).getTime()
      const localTime = new Date(existing.updated_at as string || existing.created_at as string || 0).getTime()
      if (cloudTime >= localTime) {
        map.set(key, item)
      }
    }
  }

  return Array.from(map.values())
}

/* ------------------------------------------------------------------ */
/*  Export user data (GDPR / data portability)                         */
/* ------------------------------------------------------------------ */

export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const localData: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    userId,
  }

  for (const [key, lsKey] of Object.entries(LS_KEYS)) {
    localData[key] = readLS(lsKey)
  }

  if (isSupabaseConfigured() && supabase) {
    try {
      const tables = [
        'user_profiles',
        'user_words',
        'user_lists',
        'user_preferences',
        'user_xp',
        'user_feedback',
        'user_media',
        'user_sessions',
      ]

      const cloudData: Record<string, unknown> = {}
      for (const table of tables) {
        const col = table === 'user_profiles' ? 'id' : 'user_id'
        cloudData[table] = await safeSelect(table, col, userId)
      }
      localData.cloud = cloudData
    } catch {
      // If cloud fetch fails, we still have local data
    }
  }

  return localData
}

/* ------------------------------------------------------------------ */
/*  Sync status helpers                                                */
/* ------------------------------------------------------------------ */

export function getSyncStatus(): SyncStatus {
  const meta = getSyncMeta()
  let pendingChanges = 0
  for (const lsKey of Object.values(LS_KEYS)) {
    if (localStorage.getItem(lsKey)) pendingChanges++
  }
  return {
    lastSyncedAt: meta.lastSyncedAt,
    pendingChanges,
    inProgress: false,
    error: null,
  }
}
