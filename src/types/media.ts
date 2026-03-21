export type MediaType = 'poem' | 'song' | 'skit' | 'article' | 'dialogue' | 'custom'

export interface MediaItem {
  id: string
  title: string
  type: MediaType
  content: string
  language: string
  nativeTranslation?: string
  chunks: MediaChunk[]
  wordIds: number[]
  createdAt: string
  lastPracticed?: string
  masteryPercent: number
}

export interface MediaChunk {
  id: number
  label: string
  lines: MediaLine[]
}

export interface MediaLine {
  text: string
  translation?: string
  speaker?: string
  audioUrl?: string
}
