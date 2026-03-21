import type { WordInput } from '@/types/word'

/** Arabic POS markers → English POS names */
const ARABIC_POS_MAP: Record<string, string> = {
  'اسم': 'noun',
  'فعل': 'verb',
  'صفة': 'adjective',
  'تعبير': 'expression',
  'ظرف': 'adverb',
}

const ARABIC_POS_REGEX = /(اسم|فعل|صفة|تعبير|ظرف)/

function isArabicChar(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return (code >= 0x0600 && code <= 0x06FF) ||
         (code >= 0x0750 && code <= 0x077F) ||
         (code >= 0x08A0 && code <= 0x08FF) ||
         (code >= 0xFB50 && code <= 0xFDFF) ||
         (code >= 0xFE70 && code <= 0xFEFF)
}

/** Check if raw text looks like Arabic vocab format (contains Arabic POS markers) */
function isArabicVocabFormat(text: string): boolean {
  return ARABIC_POS_REGEX.test(text)
}

/**
 * Parse Arabic vocabulary in the format:
 *   English translationPOS_ARABICArabic_lemma
 * where entries are concatenated and POS markers (اسم/فعل/صفة/تعبير/ظرف) act as delimiters.
 */
function parseArabicVocab(raw: string, defaults?: { language_from?: string; language_to?: string }): WordInput[] {
  // Join lines, normalize whitespace
  const text = raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

  // Split on Arabic POS markers, keeping them as captured groups
  // Result alternates: [before, POS, after, POS, after, ...]
  const parts = text.split(ARABIC_POS_REGEX)
  const results: WordInput[] = []

  for (let i = 1; i < parts.length; i += 2) {
    const pos = parts[i]
    const posEnglish = ARABIC_POS_MAP[pos] || pos

    // English translation = trailing non-Arabic text from the segment before this POS
    const before = parts[i - 1] || ''
    const translation = extractTrailingLatin(before)

    // Arabic lemma = leading non-Latin text from the segment after this POS
    const after = parts[i + 1] || ''
    const lemma = extractLeadingArabic(after)

    if (translation && lemma) {
      const entry: WordInput = {
        lemma,
        translation,
        part_of_speech: posEnglish,
      }
      if (defaults?.language_from) entry.language_from = defaults.language_from
      if (defaults?.language_to) entry.language_to = defaults.language_to
      results.push(entry)
    }
  }

  return results
}

/** Extract trailing non-Arabic text (English translation) from a mixed segment */
function extractTrailingLatin(text: string): string {
  let lastArabic = -1
  for (let i = text.length - 1; i >= 0; i--) {
    if (isArabicChar(text[i])) {
      lastArabic = i
      break
    }
  }
  return text.slice(lastArabic + 1).trim()
}

/** Extract leading non-Latin text (Arabic lemma) from a mixed segment */
function extractLeadingArabic(text: string): string {
  let firstLatin = text.length
  for (let i = 0; i < text.length; i++) {
    if (/[a-zA-Z]/.test(text[i])) {
      firstLatin = i
      break
    }
  }
  return text.slice(0, firstLatin).trim()
}

/** Languages that use right-to-left script */
export const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur'])

/** Check if a language code is RTL */
export function isRTL(langCode: string): boolean {
  return RTL_LANGS.has(langCode)
}

/**
 * Parse CSV, TSV, freeform text, or Arabic vocabulary into WordInput[].
 *
 * Supported formats:
 * - CSV/TSV with headers: lemma/word/term, translation/meaning/definition, pos, gender, tags
 * - Two-column CSV/TSV: word,translation or word\ttranslation
 * - Freeform: word - translation, word = translation, word : translation (one per line)
 * - Arabic: English_translationPOS_ARABICArabic_lemma (concatenated entries with اسم/فعل/صفة/تعبير/ظرف markers)
 */
export function parseVocabText(raw: string, defaults?: { language_from?: string; language_to?: string }): WordInput[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  // Check for Arabic vocab format first
  if (isArabicVocabFormat(trimmed)) {
    return parseArabicVocab(trimmed, defaults)
  }

  const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return []

  // Detect format
  const firstLine = lines[0]
  const isCSV = firstLine.includes(',') && !firstLine.includes(' - ') && !firstLine.includes(' = ')
  const isTSV = firstLine.includes('\t')

  if (isTSV || isCSV) {
    return parseDelimited(lines, isTSV ? '\t' : ',', defaults)
  }

  return parseFreeform(lines, defaults)
}

function parseDelimited(lines: string[], delimiter: string, defaults?: { language_from?: string; language_to?: string }): WordInput[] {
  const splitLine = (line: string) => {
    const parts: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === delimiter && !inQuotes) { parts.push(current.trim()); current = ''; continue }
      current += ch
    }
    parts.push(current.trim())
    return parts
  }

  const headerRow = splitLine(lines[0]).map(h => h.toLowerCase())
  const hasHeaders = headerRow.some(h =>
    ['lemma', 'word', 'term', 'vocab', 'translation', 'meaning', 'definition'].includes(h)
  )

  if (hasHeaders) {
    const colMap: Record<string, number> = {}
    headerRow.forEach((h, i) => {
      if (['lemma', 'word', 'term', 'vocab'].includes(h)) colMap.lemma = i
      if (['translation', 'meaning', 'definition', 'answer'].includes(h)) colMap.translation = i
      if (['pos', 'part_of_speech', 'type'].includes(h)) colMap.pos = i
      if (['gender', 'genus'].includes(h)) colMap.gender = i
      if (['tags', 'topic', 'category'].includes(h)) colMap.tags = i
      if (['example', 'sentence', 'example_sentence'].includes(h)) colMap.example = i
      if (['pronunciation', 'ipa'].includes(h)) colMap.pronunciation = i
    })

    return lines.slice(1).map(line => {
      const cols = splitLine(line)
      return {
        lemma: cols[colMap.lemma ?? 0] || '',
        translation: cols[colMap.translation ?? 1] || '',
        part_of_speech: colMap.pos !== undefined ? cols[colMap.pos] : undefined,
        gender: colMap.gender !== undefined ? cols[colMap.gender] : undefined,
        tags: colMap.tags !== undefined ? cols[colMap.tags]?.split(/[;|]/).map(t => t.trim()).filter(Boolean) : undefined,
        example_sentence: colMap.example !== undefined ? cols[colMap.example] : undefined,
        pronunciation: colMap.pronunciation !== undefined ? cols[colMap.pronunciation] : undefined,
        language_from: defaults?.language_from,
        language_to: defaults?.language_to,
      }
    }).filter(w => w.lemma && w.translation)
  }

  // No headers — assume col 0 = lemma, col 1 = translation
  return lines.map(line => {
    const cols = splitLine(line)
    return {
      lemma: cols[0] || '',
      translation: cols[1] || '',
      language_from: defaults?.language_from,
      language_to: defaults?.language_to,
    }
  }).filter(w => w.lemma && w.translation)
}

function parseFreeform(lines: string[], defaults?: { language_from?: string; language_to?: string }): WordInput[] {
  const separators = [' - ', ' = ', ' : ', ' – ', ' — ']

  const results: WordInput[] = []
  for (const line of lines) {
    for (const sep of separators) {
      const idx = line.indexOf(sep)
      if (idx > 0) {
        const entry: WordInput = {
          lemma: line.slice(0, idx).trim(),
          translation: line.slice(idx + sep.length).trim(),
        }
        if (defaults?.language_from) entry.language_from = defaults.language_from
        if (defaults?.language_to) entry.language_to = defaults.language_to
        if (entry.lemma && entry.translation) results.push(entry)
        break
      }
    }
  }
  return results
}
