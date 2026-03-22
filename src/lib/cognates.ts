/**
 * Cross-language cognate detection.
 *
 * Detects similar words between language pairs using:
 * 1. Levenshtein distance (normalized)
 * 2. Common suffix/prefix patterns (e.g., -tion = -cion = -zione)
 * 3. Common cognate root patterns
 */

// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
    }
  }
  return dp[m][n]
}

/** Normalized similarity: 0 (completely different) to 1 (identical) */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

// ---------------------------------------------------------------------------
// Suffix patterns — common cognate endings across languages
// ---------------------------------------------------------------------------

interface SuffixGroup {
  /** Canonical name for this pattern */
  pattern: string
  /** Map of language code -> suffix (lowercase) */
  suffixes: Record<string, string[]>
}

const SUFFIX_GROUPS: SuffixGroup[] = [
  {
    pattern: '-tion/-cion/-zione',
    suffixes: {
      en: ['tion', 'sion'],
      es: ['cion', 'sion'],
      fr: ['tion', 'sion'],
      it: ['zione', 'sione'],
      pt: ['cao', 'sao'],
      de: ['tion', 'sion'],
    },
  },
  {
    pattern: '-ment/-mento',
    suffixes: {
      en: ['ment'],
      es: ['mento', 'miento'],
      fr: ['ment'],
      it: ['mento'],
      pt: ['mento'],
      de: ['ment'],
    },
  },
  {
    pattern: '-ty/-tad/-te',
    suffixes: {
      en: ['ty', 'ity'],
      es: ['tad', 'dad', 'idad'],
      fr: ['te', 'ite'],
      it: ['ta', 'ita'],
      pt: ['tade', 'dade'],
    },
  },
  {
    pattern: '-ous/-oso/-eux',
    suffixes: {
      en: ['ous', 'ious'],
      es: ['oso', 'osa'],
      fr: ['eux', 'euse'],
      it: ['oso', 'osa'],
      pt: ['oso', 'osa'],
    },
  },
  {
    pattern: '-al/-el',
    suffixes: {
      en: ['al', 'ial'],
      es: ['al', 'ial'],
      fr: ['al', 'el', 'iel'],
      it: ['ale', 'iale'],
      pt: ['al', 'ial'],
      de: ['al', 'ell'],
    },
  },
  {
    pattern: '-able/-ible',
    suffixes: {
      en: ['able', 'ible'],
      es: ['able', 'ible'],
      fr: ['able', 'ible'],
      it: ['abile', 'ibile'],
      pt: ['avel', 'ivel'],
    },
  },
  {
    pattern: '-ism/-ismo',
    suffixes: {
      en: ['ism'],
      es: ['ismo'],
      fr: ['isme'],
      it: ['ismo'],
      pt: ['ismo'],
      de: ['ismus'],
    },
  },
  {
    pattern: '-ist/-ista',
    suffixes: {
      en: ['ist'],
      es: ['ista'],
      fr: ['iste'],
      it: ['ista'],
      pt: ['ista'],
      de: ['ist'],
    },
  },
  {
    pattern: '-ology/-ologia',
    suffixes: {
      en: ['ology', 'logy'],
      es: ['ologia', 'logia'],
      fr: ['ologie', 'logie'],
      it: ['ologia', 'logia'],
      pt: ['ologia', 'logia'],
      de: ['ologie', 'logie'],
    },
  },
  {
    pattern: '-ance/-ancia',
    suffixes: {
      en: ['ance', 'ence'],
      es: ['ancia', 'encia'],
      fr: ['ance', 'ence'],
      it: ['anza', 'enza'],
      pt: ['ancia', 'encia'],
    },
  },
]

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

export interface CognateMatch {
  word: string
  language: string
  similarity: number
  pattern?: string
}

/**
 * Check if two words share a cognate suffix pattern.
 */
function shareSuffixPattern(wordA: string, langA: string, wordB: string, langB: string): string | null {
  const a = wordA.toLowerCase()
  const b = wordB.toLowerCase()

  for (const group of SUFFIX_GROUPS) {
    const suffixesA = group.suffixes[langA]
    const suffixesB = group.suffixes[langB]
    if (!suffixesA || !suffixesB) continue

    const hasSuffixA = suffixesA.some(s => a.endsWith(s))
    const hasSuffixB = suffixesB.some(s => b.endsWith(s))

    if (hasSuffixA && hasSuffixB) {
      // Also check that the stems are similar
      const stemA = suffixesA.reduce((w, s) => w.endsWith(s) ? w.slice(0, -s.length) : w, a)
      const stemB = suffixesB.reduce((w, s) => w.endsWith(s) ? w.slice(0, -s.length) : w, b)

      if (stemA.length >= 3 && stemB.length >= 3 && similarity(stemA, stemB) >= 0.6) {
        return group.pattern
      }
    }
  }
  return null
}

/**
 * Detect if targetWord in targetLang is a cognate of any word in the knownWords set.
 *
 * @param targetWord The word being studied
 * @param targetLang Language code of the target word (e.g., 'fr')
 * @param knownWords Array of { word, language } from the user's existing vocabulary
 * @param threshold Minimum similarity score (0-1) to consider a match. Default 0.65.
 * @returns Best cognate match, or null
 */
export function detectCognate(
  targetWord: string,
  targetLang: string,
  knownWords: Array<{ word: string; language: string }>,
  threshold = 0.65,
): CognateMatch | null {
  if (!targetWord || targetWord.length < 3) return null

  const target = targetWord.toLowerCase()
  let bestMatch: CognateMatch | null = null
  let bestScore = threshold

  for (const { word, language } of knownWords) {
    // Skip same language
    if (language === targetLang) continue
    if (word.length < 3) continue

    const known = word.toLowerCase()

    // Check suffix pattern first (higher confidence)
    const pattern = shareSuffixPattern(target, targetLang, known, language)
    if (pattern) {
      const sim = similarity(target, known)
      if (sim > bestScore - 0.1) { // Lower threshold for pattern matches
        bestMatch = { word, language, similarity: Math.max(sim, 0.7), pattern }
        bestScore = Math.max(sim, 0.7)
      }
      continue
    }

    // Raw Levenshtein similarity
    const sim = similarity(target, known)
    if (sim >= bestScore) {
      bestMatch = { word, language, similarity: sim }
      bestScore = sim
    }
  }

  return bestMatch
}

/**
 * Batch detect cognates across an entire vocabulary.
 * Returns a map from word ID to cognate match.
 */
export function detectCognatesForVocab(
  words: Array<{ id: number; lemma: string; language_from: string }>,
  threshold = 0.65,
): Map<number, CognateMatch> {
  const results = new Map<number, CognateMatch>()

  // Build the known words pool from all words
  const pool = words.map(w => ({ word: w.lemma, language: w.language_from }))

  for (const word of words) {
    // Exclude this word itself from the pool for the check
    const match = detectCognate(word.lemma, word.language_from, pool.filter(p => p.word !== word.lemma), threshold)
    if (match) {
      results.set(word.id, match)
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Language display names
// ---------------------------------------------------------------------------

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic', de: 'German', en: 'English', es: 'Spanish', fr: 'French',
  it: 'Italian', ja: 'Japanese', ko: 'Korean', nl: 'Dutch', pt: 'Portuguese',
  ru: 'Russian', tr: 'Turkish', zh: 'Chinese', sv: 'Swedish', pl: 'Polish',
  da: 'Danish', no: 'Norwegian', fi: 'Finnish', el: 'Greek', cs: 'Czech',
  ro: 'Romanian', hu: 'Hungarian', hi: 'Hindi', th: 'Thai', vi: 'Vietnamese',
}

export function getLanguageName(code: string): string {
  return LANG_NAMES[code] || code.toUpperCase()
}
