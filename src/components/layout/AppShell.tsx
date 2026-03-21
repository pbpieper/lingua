import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { useApp } from '@/context/AppContext'
import { useTheme } from '@/design/theme'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ShortcutsModal } from './ShortcutsModal'
import { Sidebar } from './Sidebar'
import { ActiveStudyBanner } from './ActiveStudyBanner'
import { CommandPalette } from './CommandPalette'
import { Walkthrough } from '@/components/onboarding/Walkthrough'

// Lazy-loaded tool components for code splitting
const DailyReview = lazy(() => import('@/components/home/DailyReview').then(m => ({ default: m.DailyReview })))
const WordBank = lazy(() => import('@/components/wordbank/WordBank').then(m => ({ default: m.WordBank })))
const VocabUploader = lazy(() => import('@/components/upload/VocabUploader').then(m => ({ default: m.VocabUploader })))
const FlashcardDeck = lazy(() => import('@/components/flashcards/FlashcardDeck').then(m => ({ default: m.FlashcardDeck })))
const MatchGame = lazy(() => import('@/components/games/MatchGame').then(m => ({ default: m.MatchGame })))
const FillBlank = lazy(() => import('@/components/games/FillBlank').then(m => ({ default: m.FillBlank })))
const MultipleChoice = lazy(() => import('@/components/games/MultipleChoice').then(m => ({ default: m.MultipleChoice })))
const SpeakingPractice = lazy(() => import('@/components/speaking/SpeakingPractice').then(m => ({ default: m.SpeakingPractice })))
const ReadingAssist = lazy(() => import('@/components/reading/ReadingAssist').then(m => ({ default: m.ReadingAssist })))
const PreLearnPipeline = lazy(() => import('@/components/prelearn/PreLearnPipeline').then(m => ({ default: m.PreLearnPipeline })))
const ListeningPractice = lazy(() => import('@/components/listening/ListeningPractice').then(m => ({ default: m.ListeningPractice })))
const WritingPractice = lazy(() => import('@/components/writing/WritingPractice').then(m => ({ default: m.WritingPractice })))
const ClozePractice = lazy(() => import('@/components/games/ClozePractice').then(m => ({ default: m.ClozePractice })))
const StoryReader = lazy(() => import('@/components/stories/StoryReader').then(m => ({ default: m.StoryReader })))
const GrammarLessons = lazy(() => import('@/components/grammar/GrammarLessons').then(m => ({ default: m.GrammarLessons })))
const PhrasePractice = lazy(() => import('@/components/phrases/PhrasePractice').then(m => ({ default: m.PhrasePractice })))
const VocabUniverse = lazy(() => import('@/components/universe/VocabUniverse').then(m => ({ default: m.VocabUniverse })))
const TeacherPortal = lazy(() => import('@/components/teacher/TeacherPortal').then(m => ({ default: m.TeacherPortal })))
const Community = lazy(() => import('@/components/community/Community').then(m => ({ default: m.Community })))
const Achievements = lazy(() => import('@/components/achievements/Achievements').then(m => ({ default: m.Achievements })))
const VocabDashboard = lazy(() => import('@/components/wordbank/VocabDashboard').then(m => ({ default: m.VocabDashboard })))
const Settings = lazy(() => import('@/components/settings/Settings').then(m => ({ default: m.Settings })))
const FeedbackDashboard = lazy(() => import('@/components/feedback/FeedbackDashboard').then(m => ({ default: m.FeedbackDashboard })))
const MediaLibrary = lazy(() => import('@/components/media/MediaLibrary').then(m => ({ default: m.MediaLibrary })))
import { TOOLS } from '@/types/tools'
import type { LinguaToolId } from '@/types/tools'

// Bottom tab bar items for mobile — maps to top-level sections
const MOBILE_TABS: Array<{ id: LinguaToolId; icon: string; label: string }> = [
  { id: 'home', icon: '\u{1F3E0}', label: 'Home' },
  { id: 'flashcards', icon: '\u{1F4AA}', label: 'Practice' },
  { id: 'dashboard', icon: '\u{1F4CA}', label: 'Track' },
  { id: 'community', icon: '\u{1F30D}', label: 'Social' },
]

function ToolContent({ toolId }: { toolId: LinguaToolId }) {
  switch (toolId) {
    case 'home': return <DailyReview />
    case 'wordbank': return <WordBank />
    case 'upload': return <VocabUploader />
    case 'media': return <MediaLibrary />
    case 'flashcards': return <FlashcardDeck />
    case 'match': return <MatchGame />
    case 'fillblank': return <FillBlank />
    case 'multichoice': return <MultipleChoice />
    case 'speaking': return <SpeakingPractice />
    case 'reading': return <ReadingAssist />
    case 'prelearn': return <PreLearnPipeline />
    case 'listening': return <ListeningPractice />
    case 'writing': return <WritingPractice />
    case 'cloze': return <ClozePractice />
    case 'stories': return <StoryReader />
    case 'grammar': return <GrammarLessons />
    case 'phrases': return <PhrasePractice />
    case 'universe': return <VocabUniverse />
    case 'teacher': return <TeacherPortal />
    case 'community': return <Community />
    case 'achievements': return <Achievements />
    case 'dashboard': return <VocabDashboard />
    case 'settings': return <Settings />
    case 'feedback-admin': return <FeedbackDashboard />
    default: return <p className="text-[var(--color-text-muted)]">Select a tool</p>
  }
}

export function AppShell() {
  const { activeTool, hubAvailable, wordsDue, setActiveTool: setTool } = useApp()
  const { isDark, toggle } = useTheme()
  const { showShortcuts, setShowShortcuts } = useKeyboardShortcuts()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Cmd+K / Ctrl+K to open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleToolClick = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const activeToolDef = TOOLS.find(t => t.id === activeTool)

  return (
    <div className="flex h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Backdrop overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar wrapper with responsive behavior */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-[200px] transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onToolClick={handleToolClick} dueCount={wordsDue} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] md:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer text-[var(--color-text-secondary)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            {activeToolDef && <span>{activeToolDef.icon}</span>}
            {activeToolDef && <span>{activeToolDef.label}</span>}
          </div>
          <button onClick={toggle}
            className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs cursor-pointer text-[var(--color-text-secondary)]">
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="max-w-[900px] mx-auto px-4 py-4 md:px-8 md:py-6">
            {/* Desktop-only top bar */}
            <div className="hidden md:flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                {!hubAvailable && (
                  <span className="px-2 py-1 rounded-md text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                    Backend offline
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs cursor-pointer text-[var(--color-text-muted)] flex items-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <span>Search</span>
                  <kbd className="ml-1 px-1 py-0.5 rounded text-[10px] font-mono bg-[var(--color-surface-alt)] border border-[var(--color-border)]">⌘K</kbd>
                </button>
                <button onClick={toggle}
                  className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs cursor-pointer text-[var(--color-text-secondary)]">
                  {isDark ? '☀️ Light' : '🌙 Dark'}
                </button>
              </div>
            </div>

            {/* Mobile-only backend status */}
            {!hubAvailable && (
              <div className="mb-3 md:hidden">
                <span className="px-2 py-1 rounded-md text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                  Backend offline
                </span>
              </div>
            )}

            <ActiveStudyBanner />

            <Suspense fallback={<div className="text-center py-8 text-sm text-[var(--color-text-muted)]">Loading...</div>}>
              <ToolContent toolId={activeTool} />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-around py-1.5">
          {MOBILE_TABS.map(tab => {
            const active = activeTool === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setTool(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg cursor-pointer transition-colors border-none bg-transparent ${
                  active ? 'text-[var(--color-primary-main)]' : 'text-[var(--color-text-muted)]'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
                {tab.id === 'flashcards' && wordsDue > 0 && (
                  <span className="absolute -top-0.5 right-0 w-2 h-2 rounded-full bg-[var(--color-accent-main)]" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <Walkthrough />
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  )
}
