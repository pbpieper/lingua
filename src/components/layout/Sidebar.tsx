import { useMemo } from 'react'
import { useApp } from '@/context/AppContext'
import { usePreferences } from '@/hooks/usePreferences'
import { TOOLS, PRACTICE_GROUPS, HUB_TOOL_MAP } from '@/types/tools'
import type { LinguaToolId, ToolDef } from '@/types/tools'

/** Tools always visible regardless of progress (from day 1) */
const ALWAYS_VISIBLE: Set<LinguaToolId> = new Set([
  'home', 'wordbank', 'flashcards', 'upload', 'settings',
  'teacher', 'community',
  // Hub entries are always visible
  'reading-hub', 'writing-hub', 'speaking-hub', 'listening-hub', 'games-hub',
])

/** Tier 2: unlock after 10 flashcard reviews */
const TIER_2_TOOLS: LinguaToolId[] = ['match', 'fillblank', 'multichoice', 'cloze']

/** Tier 3: unlock after 7 days of use OR 50+ words */
const TIER_3_TOOLS: LinguaToolId[] = [
  'writing', 'speaking', 'listening', 'reading', 'prelearn', 'stories', 'grammar',
]

/** Tier 4: unlock after 100+ words mastered */
const TIER_4_TOOLS: LinguaToolId[] = ['universe', 'dashboard', 'achievements', 'phrases']

interface UnlockCtx {
  totalReviewed: number
  totalWords: number
  wordsMastered: number
  daysUsed: number
}

function getToolVisibility(ctx: UnlockCtx): { visible: Set<LinguaToolId>; nextUnlock: string | null } {
  const visible = new Set<LinguaToolId>(ALWAYS_VISIBLE)
  let nextUnlock: string | null = null

  if (ctx.totalReviewed >= 10) {
    for (const t of TIER_2_TOOLS) visible.add(t)
  } else if (!nextUnlock) {
    nextUnlock = `Review ${10 - ctx.totalReviewed} more card${ctx.totalReviewed === 9 ? '' : 's'} to unlock practice games`
  }

  if (ctx.daysUsed >= 7 || ctx.totalWords >= 50) {
    for (const t of TIER_3_TOOLS) visible.add(t)
  } else if (!nextUnlock) {
    nextUnlock = 'Keep learning to unlock production tools'
  }

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

  const { visible, nextUnlock } = useMemo(
    () => getToolVisibility({ totalReviewed, totalWords, wordsMastered, daysUsed }),
    [totalReviewed, totalWords, wordsMastered, daysUsed]
  )

  const handleClick = (toolId: LinguaToolId) => {
    setActiveTool(toolId)
    onToolClick?.(toolId)
  }

  const showAll = prefs.showAllTools

  // Check if active tool belongs to a practice group (for highlighting hub entries)
  const activeInHub = (hubId: string): boolean => {
    if (activeTool === hubId) return true
    const toolIds = HUB_TOOL_MAP[hubId]
    return toolIds ? toolIds.includes(activeTool) : false
  }

  // Build sections
  const libraryTools = TOOLS.filter(t => t.category === 'library')
  const communityTools = TOOLS.filter(t => t.category === 'community')

  // Practice hub entries (one per group)
  const practiceHubs = PRACTICE_GROUPS.map(pg => {
    const hubId = `${pg.key}-hub` as LinguaToolId
    const def = TOOLS.find(t => t.id === hubId)
    return { ...pg, hubId, def }
  })

  return (
    <nav className="w-[220px] h-full shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col overflow-y-auto">
      {/* Logo header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-extrabold text-[var(--color-primary-dark)] tracking-tight">Lingua</h2>
      </div>

      <div className="flex-1 px-2 py-2 flex flex-col gap-0.5 overflow-y-auto">
        {/* HOME */}
        <ToolButton
          tool={{ id: 'home', label: 'Home', icon: '\u{1F3E0}', description: '', category: 'home' }}
          active={activeTool === 'home'}
          onClick={() => handleClick('home')}
        />

        {/* PRACTICE section */}
        <SectionDivider label="Practice" />
        {practiceHubs.map(({ key, label, icon, hubId }) => (
          <ToolButton
            key={hubId}
            tool={{ id: hubId, label, icon, description: '', category: 'practice' }}
            active={activeInHub(hubId)}
            onClick={() => handleClick(hubId)}
            badgeCount={key === 'games' ? dueCount : undefined}
          />
        ))}

        {/* LIBRARY section */}
        <SectionDivider label="Library" />
        {libraryTools.map(tool => {
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

        {/* COMMUNITY section */}
        <SectionDivider label="Community" />
        {communityTools.map(tool => {
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
          <div className="mt-3 mx-1 px-3 py-2 rounded-lg bg-[var(--color-primary-faded)] border border-[var(--color-primary-light)]">
            <p className="text-[10px] leading-snug text-[var(--color-primary-dark)]">{nextUnlock}</p>
          </div>
        )}
      </div>

      {/* Show all tools toggle (pinned to bottom) */}
      <div className="px-3 py-2 border-t border-[var(--color-border)]">
        <button
          onClick={() => setPref('showAllTools', !showAll)}
          className="w-full text-left px-2 py-1.5 text-[10px] text-[var(--color-text-muted)] cursor-pointer border-none bg-transparent hover:text-[var(--color-text-secondary)] transition-colors rounded-md hover:bg-[var(--color-surface-alt)]"
        >
          {showAll ? '\u25C9 Showing all tools' : '\u25CB Show all tools'}
        </button>
      </div>
    </nav>
  )
}

/** Section divider with label */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mt-4 mb-1 px-3 flex items-center gap-2">
      <span className="uppercase text-[10px] tracking-wider font-bold text-[var(--color-text-muted)]">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  )
}

function ToolButton({ tool, active, onClick, nested, badgeCount }: {
  tool: ToolDef
  active: boolean
  onClick: () => void
  nested?: boolean
  badgeCount?: number
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-left cursor-pointer border-none transition-all
        ${nested ? 'text-[13px]' : 'text-sm'}
        ${active
          ? 'bg-[var(--color-primary-main)] text-white shadow-sm font-bold'
          : 'bg-transparent text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-surface-alt)]'
        }`}
    >
      <span className={active ? 'grayscale-0' : 'opacity-70'}>{tool.icon}</span>
      <span className="truncate">{tool.label}</span>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
          {badgeCount}
        </span>
      )}
    </button>
  )
}
