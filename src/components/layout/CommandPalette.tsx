import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TOOLS } from '@/types/tools'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface SearchResult {
  type: 'tool' | 'word'
  id: string
  label: string
  sublabel?: string
  icon: string
  action: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const app = useApp()
  const [query, setQuery] = useState('')
  const [wordResults, setWordResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setWordResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Tool results (always instant)
  const toolResults = useMemo<SearchResult[]>(() => {
    if (!query.trim()) {
      return TOOLS.filter(t => t.id !== 'home').map(t => ({
        type: 'tool' as const,
        id: t.id,
        label: t.label,
        sublabel: t.description,
        icon: t.icon,
        action: () => { app.setActiveTool(t.id); onClose() },
      }))
    }
    const q = query.toLowerCase()
    return TOOLS
      .filter(t => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
      .map(t => ({
        type: 'tool' as const,
        id: t.id,
        label: t.label,
        sublabel: t.description,
        icon: t.icon,
        action: () => { app.setActiveTool(t.id); onClose() },
      }))
  }, [query, app, onClose])

  // Debounced word search
  useEffect(() => {
    if (!query.trim() || query.length < 2 || !app.hubAvailable) {
      setWordResults([])
      return
    }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      try {
        const words = await api.getWords(app.userId, { search: query, limit: 5 })
        setWordResults(words.map(w => ({
          type: 'word' as const,
          id: String(w.id),
          label: w.lemma,
          sublabel: w.translation,
          icon: '📖',
          action: () => { app.setActiveTool('wordbank'); onClose() },
        })))
      } catch {
        setWordResults([])
      }
    }, 300)
    return () => clearTimeout(searchTimeout.current)
  }, [query, app, onClose])

  const allResults = [...toolResults, ...wordResults]

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, allResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && allResults[selectedIndex]) {
        e.preventDefault()
        allResults[selectedIndex].action()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, allResults, selectedIndex, onClose])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Palette */}
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
            <span className="text-[var(--color-text-muted)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search tools or vocabulary..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            />
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {toolResults.length > 0 && (
              <div className="px-3 py-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">Tools</p>
              </div>
            )}
            {toolResults.map((result, i) => (
              <button
                key={`tool-${result.id}`}
                onClick={result.action}
                className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm cursor-pointer border-none transition-colors"
                style={{
                  background: selectedIndex === i ? 'var(--color-primary-faded)' : 'transparent',
                  color: 'var(--color-text-primary)',
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span>{result.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{result.label}</span>
                  {result.sublabel && (
                    <span className="ml-2 text-xs text-[var(--color-text-muted)] truncate">{result.sublabel}</span>
                  )}
                </div>
              </button>
            ))}

            {wordResults.length > 0 && (
              <>
                <div className="px-3 py-1 mt-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">Vocabulary</p>
                </div>
                {wordResults.map((result, i) => {
                  const idx = toolResults.length + i
                  return (
                    <button
                      key={`word-${result.id}`}
                      onClick={result.action}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm cursor-pointer border-none transition-colors"
                      style={{
                        background: selectedIndex === idx ? 'var(--color-primary-faded)' : 'transparent',
                        color: 'var(--color-text-primary)',
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span>{result.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{result.label}</span>
                        <span className="ml-2 text-xs text-[var(--color-text-muted)]">{result.sublabel}</span>
                      </div>
                    </button>
                  )
                })}
              </>
            )}

            {query.trim() && allResults.length === 0 && (
              <p className="text-center text-sm text-[var(--color-text-muted)] py-6">No results found</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
            <span><kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-alt)] border border-[var(--color-border)] font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-alt)] border border-[var(--color-border)] font-mono">↵</kbd> select</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
