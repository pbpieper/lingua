/**
 * Media Library localStorage service.
 * All media items persisted under a single key.
 */
import type { MediaItem, MediaChunk, MediaLine, MediaType } from '@/types/media'

const STORAGE_KEY = 'lingua-media-library'

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function getMediaItems(): MediaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MediaItem[]
  } catch {
    return []
  }
}

export function getMediaItem(id: string): MediaItem | undefined {
  return getMediaItems().find(m => m.id === id)
}

export function saveMediaItem(item: MediaItem): void {
  const items = getMediaItems()
  const idx = items.findIndex(m => m.id === item.id)
  if (idx >= 0) items[idx] = item
  else items.push(item)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function updateMediaItem(id: string, updates: Partial<MediaItem>): MediaItem | undefined {
  const items = getMediaItems()
  const idx = items.findIndex(m => m.id === id)
  if (idx < 0) return undefined
  items[idx] = { ...items[idx], ...updates }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  return items[idx]
}

export function deleteMediaItem(id: string): void {
  const items = getMediaItems().filter(m => m.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

// ---------------------------------------------------------------------------
// Parser — converts raw text into MediaChunks
// ---------------------------------------------------------------------------

const SPEAKER_PATTERN = /^([A-Z][A-Z0-9 _]+):\s*/

/** Label presets per media type */
const LABEL_MAP: Record<MediaType, (i: number) => string> = {
  poem: i => `Stanza ${i}`,
  song: i => `Verse ${i}`,
  skit: i => `Scene ${i}`,
  article: i => `Paragraph ${i}`,
  dialogue: i => `Exchange ${i}`,
  custom: i => `Part ${i}`,
}

export function parseMediaContent(
  raw: string,
  type: MediaType,
  rawTranslation?: string,
): MediaChunk[] {
  const paragraphs = raw.split(/\n\s*\n/).filter(p => p.trim())
  const transParagraphs = rawTranslation
    ? rawTranslation.split(/\n\s*\n/).filter(p => p.trim())
    : []

  const labelFn = LABEL_MAP[type]
  const chunks: MediaChunk[] = []

  for (let i = 0; i < paragraphs.length; i++) {
    const rawLines = paragraphs[i].split('\n').map(l => l.trim()).filter(Boolean)
    const transLines = transParagraphs[i]
      ? transParagraphs[i].split('\n').map(l => l.trim()).filter(Boolean)
      : []

    const lines: MediaLine[] = rawLines.map((line, li) => {
      const match = line.match(SPEAKER_PATTERN)
      const ml: MediaLine = {
        text: match ? line.slice(match[0].length).trim() : line,
        translation: transLines[li] || undefined,
      }
      if (match) ml.speaker = match[1]
      return ml
    })

    chunks.push({ id: i + 1, label: labelFn(i + 1), lines })
  }

  // If no paragraph breaks, put everything in one chunk
  if (chunks.length === 0 && raw.trim()) {
    const rawLines = raw.split('\n').map(l => l.trim()).filter(Boolean)
    const transLines = rawTranslation
      ? rawTranslation.split('\n').map(l => l.trim()).filter(Boolean)
      : []
    chunks.push({
      id: 1,
      label: labelFn(1),
      lines: rawLines.map((line, li) => {
        const match = line.match(SPEAKER_PATTERN)
        return {
          text: match ? line.slice(match[0].length).trim() : line,
          translation: transLines[li] || undefined,
          speaker: match ? match[1] : undefined,
        }
      }),
    })
  }

  return chunks
}

/** Returns true if the raw text has SPEAKER: patterns, hinting at dialogue/skit. */
export function detectDialoguePattern(raw: string): boolean {
  const lines = raw.split('\n').filter(l => l.trim())
  const matches = lines.filter(l => SPEAKER_PATTERN.test(l.trim()))
  return matches.length >= 2 && matches.length / lines.length > 0.3
}
