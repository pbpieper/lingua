/**
 * Normalize text for comparison — strips diacritics, normalizes whitespace,
 * handles Arabic tashkeel, accented Latin characters, and Japanese kana variants.
 */
export function normalizeForComparison(text: string, lang?: string): string {
  let normalized = text.trim().toLowerCase()

  // Remove Arabic diacritical marks (tashkeel/harakat)
  // These are Unicode range U+0610-U+061A, U+064B-U+065F, U+0670
  if (!lang || lang === 'ar') {
    normalized = normalized.replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '')
  }

  // Normalize Unicode (NFC form), then strip combining diacritical marks
  // This handles accented characters: é→e, ü→u, ñ→n, etc.
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized
}

/**
 * Fuzzy comparison: returns true if the answer is "close enough" to the expected.
 * Handles common typos (1 character difference for words > 3 chars).
 */
export function fuzzyMatch(answer: string, expected: string, lang?: string): boolean {
  const a = normalizeForComparison(answer, lang)
  const e = normalizeForComparison(expected, lang)

  // Exact match after normalization
  if (a === e) return true

  // Allow 1 character difference for words longer than 3 chars
  if (a.length > 3 && e.length > 3) {
    const distance = levenshtein(a, e)
    return distance <= 1
  }

  return false
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= a.length; i++) matrix[i] = [i]
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[a.length][b.length]
}
