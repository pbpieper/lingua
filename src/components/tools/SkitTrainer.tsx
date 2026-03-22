import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// ── Types ──────────────────────────────────────────────

interface SavedText {
  id: string
  title: string
  lines: string[]
  createdAt: number
  /** Which round the user is on (1-5) */
  currentRound: number
  /** Per-line mastery: 0=unrated, 1=missed, 2=got-it */
  lineMastery: number[]
}

type AppState = 'input' | 'practice' | 'review'

const STORAGE_KEY = 'lingua-skit-trainer'

// ── Helpers ────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadSavedTexts(): SavedText[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveTexts(texts: SavedText[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(texts))
}

function splitLines(raw: string): string[] {
  return raw.split('\n').map(l => l.trim()).filter(Boolean)
}

/** Detect RTL scripts (Arabic, Hebrew) */
function isRTL(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\uFB1D-\uFB4F]/.test(text)
}

function getMastery(lineMastery: number[]): number {
  const rated = lineMastery.filter(m => m > 0)
  if (rated.length === 0) return 0
  const got = rated.filter(m => m === 2).length
  return Math.round((got / lineMastery.length) * 100)
}

/** Blank the last word of a line */
function hideLastWord(line: string): { display: string; hidden: string } {
  const words = line.split(/\s+/)
  if (words.length <= 1) return { display: '___', hidden: line }
  const hidden = words[words.length - 1]
  return { display: words.slice(0, -1).join(' ') + ' ___', hidden }
}

/** Blank ~50% of words (every other) */
function hideHalf(line: string): { parts: { text: string; hidden: boolean }[] } {
  const words = line.split(/\s+/)
  return {
    parts: words.map((w, i) => ({ text: w, hidden: i % 2 === 1 })),
  }
}

/** Show first letter + dots */
function firstLettersOnly(line: string): string {
  return line
    .split(/\s+/)
    .map(w => {
      if (w.length <= 1) return w[0] + '.'
      return w[0] + '.'.repeat(Math.min(w.length - 1, 4))
    })
    .join(' ')
}

// ── Sub-components ─────────────────────────────────────

function RoundIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-4">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full transition-colors"
          style={{
            background: i < current
              ? 'var(--color-primary-main)'
              : i === current
                ? 'var(--color-accent)'
                : 'var(--color-border)',
          }}
        />
      ))}
    </div>
  )
}

function RSVPPlayer({ lines, speed, onClose }: { lines: string[]; speed: number; onClose: () => void }) {
  const [wordIdx, setWordIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [currentSpeed, setCurrentSpeed] = useState(speed)
  const allWords = useMemo(() => lines.flatMap(l => l.split(/\s+/)), [lines])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (paused || wordIdx >= allWords.length) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      setWordIdx(prev => {
        if (prev >= allWords.length - 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return prev
        }
        return prev + 1
      })
    }, currentSpeed)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, currentSpeed, wordIdx, allWords.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setPaused(p => !p) }
      if (e.code === 'ArrowRight') setCurrentSpeed(s => Math.max(50, s - 25))
      if (e.code === 'ArrowLeft') setCurrentSpeed(s => Math.min(600, s + 25))
      if (e.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const progress = allWords.length > 0 ? ((wordIdx + 1) / allWords.length) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="text-center max-w-lg px-8">
        <p className="text-4xl font-bold mb-8" style={{ color: 'var(--color-text-primary)', minHeight: '3rem' }}>
          {allWords[wordIdx] || ''}
        </p>
        <div className="w-full h-1 rounded-full mb-4" style={{ background: 'var(--color-border)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--color-primary-main)' }} />
        </div>
        <div className="flex items-center justify-center gap-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <span>{paused ? 'Paused' : 'Playing'}</span>
          <span>{currentSpeed}ms/word</span>
          <span>{wordIdx + 1}/{allWords.length}</span>
        </div>
        <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Space: pause/resume | Arrows: speed | Esc: close
        </p>
      </div>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 px-3 py-1.5 rounded-lg text-sm cursor-pointer border"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}
      >
        Close
      </button>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────

export function SkitTrainer() {
  const [state, setState] = useState<AppState>('input')
  const [savedTexts, setSavedTexts] = useState<SavedText[]>(loadSavedTexts)
  const [activeText, setActiveText] = useState<SavedText | null>(null)
  const [round, setRound] = useState(1)
  const [revealedLines, setRevealedLines] = useState<Set<number>>(new Set())
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set())
  const [titleInput, setTitleInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [showRSVP, setShowRSVP] = useState(false)
  const [rsvpSpeed, setRsvpSpeed] = useState(250)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const rtl = activeText ? isRTL(activeText.lines.join(' ')) : false

  // Persist changes
  const persistText = useCallback((updated: SavedText) => {
    setSavedTexts(prev => {
      const next = prev.map(t => (t.id === updated.id ? updated : t))
      saveTexts(next)
      return next
    })
  }, [])

  // Start memorizing a new text
  const handleStart = useCallback(() => {
    const lines = splitLines(textInput)
    if (lines.length === 0) return
    const newText: SavedText = {
      id: generateId(),
      title: titleInput.trim() || `Text ${savedTexts.length + 1}`,
      lines,
      createdAt: Date.now(),
      currentRound: 1,
      lineMastery: new Array(lines.length).fill(0),
    }
    const next = [newText, ...savedTexts]
    saveTexts(next)
    setSavedTexts(next)
    setActiveText(newText)
    setRound(1)
    setRevealedLines(new Set())
    setRevealedWords(new Set())
    setState('practice')
    setTitleInput('')
    setTextInput('')
  }, [textInput, titleInput, savedTexts])

  // Resume a saved text
  const handleResume = useCallback((text: SavedText) => {
    setActiveText(text)
    setRound(text.currentRound)
    setRevealedLines(new Set())
    setRevealedWords(new Set())
    setState('practice')
  }, [])

  // Delete a saved text
  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = savedTexts.filter(t => t.id !== id)
    saveTexts(next)
    setSavedTexts(next)
  }, [savedTexts])

  // Advance to next round
  const handleNextRound = useCallback(() => {
    if (!activeText) return
    const nextRound = Math.min(round + 1, 5)
    setRound(nextRound)
    setRevealedLines(new Set())
    setRevealedWords(new Set())
    const updated = { ...activeText, currentRound: nextRound }
    setActiveText(updated)
    persistText(updated)
  }, [round, activeText, persistText])

  // Rate a line in round 5
  const handleRate = useCallback((lineIdx: number, gotIt: boolean) => {
    if (!activeText) return
    const newMastery = [...activeText.lineMastery]
    newMastery[lineIdx] = gotIt ? 2 : 1
    const updated = { ...activeText, lineMastery: newMastery }
    setActiveText(updated)
    persistText(updated)
  }, [activeText, persistText])

  // Finish round 5 -> review
  const handleFinishRound5 = useCallback(() => {
    setState('review')
  }, [])

  // Practice only weak lines
  const handlePracticeWeak = useCallback(() => {
    if (!activeText) return
    const weakLines = activeText.lines.filter((_, i) => activeText.lineMastery[i] !== 2)
    if (weakLines.length === 0) return
    const updated: SavedText = {
      ...activeText,
      currentRound: 1,
      lineMastery: activeText.lineMastery.map(m => (m === 2 ? m : 0)),
    }
    setActiveText(updated)
    persistText(updated)
    setRound(1)
    setRevealedLines(new Set())
    setRevealedWords(new Set())
    setState('practice')
  }, [activeText, persistText])

  // Full run again
  const handleFullRun = useCallback(() => {
    if (!activeText) return
    const updated: SavedText = {
      ...activeText,
      currentRound: 1,
      lineMastery: new Array(activeText.lines.length).fill(0),
    }
    setActiveText(updated)
    persistText(updated)
    setRound(1)
    setRevealedLines(new Set())
    setRevealedWords(new Set())
    setState('practice')
  }, [activeText, persistText])

  // Speak a line using browser SpeechSynthesis
  const speakLine = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utter)
  }, [])

  // Keyboard shortcuts in practice mode
  useEffect(() => {
    if (state !== 'practice' || showRSVP) return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.code === 'Space') {
        e.preventDefault()
        // Reveal next unrevealed line
        if (activeText) {
          for (let i = 0; i < activeText.lines.length; i++) {
            if (!revealedLines.has(i)) {
              setRevealedLines(prev => new Set([...prev, i]))
              break
            }
          }
        }
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault()
        if (activeText) {
          for (let i = 0; i < activeText.lines.length; i++) {
            if (!revealedLines.has(i)) {
              setRevealedLines(prev => new Set([...prev, i]))
              break
            }
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, showRSVP, activeText, revealedLines])

  // ── RENDER ─────────────────────────────────────────

  // State 1: Input
  if (state === 'input') {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Memorize
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Poems, songs, dialogues, speeches — any text in any language.
        </p>

        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <input
            type="text"
            placeholder="Title (optional)"
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm mb-3 border-none outline-none"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)' }}
          />
          <textarea
            ref={textareaRef}
            placeholder="Paste your text here (poem, song lyrics, dialogue, speech...)"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            rows={10}
            className="w-full px-3 py-3 rounded-lg text-sm resize-none border-none outline-none leading-relaxed"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)' }}
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {splitLines(textInput).length} lines
            </span>
            <button
              onClick={handleStart}
              disabled={splitLines(textInput).length === 0}
              className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-opacity"
              style={{
                background: 'var(--color-primary-main)',
                color: '#fff',
                opacity: splitLines(textInput).length === 0 ? 0.4 : 1,
              }}
            >
              Start Memorizing
            </button>
          </div>
        </div>

        {/* Saved texts list */}
        {savedTexts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Your Texts
            </h3>
            <div className="flex flex-col gap-2">
              {savedTexts.map(t => {
                const mastery = getMastery(t.lineMastery)
                return (
                  <button
                    key={t.id}
                    onClick={() => handleResume(t)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-left cursor-pointer transition-colors border group"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {t.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {t.lines.length} lines &middot; Round {t.currentRound}/5
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${mastery}%`,
                              background: mastery >= 80 ? 'var(--color-correct)' : mastery >= 40 ? 'var(--color-accent)' : 'var(--color-primary-main)',
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                          {mastery}%
                        </span>
                      </div>
                      <span
                        onClick={e => handleDelete(t.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded cursor-pointer transition-opacity"
                        style={{ color: 'var(--color-incorrect)' }}
                      >
                        &times;
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // State 2: Practice
  if (state === 'practice' && activeText) {
    const roundLabels = ['Read Through', 'Last Words Hidden', 'Half Hidden', 'First Letters Only', 'Fully Hidden']
    const allRated = round === 5 && activeText.lineMastery.every(m => m > 0)

    return (
      <div className="max-w-2xl mx-auto" dir={rtl ? 'rtl' : undefined}>
        {showRSVP && (
          <RSVPPlayer lines={activeText.lines} speed={rsvpSpeed} onClose={() => setShowRSVP(false)} />
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setState('input')}
            className="text-sm cursor-pointer border-none bg-transparent"
            style={{ color: 'var(--color-text-muted)' }}
          >
            &larr; Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRSVP(true)}
              className="px-2.5 py-1 rounded-lg text-xs cursor-pointer border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}
              title="RSVP Speed Reader"
            >
              RSVP
            </button>
            <select
              value={rsvpSpeed}
              onChange={e => setRsvpSpeed(Number(e.target.value))}
              className="text-xs px-2 py-1 rounded-lg border cursor-pointer"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}
            >
              <option value={150}>150ms</option>
              <option value={200}>200ms</option>
              <option value={250}>250ms</option>
              <option value={300}>300ms</option>
              <option value={400}>400ms</option>
            </select>
          </div>
        </div>

        <h2 className="text-lg font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
          {activeText.title}
        </h2>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Round {round}: {roundLabels[round - 1]}
        </p>

        <RoundIndicator current={round - 1} total={5} />

        {/* Lines */}
        <div className="flex flex-col gap-1.5">
          {activeText.lines.map((line, i) => {
            // Skip mastered lines if practicing weak
            const lineNum = i + 1

            // Round 1: full text
            if (round === 1) {
              return (
                <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg group" style={{ background: 'var(--color-surface)' }}>
                  <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)', minWidth: '1.5rem', textAlign: 'right' }}>{lineNum}</span>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--color-text-primary)' }}>{line}</p>
                  <button
                    onClick={() => speakLine(line)}
                    className="opacity-0 group-hover:opacity-100 text-xs cursor-pointer border-none bg-transparent shrink-0 transition-opacity"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Listen"
                  >
                    &#9654;
                  </button>
                </div>
              )
            }

            // Round 2: last word hidden
            if (round === 2) {
              const { display } = hideLastWord(line)
              const revealed = revealedLines.has(i)
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  style={{ background: revealed ? 'var(--color-primary-pale)' : 'var(--color-surface)' }}
                  onClick={() => setRevealedLines(prev => new Set([...prev, i]))}
                >
                  <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)', minWidth: '1.5rem', textAlign: 'right' }}>{lineNum}</span>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--color-text-primary)' }}>
                    {revealed ? line : <>{display.replace('___', '')}<span className="px-1 py-0.5 rounded font-medium" style={{ background: 'var(--color-primary-faded)', color: 'var(--color-primary-main)' }}>___</span></>}
                  </p>
                </div>
              )
            }

            // Round 3: half hidden
            if (round === 3) {
              const { parts } = hideHalf(line)
              return (
                <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface)' }}>
                  <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)', minWidth: '1.5rem', textAlign: 'right' }}>{lineNum}</span>
                  <p className="text-sm leading-relaxed flex-1 flex flex-wrap gap-1" style={{ color: 'var(--color-text-primary)' }}>
                    {parts.map((p, j) => {
                      const key = `${i}-${j}`
                      if (!p.hidden) return <span key={key}>{p.text}</span>
                      const isRevealed = revealedWords.has(key)
                      return (
                        <span
                          key={key}
                          className="px-1 py-0.5 rounded cursor-pointer transition-colors"
                          style={{
                            background: isRevealed ? 'var(--color-primary-pale)' : 'var(--color-primary-faded)',
                            color: isRevealed ? 'var(--color-text-primary)' : 'var(--color-primary-faded)',
                          }}
                          onClick={() => setRevealedWords(prev => new Set([...prev, key]))}
                        >
                          {isRevealed ? p.text : '___'}
                        </span>
                      )
                    })}
                  </p>
                </div>
              )
            }

            // Round 4: first letters only
            if (round === 4) {
              const hint = firstLettersOnly(line)
              const revealed = revealedLines.has(i)
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  style={{ background: revealed ? 'var(--color-primary-pale)' : 'var(--color-surface)' }}
                  onClick={() => setRevealedLines(prev => new Set([...prev, i]))}
                >
                  <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)', minWidth: '1.5rem', textAlign: 'right' }}>{lineNum}</span>
                  <p className="text-sm leading-relaxed flex-1 font-mono" style={{ color: revealed ? 'var(--color-text-primary)' : 'var(--color-text-muted)', letterSpacing: revealed ? 'normal' : '0.05em' }}>
                    {revealed ? line : hint}
                  </p>
                </div>
              )
            }

            // Round 5: fully hidden with rating
            if (round === 5) {
              const revealed = revealedLines.has(i)
              const rating = activeText.lineMastery[i]
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 px-3 py-2 rounded-lg transition-colors"
                  style={{
                    background: rating === 2
                      ? 'var(--color-correct-bg)'
                      : rating === 1
                        ? 'var(--color-incorrect-bg)'
                        : 'var(--color-surface)',
                  }}
                >
                  <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)', minWidth: '1.5rem', textAlign: 'right' }}>{lineNum}</span>
                  <div className="flex-1">
                    {!revealed ? (
                      <p
                        className="text-sm leading-relaxed cursor-pointer py-1 rounded"
                        style={{ color: 'var(--color-text-muted)' }}
                        onClick={() => setRevealedLines(prev => new Set([...prev, i]))}
                      >
                        Tap to reveal line {lineNum}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--color-text-primary)' }}>{line}</p>
                        {rating === 0 && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRate(i, true)}
                              className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border-none"
                              style={{ background: 'var(--color-correct)', color: '#fff' }}
                            >
                              Got it
                            </button>
                            <button
                              onClick={() => handleRate(i, false)}
                              className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border-none"
                              style={{ background: 'var(--color-incorrect)', color: '#fff' }}
                            >
                              Missed
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>

        {/* Bottom controls */}
        <div className="flex justify-between items-center mt-6">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {round < 5 ? 'Space / tap to reveal' : `${activeText.lineMastery.filter(m => m > 0).length}/${activeText.lines.length} rated`}
          </span>
          {round < 5 && (
            <button
              onClick={handleNextRound}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none"
              style={{ background: 'var(--color-primary-main)', color: '#fff' }}
            >
              Next: {roundLabels[round] || 'More Hidden'}
            </button>
          )}
          {round === 5 && allRated && (
            <button
              onClick={handleFinishRound5}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none"
              style={{ background: 'var(--color-primary-main)', color: '#fff' }}
            >
              See Results
            </button>
          )}
        </div>
      </div>
    )
  }

  // State 3: Review
  if (state === 'review' && activeText) {
    const mastery = getMastery(activeText.lineMastery)
    const got = activeText.lineMastery.filter(m => m === 2).length
    const missed = activeText.lineMastery.filter(m => m === 1).length

    return (
      <div className="max-w-2xl mx-auto" dir={rtl ? 'rtl' : undefined}>
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {activeText.title}
        </h2>

        {/* Score card */}
        <div
          className="rounded-xl p-5 mb-5 text-center"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-4xl font-bold mb-1" style={{ color: mastery >= 80 ? 'var(--color-correct)' : mastery >= 40 ? 'var(--color-accent)' : 'var(--color-incorrect)' }}>
            {mastery}%
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {got} memorized &middot; {missed} need work &middot; {activeText.lines.length} total
          </p>
        </div>

        {/* Lines with color coding */}
        <div className="flex flex-col gap-1 mb-6">
          {activeText.lines.map((line, i) => {
            const m = activeText.lineMastery[i]
            const bgColor = m === 2
              ? 'var(--color-correct-bg)'
              : m === 1
                ? 'var(--color-incorrect-bg)'
                : 'var(--color-surface-alt)'
            const borderLeft = m === 2
              ? '3px solid var(--color-correct)'
              : m === 1
                ? '3px solid var(--color-incorrect)'
                : '3px solid var(--color-border)'
            return (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-2 rounded-r-lg"
                style={{ background: bgColor, borderLeft }}
              >
                <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)', minWidth: '1.5rem', textAlign: 'right' }}>{i + 1}</span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{line}</p>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {missed > 0 && (
            <button
              onClick={handlePracticeWeak}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer border-none"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              Practice Weak Lines ({missed})
            </button>
          )}
          <button
            onClick={handleFullRun}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'var(--color-surface)' }}
          >
            Full Run Again
          </button>
          <button
            onClick={() => setState('input')}
            className="px-4 py-2.5 rounded-lg text-sm cursor-pointer border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', background: 'var(--color-surface)' }}
          >
            Back to Library
          </button>
        </div>
      </div>
    )
  }

  return null
}
