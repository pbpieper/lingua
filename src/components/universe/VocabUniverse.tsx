import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { Word, VocabList, VocabStats } from '@/types/word'

// --- Types ---

interface StarData {
  word: Word
  x: number
  y: number
  size: number
  brightness: number
  mastery: MasteryLevel
  constellation: number // list index
}

type MasteryLevel = 'new' | 'learning' | 'familiar' | 'mastered'
type ViewMode = 'galaxy' | 'constellation' | 'stats'

// --- Helpers ---

function getMastery(word: Word): MasteryLevel {
  if (word.interval_days >= 21) return 'mastered'
  if (word.interval_days >= 7) return 'familiar'
  if (word.exposure_count > 0) return 'learning'
  return 'new'
}

const MASTERY_COLORS: Record<MasteryLevel, string> = {
  new: '#94a3b8',       // slate-400
  learning: '#f59e0b',  // amber/orange accent
  familiar: '#3b82f6',  // blue
  mastered: '#10b981',  // emerald
}

const MASTERY_LABELS: Record<MasteryLevel, string> = {
  new: 'Undiscovered',
  learning: 'Emerging',
  familiar: 'Orbiting',
  mastered: 'Radiant',
}

// Deterministic pseudo-random from word id for stable positions
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

// Distribute stars in a spiral galaxy pattern per constellation
function layoutStars(words: Word[], lists: VocabList[]): StarData[] {
  const listIndex = new Map(lists.map((l, i) => [l.id, i]))
  const constellationCount = lists.length || 1

  // Galaxy center
  const cx = 500
  const cy = 400

  return words.map((word) => {
    const ci = listIndex.get(word.list_id ?? -1) ?? 0
    const mastery = getMastery(word)

    // Spiral arm offset per constellation
    const armAngle = (ci / constellationCount) * Math.PI * 2
    const r = seededRandom(word.id)
    const r2 = seededRandom(word.id + 1000)

    // Distance from center: mastered words closer to center (core), new words at edges
    const masteryDistanceFactor = mastery === 'mastered' ? 0.3 : mastery === 'familiar' ? 0.55 : mastery === 'learning' ? 0.75 : 0.9
    const distance = (80 + r * 280) * masteryDistanceFactor

    // Spiral angle
    const angle = armAngle + (r * 2.5) + (distance / 200)

    // Add some scatter
    const scatter = r2 * 30

    const x = cx + Math.cos(angle) * distance + Math.cos(angle + 1.57) * scatter
    const y = cy + Math.sin(angle) * distance * 0.6 + Math.sin(angle + 1.57) * scatter * 0.6

    // Star size based on exposure (more reviews = bigger star)
    const size = Math.min(2 + word.exposure_count * 0.5, 8)

    // Brightness based on mastery
    const brightness = mastery === 'mastered' ? 1 : mastery === 'familiar' ? 0.8 : mastery === 'learning' ? 0.6 : 0.3

    return { word, x, y, size, brightness, mastery, constellation: ci }
  })
}

// --- Star Component (SVG) ---

function Star({ star, selected, onClick }: {
  star: StarData
  selected: boolean
  onClick: () => void
}) {
  const color = MASTERY_COLORS[star.mastery]
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Glow */}
      {star.brightness > 0.5 && (
        <circle
          cx={star.x}
          cy={star.y}
          r={star.size * 2.5}
          fill={color}
          opacity={star.brightness * 0.15}
        />
      )}
      {/* Core */}
      <circle
        cx={star.x}
        cy={star.y}
        r={star.size}
        fill={color}
        opacity={star.brightness}
        stroke={selected ? '#fff' : 'none'}
        strokeWidth={selected ? 2 : 0}
      />
      {/* Twinkle for mastered */}
      {star.mastery === 'mastered' && (
        <>
          <line x1={star.x - star.size * 1.5} y1={star.y} x2={star.x + star.size * 1.5} y2={star.y} stroke={color} strokeWidth={0.5} opacity={0.6} />
          <line x1={star.x} y1={star.y - star.size * 1.5} x2={star.x} y2={star.y + star.size * 1.5} stroke={color} strokeWidth={0.5} opacity={0.6} />
        </>
      )}
    </g>
  )
}

// --- Constellation Lines ---

function ConstellationLines({ stars, color }: { stars: StarData[], color: string }) {
  if (stars.length < 2) return null

  // Connect nearest mastered/familiar stars with faint lines
  const connected = stars.filter(s => s.mastery === 'mastered' || s.mastery === 'familiar')
  if (connected.length < 2) return null

  // Simple minimum spanning tree approximation
  const lines: Array<[StarData, StarData]> = []
  const used = new Set<number>([0])

  while (used.size < connected.length && used.size < 15) {
    let bestDist = Infinity
    let bestPair: [number, number] = [0, 0]
    for (const ui of used) {
      for (let j = 0; j < connected.length; j++) {
        if (used.has(j)) continue
        const dx = connected[ui].x - connected[j].x
        const dy = connected[ui].y - connected[j].y
        const d = dx * dx + dy * dy
        if (d < bestDist) {
          bestDist = d
          bestPair = [ui, j]
        }
      }
    }
    if (bestDist === Infinity) break
    lines.push([connected[bestPair[0]], connected[bestPair[1]]])
    used.add(bestPair[1])
  }

  return (
    <g>
      {lines.map((pair, i) => (
        <line
          key={i}
          x1={pair[0].x} y1={pair[0].y}
          x2={pair[1].x} y2={pair[1].y}
          stroke={color}
          strokeWidth={0.5}
          opacity={0.2}
        />
      ))}
    </g>
  )
}

// --- Word Tooltip ---

function WordTooltip({ star, onClose }: { star: StarData, onClose: () => void }) {
  const { word } = star
  return (
    <div
      className="absolute z-50 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg max-w-[220px]"
      style={{
        left: `min(calc(${(star.x / 1000) * 100}% - 30px), calc(100% - 240px))`,
        top: `min(calc(${(star.y / 800) * 100}% + 10px), calc(100% - 160px))`,
      }}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="font-bold text-[var(--color-text-primary)]" dir={word.language_from === 'ar' ? 'rtl' : 'ltr'}>
          {word.lemma}
        </span>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer text-xs ml-2">✕</button>
      </div>
      <div className="text-sm text-[var(--color-text-secondary)] mb-2">{word.translation}</div>
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: MASTERY_COLORS[star.mastery] }} />
        <span>{MASTERY_LABELS[star.mastery]}</span>
        <span>·</span>
        <span>{word.exposure_count} reviews</span>
      </div>
      {word.part_of_speech && (
        <div className="text-xs text-[var(--color-text-muted)] mt-1">{word.part_of_speech}{word.gender ? ` (${word.gender})` : ''}</div>
      )}
      {word.example_sentence && (
        <div className="text-xs text-[var(--color-text-muted)] mt-2 italic border-t border-[var(--color-border)] pt-1">
          "{word.example_sentence}"
        </div>
      )}
    </div>
  )
}

// --- Stats Overlay ---

function UniverseStats({ words }: { words: Word[] }) {
  const masteryBreakdown = useMemo(() => {
    const counts = { new: 0, learning: 0, familiar: 0, mastered: 0 }
    words.forEach(w => { counts[getMastery(w)]++ })
    return counts
  }, [words])

  const total = words.length || 1
  const segments = [
    { key: 'mastered' as const, pct: masteryBreakdown.mastered / total * 100 },
    { key: 'familiar' as const, pct: masteryBreakdown.familiar / total * 100 },
    { key: 'learning' as const, pct: masteryBreakdown.learning / total * 100 },
    { key: 'new' as const, pct: masteryBreakdown.new / total * 100 },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {segments.map(s => (
        <div key={s.key} className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full" style={{ background: MASTERY_COLORS[s.key] }} />
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{MASTERY_LABELS[s.key]}</span>
          </div>
          <div className="text-lg font-bold text-[var(--color-text-primary)]">{masteryBreakdown[s.key]}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{s.pct.toFixed(0)}% of universe</div>
        </div>
      ))}
    </div>
  )
}

// --- Constellation List ---

function ConstellationList({ lists, words, activeConstellation, setActiveConstellation }: {
  lists: VocabList[]
  words: Word[]
  activeConstellation: number | null
  setActiveConstellation: (i: number | null) => void
}) {
  const CONSTELLATION_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16']

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => setActiveConstellation(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all border ${
          activeConstellation === null
            ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-main)]'
        }`}
      >
        All ({words.length})
      </button>
      {lists.map((list, i) => {
        const count = words.filter(w => w.list_id === list.id).length
        const color = CONSTELLATION_COLORS[i % CONSTELLATION_COLORS.length]
        return (
          <button
            key={list.id}
            onClick={() => setActiveConstellation(activeConstellation === i ? null : i)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all border ${
              activeConstellation === i
                ? 'text-white border-transparent'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-main)]'
            }`}
            style={activeConstellation === i ? { background: color, borderColor: color } : {}}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: color }} />
            {list.name} ({count})
          </button>
        )
      })}
    </div>
  )
}

// --- Background Stars ---

function BackgroundStars() {
  const stars = useMemo(() => {
    return Array.from({ length: 120 }, (_, i) => ({
      x: seededRandom(i + 5000) * 1000,
      y: seededRandom(i + 6000) * 800,
      r: seededRandom(i + 7000) * 1.2 + 0.3,
      opacity: seededRandom(i + 8000) * 0.3 + 0.1,
    }))
  }, [])

  return (
    <g>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e2e8f0" opacity={s.opacity} />
      ))}
    </g>
  )
}

// --- Main Component ---

export function VocabUniverse() {
  const { userId, lists, hubAvailable } = useApp()
  const [words, setWords] = useState<Word[]>([])
  const [stats, setStats] = useState<VocabStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStar, setSelectedStar] = useState<StarData | null>(null)
  const [activeConstellation, setActiveConstellation] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('galaxy')
  const [_searchQuery, _setSearchQuery] = useState('')
  const [_masteryFilter, _setMasteryFilter] = useState<MasteryLevel | 'all'>('all')
  const svgRef = useRef<SVGSVGElement>(null)

  // Zoom & pan state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!hubAvailable) { setLoading(false); return }
    Promise.all([
      api.getWords(userId),
      api.getStats(userId),
    ]).then(([w, s]) => {
      setWords(w)
      setStats(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId, hubAvailable])

  const allStars = useMemo(() => layoutStars(words, lists), [words, lists])

  const visibleStars = useMemo(() => {
    if (activeConstellation === null) return allStars
    return allStars.filter(s => s.constellation === activeConstellation)
  }, [allStars, activeConstellation])

  const CONSTELLATION_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16']

  // Group stars by constellation for lines
  const constellationGroups = useMemo(() => {
    const groups: Map<number, StarData[]> = new Map()
    visibleStars.forEach(s => {
      const arr = groups.get(s.constellation) || []
      arr.push(s)
      groups.set(s.constellation, arr)
    })
    return groups
  }, [visibleStars])

  // Mouse handlers for pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }, [transform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    setTransform(t => ({ ...t, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }))
  }, [dragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(t => ({
      ...t,
      scale: Math.max(0.3, Math.min(3, t.scale * delta)),
    }))
  }, [])

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
    setSelectedStar(null)
    setActiveConstellation(null)
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-primary-main)] border-t-transparent animate-spin" />
        <p className="text-sm text-[var(--color-text-muted)]">Mapping your vocabulary universe...</p>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="text-5xl">🌌</div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Your Universe Awaits</h2>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
          Every word you learn becomes a star in your vocabulary galaxy.
          Upload your first word list to begin expanding your universe.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <span className="text-2xl">🌌</span> Vocabulary Universe
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {words.length} stars · {lists.length} constellations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['galaxy', 'stats'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                viewMode === mode
                  ? 'bg-[var(--color-primary-main)] text-white border-[var(--color-primary-main)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
              }`}
            >
              {mode === 'galaxy' ? '🌌 Galaxy' : '📊 Stats'}
            </button>
          ))}
          <button
            onClick={resetView}
            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Stats view */}
      <UniverseStats words={words} />

      {/* Constellation filters */}
      <ConstellationList
        lists={lists}
        words={words}
        activeConstellation={activeConstellation}
        setActiveConstellation={setActiveConstellation}
      />

      {/* Galaxy canvas */}
      {viewMode === 'galaxy' && (
        <div className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ background: '#0f172a' }}>
          <svg
            ref={svgRef}
            viewBox="0 0 1000 800"
            className="w-full"
            style={{ cursor: dragging ? 'grabbing' : 'grab', minHeight: 400 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
              {/* Background */}
              <BackgroundStars />

              {/* Galaxy core glow */}
              <defs>
                <radialGradient id="coreGlow" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="40%" stopColor="#8b5cf6" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx="500" cy="400" rx="250" ry="150" fill="url(#coreGlow)" />

              {/* Constellation lines */}
              {Array.from(constellationGroups.entries()).map(([ci, stars]) => (
                <ConstellationLines
                  key={ci}
                  stars={stars}
                  color={CONSTELLATION_COLORS[ci % CONSTELLATION_COLORS.length]}
                />
              ))}

              {/* Stars */}
              {visibleStars.map(star => (
                <Star
                  key={star.word.id}
                  star={star}
                  selected={selectedStar?.word.id === star.word.id}
                  onClick={() => setSelectedStar(selectedStar?.word.id === star.word.id ? null : star)}
                />
              ))}
            </g>
          </svg>

          {/* Tooltip */}
          {selectedStar && (
            <WordTooltip star={selectedStar} onClose={() => setSelectedStar(null)} />
          )}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm">
            {(['new', 'learning', 'familiar', 'mastered'] as const).map(level => (
              <div key={level} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: MASTERY_COLORS[level] }} />
                <span className="text-[10px] text-slate-400">{MASTERY_LABELS[level]}</span>
              </div>
            ))}
          </div>

          {/* Zoom indicator */}
          {transform.scale !== 1 && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[10px] text-slate-400">
              {Math.round(transform.scale * 100)}%
            </div>
          )}
        </div>
      )}

      {/* Per-constellation breakdown when in stats mode */}
      {viewMode === 'stats' && (
        <div className="space-y-3">
          {lists.map((list, i) => {
            const listWords = words.filter(w => w.list_id === list.id)
            const counts = { new: 0, learning: 0, familiar: 0, mastered: 0 }
            listWords.forEach(w => { counts[getMastery(w)]++ })
            const total = listWords.length || 1
            const masteredPct = (counts.mastered / total * 100)

            return (
              <div key={list.id} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: CONSTELLATION_COLORS[i % CONSTELLATION_COLORS.length] }} />
                    <span className="font-semibold text-sm text-[var(--color-text-primary)]">{list.name}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">{listWords.length} words</span>
                </div>
                {/* Stacked bar */}
                <div className="flex h-3 rounded-full overflow-hidden bg-[var(--color-bg)]">
                  {(['mastered', 'familiar', 'learning', 'new'] as const).map(level => (
                    <div
                      key={level}
                      style={{
                        width: `${counts[level] / total * 100}%`,
                        background: MASTERY_COLORS[level],
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-xs text-[var(--color-text-muted)]">
                  <span>{masteredPct.toFixed(0)}% mastered</span>
                  <span>{counts.new} undiscovered</span>
                </div>
              </div>
            )
          })}

          {/* Overall stats from API */}
          {stats && (
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <h3 className="font-semibold text-sm text-[var(--color-text-primary)] mb-3">Universe Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <div className="text-lg font-bold text-[var(--color-text-primary)]">{stats.total_reviews}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Total reviews</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[var(--color-text-primary)]">{stats.accuracy}%</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Accuracy</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[var(--color-text-primary)]">{stats.streak.current}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Day streak</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[var(--color-text-primary)]">{stats.streak.longest}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Longest streak</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
