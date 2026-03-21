import { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '@/context/AppContext'
import { usePreferences } from '@/hooks/usePreferences'
import { TOOLS, PRACTICE_GROUPS } from '@/types/tools'
import type { LinguaToolId, ToolDef } from '@/types/tools'

/** Tools always visible regardless of progress (from day 1) */
const ALWAYS_VISIBLE: Set<LinguaToolId> = new Set([
  'home', 'wordbank', 'flashcards', 'upload', 'settings',
])

/** Tier 2: unlock after 10 flashcard reviews */
const TIER_2_TOOLS: LinguaToolId[] = ['match', 'fillblank', 'multichoice', 'cloze']

/** Tier 3: unlock after 7 days of use OR 50+ words */
const TIER_3_TOOLS: LinguaToolId[] = [
  'writing', 'speaking', 'listening', 'reading', 'prelearn', 'stories', 'grammar',
]

/** Tier 4: unlock after 100+ words mastered */
const TIER_4_TOOLS: LinguaToolId[] = ['universe', 'dashboard', 'achievements', 'phrases', 'teacher', 'community']

interface UnlockCtx {
  totalReviewed: number
  totalWords: number
  wordsMastered: number
  daysUsed: number
}

function getToolVisibility(ctx: UnlockCtx): { visible: Set<LinguaToolId>; nextUnlock: string | null } {
  const visible = new Set<LinguaToolId>(ALWAYS_VISIBLE)
  let nextUnlock: string | null = null

  // Tier 2: 10+ flashcard reviews
  if (ctx.totalReviewed >= 10) {
    for (const t of TIER_2_TOOLS) visible.add(t)
  } else if (!nextUnlock) {
    nextUnlock = `Review ${10 - ctx.totalReviewed} more card${ctx.totalReviewed === 9 ? '' : 's'} to unlock practice games`
  }

  // Tier 3: 7+ days used OR 50+ total words
  if (ctx.daysUsed >= 7 || ctx.totalWords >= 50) {
    for (const t of TIER_3_TOOLS) visible.add(t)
  } else if (!nextUnlock) {
    nextUnlock = 'Keep learning to unlock production tools'
  }

  // Tier 4: 100+ words mastered
  if (ctx.wordsMastered >= 100) {
    for (const t of TIER_4_TOOLS) visible.add(t)
  } else if (!nextUnlock) {
    nextUnlock = `Master ${100 - ctx.wordsMastered} more word${ctx.wordsMastered === 99 ? '' : 's'} to unlock tracking`
  }

  return { visible, nextUnlock }
}

function isAdminMode(): boolean {
  if (typeof window !== 'undefined') {
    if (new URLSearchParams(window.location.search).get('admin') === 'true') return true
    if (localStorage.getItem('lingua-admin') === 'true') return true
  }
  return false
}

export function Sidebar({ onToolClick, dueCount = 0 }: {
  onToolClick?: (toolId: LinguaToolId) => void
  dueCount?: number
}) {
  const { activeTool, setActiveTool, totalWords, totalReviewed, wordsMastered, daysUsed } = useApp()
  const { prefs, setPref } = usePreferences()
  const adminMode = useMemo(() => isAdminMode(), [])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const stored = prefs.sidebarCollapsed
    return { ...stored }
  })

  const { visible, nextUnlock } = useMemo(
    () => getToolVisibility({ totalReviewed, totalWords, wordsMastered, daysUsed }),
    [totalReviewed, totalWords, wordsMastered, daysUsed]
  )

  useEffect(() => {
    setPref('sidebarCollapsed', collapsed)
  }, [collapsed, setPref])

  const handleClick = (toolId: LinguaToolId) => {
    setActiveTool(toolId)
    onToolClick?.(toolId)
  }

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const showAll = prefs.showAllTools

  // Build data for each section
  const homeTools = TOOLS.filter(t => t.category === 'home')
  const trackTools = TOOLS.filter(t => t.category === 'track')
  const socialTools = TOOLS.filter(t => t.category === 'social')

  // Practice sub-groups
  const practiceSubGroups = PRACTICE_GROUPS.map(pg => ({
    key: pg.key,
    label: pg.label,
    icon: pg.icon,
    tools: TOOLS.filter(t => t.category === 'practice' && t.practiceGroup === pg.key),
  }))

  return (
    <nav className="w-[200px] h-full shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-0.5 overflow-y-auto">
      <h2 className="text-lg font-extrabold text-[var(--color-primary-dark)] px-2 mb-3">Lingua</h2>

      {/* HOME section — flat list, no group header */}
      {homeTools.map(tool => {
        const isVisible = showAll || visible.has(tool.id)
        if (!isVisible) return null
        return (
          <ToolButton
            key={tool.id}
            tool={tool}
            active={activeTool === tool.id}
            onClick={() => handleClick(tool.id)}
          />
        )
      })}

      {/* PRACTICE section with sub-categories */}
      <SectionLabel label="Practice" />
      {practiceSubGroups.map(group => {
        const displayTools = showAll ? group.tools : group.tools.filter(t => visible.has(t.id))
        const lockedCount = showAll ? 0 : group.tools.length - displayTools.length
        if (displayTools.length === 0 && lockedCount === 0) return null
        return (
          <SubGroup
            key={group.key}
            label={group.label}
            icon={group.icon}
            tools={displayTools}
            lockedCount={lockedCount}
            isCollapsed={!!collapsed[`practice:${group.key}`]}
            onToggle={() => toggleGroup(`practice:${group.key}`)}
            activeTool={activeTool}
            onToolClick={handleClick}
            showAll={showAll}
            badgeCount={group.key === 'games' ? dueCount : undefined}
          />
        )
      })}

      {/* TRACK section — flat list */}
      <SectionLabel label="Track" />
      {trackTools.map(tool => {
        // Hide feedback-admin unless admin mode is active
        if (tool.id === 'feedback-admin' && !adminMode) return null
        const isVisible = showAll || visible.has(tool.id)
        if (!isVisible) return null
        return (
          <ToolButton
            key={tool.id}
            tool={tool}
            active={activeTool === tool.id}
            onClick={() => handleClick(tool.id)}
          />
        )
      })}

      {/* SOCIAL section — flat list */}
      <SectionLabel label="Social" />
      {socialTools.map(tool => {
        const isVisible = showAll || visible.has(tool.id)
        if (!isVisible) return null
        return (
          <ToolButton
            key={tool.id}
            tool={tool}
            active={activeTool === tool.id}
            onClick={() => handleClick(tool.id)}
          />
        )
      })}

      {/* Next unlock hint */}
      {!showAll && nextUnlock && (
        <div className="mt-3 px-2 py-2 rounded-lg bg-[var(--color-primary-faded)] text-xs text-[var(--color-primary-dark)]">
          <span className="text-[var(--color-text-muted)]">{nextUnlock}</span>
        </div>
      )}

      {/* Show all tools toggle */}
      <button
        onClick={() => setPref('showAllTools', !showAll)}
        className="mt-auto pt-2 px-2 py-1.5 text-[10px] text-[var(--color-text-muted)] cursor-pointer border-none bg-transparent text-left hover:text-[var(--color-text-secondary)] transition-colors"
      >
        {showAll ? '\u25C9 Showing all tools' : '\u25CB Show all tools'}
      </button>
    </nav>
  )
}

/** Section label (uppercase, muted) */
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mt-3 px-2 pb-1">
      <span className="uppercase text-[10px] tracking-wider font-semibold text-[var(--color-text-muted)]">
        {label}
      </span>
    </div>
  )
}

/** Expandable/collapsible sub-group within Practice */
function SubGroup({
  label,
  icon,
  tools,
  lockedCount,
  isCollapsed,
  onToggle,
  activeTool,
  onToolClick,
  showAll,
  badgeCount,
}: {
  label: string
  icon: string
  tools: ToolDef[]
  lockedCount: number
  isCollapsed: boolean
  onToggle: () => void
  activeTool: LinguaToolId
  onToolClick: (id: LinguaToolId) => void
  showAll: boolean
  badgeCount?: number
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [tools.length])

  return (
    <div className="mt-0.5">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2 py-1 cursor-pointer border-none bg-transparent"
      >
        <span
          className="text-[10px] text-[var(--color-text-muted)] leading-none"
          style={{ transition: 'transform 0.15s ease' }}
        >
          {isCollapsed ? '\u25B8' : '\u25BE'}
        </span>
        <span className="text-xs">{icon}</span>
        <span className="text-xs tracking-wide font-medium text-[var(--color-text-muted)]">
          {label}
        </span>
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-faded)] text-[var(--color-primary-dark)]">
            {badgeCount}
          </span>
        )}
        {!showAll && lockedCount > 0 && (
          <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
            +{lockedCount}
          </span>
        )}
      </button>
      <div
        style={{
          maxHeight: isCollapsed ? 0 : height ?? 'none',
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
        }}
      >
        <div ref={contentRef} className="flex flex-col gap-0.5 pt-0.5 pl-2">
          {tools.map(tool => (
            <ToolButton
              key={tool.id}
              tool={tool}
              active={activeTool === tool.id}
              onClick={() => onToolClick(tool.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ToolButton({ tool, active, onClick }: {
  tool: ToolDef
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm cursor-pointer border-none transition-all"
      style={{
        background: active ? 'var(--color-primary-faded)' : 'transparent',
        color: active ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
        fontWeight: active ? 700 : 500,
      }}
    >
      <span>{tool.icon}</span>
      <span>{tool.label}</span>
    </button>
  )
}
