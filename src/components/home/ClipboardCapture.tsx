import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Word } from '@/types/word'

// ─── Text Analysis ────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0)
}

// ─── Component ────────────────────────────────────────────────────

export function ClipboardCapture() {
  const { userId, setActiveTool } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [userWords, setUserWords] = useState<Word[]>([])
  const [showResults, setShowResults] = useState(false)

  // Load user word bank for comparison
  useEffect(() => {
    if (!isOpen) return
    api.getWords(userId, { limit: 5000 })
      .then(setUserWords)
      .catch(() => { /* offline mode */ })
  }, [userId, isOpen])

  const knownLemmas = useMemo(() => {
    const set = new Set<string>()
    userWords.forEach(w => set.add(w.lemma.toLowerCase()))
    return set
  }, [userWords])

  const analysis = useMemo(() => {
    if (!pastedText.trim()) return null
    const tokens = tokenize(pastedText)
    const unique = new Set(tokens)
    const known: string[] = []
    const unknown: string[] = []
    unique.forEach(w => {
      if (knownLemmas.has(w)) known.push(w)
      else unknown.push(w)
    })
    return {
      totalWords: tokens.length,
      uniqueWords: unique.size,
      known,
      unknown,
      knownPercent: unique.size > 0 ? Math.round((known.length / unique.size) * 100) : 0,
    }
  }, [pastedText, knownLemmas])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) {
        setPastedText(text.trim())
        setShowResults(true)
      } else {
        toast.error('Clipboard is empty')
      }
    } catch {
      toast.error('Clipboard access denied. Paste text manually instead.')
    }
  }, [])

  const handleTextChange = useCallback((text: string) => {
    setPastedText(text)
    setShowResults(text.trim().length > 0)
  }, [])

  const handleAddUnknown = useCallback(() => {
    if (!analysis || analysis.unknown.length === 0) return
    // Store unknown words in localStorage for the Upload tool to pick up
    const pending = analysis.unknown.map(w => ({ lemma: w, translation: '' }))
    localStorage.setItem('lingua-clipboard-words', JSON.stringify(pending))
    toast.success(`${analysis.unknown.length} words ready. Go to Upload to add them.`)
    setActiveTool('upload')
  }, [analysis, setActiveTool])

  const handleCreateReading = useCallback(() => {
    if (!pastedText.trim()) return
    // Store text for Reading tool to pick up
    localStorage.setItem('lingua-clipboard-reading', pastedText.trim())
    toast.success('Text ready for reading practice!')
    setActiveTool('reading')
  }, [pastedText, setActiveTool])

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-20 w-12 h-12 rounded-full bg-[var(--color-primary-main)] text-white shadow-lg hover:shadow-xl cursor-pointer border-none transition-shadow flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Quick Capture"
      >
        <span className="text-xl">&#128203;</span>
      </motion.button>

      {/* Capture Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl md:rounded-2xl md:bottom-6 md:right-6 md:left-auto md:w-[420px]"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-text-primary)]">Quick Capture</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Paste any text to analyze instantly</p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer border-none transition-colors flex items-center justify-center text-lg"
                  >
                    &times;
                  </button>
                </div>

                {/* Input Area */}
                <div className="space-y-2">
                  <textarea
                    value={pastedText}
                    onChange={e => handleTextChange(e.target.value)}
                    placeholder="Paste or type text here..."
                    rows={4}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-primary-main)] transition-colors"
                  />
                  <button
                    onClick={handlePaste}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[var(--color-surface-alt)] text-[var(--color-primary-main)] border border-[var(--color-primary-light)] hover:bg-[var(--color-primary-pale)] cursor-pointer transition-colors"
                  >
                    &#128203; Paste from Clipboard
                  </button>
                </div>

                {/* Analysis Results */}
                <AnimatePresence>
                  {showResults && analysis && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-[var(--color-surface-alt)] px-3 py-2 text-center">
                          <div className="text-sm font-bold text-[var(--color-text-primary)]">{analysis.totalWords}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">Total Words</div>
                        </div>
                        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2 text-center">
                          <div className="text-sm font-bold text-green-700 dark:text-green-300">{analysis.known.length}</div>
                          <div className="text-[10px] text-green-600">Known</div>
                        </div>
                        <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 px-3 py-2 text-center">
                          <div className="text-sm font-bold text-orange-700 dark:text-orange-300">{analysis.unknown.length}</div>
                          <div className="text-[10px] text-orange-600">New</div>
                        </div>
                      </div>

                      {/* Knowledge Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Comprehension</span>
                          <span className="text-xs font-bold text-[var(--color-text-primary)]">{analysis.knownPercent}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-green-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.knownPercent}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      {/* Unknown words preview */}
                      {analysis.unknown.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1.5">
                            New words ({analysis.unknown.length})
                          </p>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                            {analysis.unknown.slice(0, 20).map(w => (
                              <span key={w} className="px-2 py-0.5 rounded-full text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                                {w}
                              </span>
                            ))}
                            {analysis.unknown.length > 20 && (
                              <span className="px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">+{analysis.unknown.length - 20} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {analysis.unknown.length > 0 && (
                          <button
                            onClick={handleAddUnknown}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 cursor-pointer border-none transition-colors"
                          >
                            + Add {analysis.unknown.length} to Word Bank
                          </button>
                        )}
                        <button
                          onClick={handleCreateReading}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[var(--color-primary-main)] text-white hover:bg-[var(--color-primary-dark)] cursor-pointer border-none transition-colors"
                        >
                          &#128214; Practice Reading
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
