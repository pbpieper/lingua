import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { loadFeedbackLog, type FeedbackEntry } from './FeedbackCollector'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function calcNps(entries: FeedbackEntry[]): number | null {
  const scores = entries.map(e => e.npsScore).filter((s): s is number => s !== null)
  if (scores.length === 0) return null
  const promoters = scores.filter(s => s >= 9).length
  const detractors = scores.filter(s => s <= 6).length
  return Math.round(((promoters - detractors) / scores.length) * 100)
}

function calcAvgSatisfaction(entries: FeedbackEntry[]): number | null {
  const scores = entries.map(e => e.satisfaction).filter((s): s is number => s !== null)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function calcDifficultyBreakdown(entries: FeedbackEntry[]): Record<string, number> {
  const counts: Record<string, number> = { 'too-easy': 0, 'just-right': 0, 'too-hard': 0 }
  for (const e of entries) {
    if (e.difficulty) counts[e.difficulty] = (counts[e.difficulty] ?? 0) + 1
  }
  return counts
}

const SATISFACTION_EMOJIS = ['\uD83D\uDE2B', '\uD83D\uDE15', '\uD83D\uDE10', '\uD83D\uDE42', '\uD83D\uDE0D']

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type DashTab = 'overview' | 'tools' | 'feedback' | 'bugs'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackDashboard() {
  const [tab, setTab] = useState<DashTab>('overview')
  const entries = useMemo(() => loadFeedbackLog(), [])

  const avgSatisfaction = useMemo(() => calcAvgSatisfaction(entries), [entries])
  const nps = useMemo(() => calcNps(entries), [entries])
  const difficultyBreakdown = useMemo(() => calcDifficultyBreakdown(entries), [entries])

  // Tool analysis
  const toolAnalysis = useMemo(() => {
    const worked: Record<string, number> = {}
    const improve: Record<string, number> = {}
    for (const e of entries) {
      for (const t of e.workedWell) worked[t] = (worked[t] ?? 0) + 1
      for (const t of e.needsImprovement) improve[t] = (improve[t] ?? 0) + 1
    }
    const allTools = new Set([...Object.keys(worked), ...Object.keys(improve)])
    return [...allTools].map(tool => ({
      tool,
      worked: worked[tool] ?? 0,
      improve: improve[tool] ?? 0,
    })).sort((a, b) => (b.worked + b.improve) - (a.worked + a.improve))
  }, [entries])

  // Satisfaction trend (group by date)
  const satisfactionTrend = useMemo(() => {
    const byDate: Record<string, number[]> = {}
    for (const e of entries) {
      if (e.satisfaction === null) continue
      const date = e.timestamp.slice(0, 10)
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(e.satisfaction)
    }
    return Object.entries(byDate)
      .map(([date, scores]) => ({
        date,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14) // last 14 days
  }, [entries])

  // Bug reports
  const bugReports = useMemo(
    () => entries.filter(e => e.bugReport.trim().length > 0).reverse(),
    [entries],
  )

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lingua-feedback-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs: { id: DashTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '\uD83D\uDCCA' },
    { id: 'tools', label: 'Tools', icon: '\uD83D\uDD27' },
    { id: 'feedback', label: 'Recent', icon: '\uD83D\uDCDD' },
    { id: 'bugs', label: 'Bugs', icon: '\uD83D\uDC1B' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Feedback Dashboard
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {entries.length} total responses
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors border"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-primary-main)',
            borderColor: 'var(--color-primary-light)',
          }}
        >
          Export JSON
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-surface-alt, var(--color-bg))' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all border-none"
            style={{
              background: tab === t.id ? 'var(--color-surface)' : 'transparent',
              color: tab === t.id ? 'var(--color-primary-main)' : 'var(--color-text-muted)',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">{'\uD83D\uDCED'}</div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            No feedback yet
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Feedback will appear here once users start submitting
          </p>
        </div>
      )}

      {/* Overview Tab */}
      {tab === 'overview' && entries.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <OverviewCard
              label="Total Feedback"
              value={String(entries.length)}
              icon="\uD83D\uDCE8"
            />
            <OverviewCard
              label="Avg Satisfaction"
              value={avgSatisfaction !== null ? `${avgSatisfaction.toFixed(1)}/5` : 'N/A'}
              icon={avgSatisfaction !== null ? SATISFACTION_EMOJIS[Math.round(avgSatisfaction) - 1] ?? '\uD83D\uDE10' : '\u2014'}
              accent={avgSatisfaction !== null && avgSatisfaction >= 4}
            />
            <OverviewCard
              label="NPS Score"
              value={nps !== null ? `${nps > 0 ? '+' : ''}${nps}` : 'N/A'}
              icon="\uD83D\uDCC8"
              accent={nps !== null && nps > 0}
            />
            <OverviewCard
              label="Avg Difficulty"
              value={
                difficultyBreakdown['just-right'] >= difficultyBreakdown['too-hard'] &&
                difficultyBreakdown['just-right'] >= difficultyBreakdown['too-easy']
                  ? 'Just Right'
                  : difficultyBreakdown['too-hard'] > difficultyBreakdown['too-easy']
                    ? 'Too Hard'
                    : 'Too Easy'
              }
              icon="\uD83C\uDFAF"
            />
          </div>

          {/* Satisfaction Trend */}
          {satisfactionTrend.length > 1 && (
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Satisfaction Trend
              </h3>
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {satisfactionTrend.map((day, i) => {
                  const pct = (day.avg / 5) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        {day.avg.toFixed(1)}
                      </span>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${pct}%`,
                          minHeight: 4,
                          background: day.avg >= 4 ? 'var(--color-correct)' : day.avg >= 3 ? 'var(--color-primary-main)' : 'var(--color-accent-dark, var(--color-accent-main))',
                          opacity: 0.8,
                        }}
                      />
                      <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                        {day.date.slice(5)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Difficulty Breakdown */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Difficulty Distribution
            </h3>
            <div className="space-y-2">
              {(['too-easy', 'just-right', 'too-hard'] as const).map(key => {
                const total = Object.values(difficultyBreakdown).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? (difficultyBreakdown[key] / total) * 100 : 0
                const labels = { 'too-easy': 'Too Easy', 'just-right': 'Just Right', 'too-hard': 'Too Hard' }
                const colors = {
                  'too-easy': 'var(--color-primary-light)',
                  'just-right': 'var(--color-correct)',
                  'too-hard': 'var(--color-accent-dark, var(--color-accent-main))',
                }
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--color-text-secondary)' }}>{labels[key]}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{difficultyBreakdown[key]} ({Math.round(pct)}%)</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--color-border)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: colors[key] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tools Tab */}
      {tab === 'tools' && entries.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Tool Ratings: Worked Well vs Needs Improvement
            </h3>
            <div className="space-y-3">
              {toolAnalysis.map(item => {
                const maxCount = Math.max(...toolAnalysis.map(t => Math.max(t.worked, t.improve)), 1)
                return (
                  <div key={item.tool}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{item.tool}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        +{item.worked} / -{item.improve}
                      </span>
                    </div>
                    <div className="flex gap-1 h-3">
                      <div
                        className="rounded-l-full"
                        style={{
                          width: `${(item.worked / maxCount) * 50}%`,
                          minWidth: item.worked > 0 ? 4 : 0,
                          background: 'var(--color-correct)',
                          opacity: 0.8,
                        }}
                      />
                      <div
                        className="rounded-r-full"
                        style={{
                          width: `${(item.improve / maxCount) * 50}%`,
                          minWidth: item.improve > 0 ? 4 : 0,
                          background: 'var(--color-accent-dark, var(--color-accent-main))',
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--color-correct)' }} />
                Worked Well
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-dark, var(--color-accent-main))' }} />
                Needs Improvement
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Feedback Tab */}
      {tab === 'feedback' && entries.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div
              className="divide-y"
              style={{ borderColor: 'var(--color-border)', maxHeight: 500, overflowY: 'auto' }}
            >
              {[...entries].reverse().map(entry => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {entry.satisfaction !== null && (
                        <span className="text-lg">{SATISFACTION_EMOJIS[entry.satisfaction - 1]}</span>
                      )}
                      {entry.difficulty && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: entry.difficulty === 'just-right' ? 'var(--color-correct)' : 'var(--color-accent-faded)',
                            color: entry.difficulty === 'just-right' ? '#fff' : 'var(--color-accent-dark)',
                          }}
                        >
                          {entry.difficulty === 'too-easy' ? 'Easy' : entry.difficulty === 'just-right' ? 'Right' : 'Hard'}
                        </span>
                      )}
                      {entry.npsScore !== null && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                          NPS: {entry.npsScore}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>
                  {entry.workedWell.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.workedWell.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-correct)', color: '#fff', opacity: 0.8 }}>{t}</span>
                      ))}
                    </div>
                  )}
                  {entry.needsImprovement.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.needsImprovement.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-accent-faded)', color: 'var(--color-accent-dark)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                  {entry.bugReport && (
                    <p className="text-xs mt-1.5 italic" style={{ color: 'var(--color-text-secondary)' }}>
                      "{entry.bugReport}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Bugs Tab */}
      {tab === 'bugs' && entries.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {bugReports.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">{'\u2705'}</div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No bug reports yet</p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div
                className="divide-y"
                style={{ borderColor: 'var(--color-border)', maxHeight: 500, overflowY: 'auto' }}
              >
                {bugReports.map(entry => (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {entry.userId.slice(0, 8)}...
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {entry.bugReport}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      <span>Platform: {entry.metadata.platform}</span>
                      <span>|</span>
                      <span>Streak: {entry.metadata.streak}</span>
                      <span>|</span>
                      <span>Words: {entry.metadata.wordsLearned}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OverviewCard({ label, value, icon, accent }: {
  label: string; value: string; icon: string; accent?: boolean
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      </div>
      <p
        className="text-xl font-bold"
        style={{ color: accent ? 'var(--color-correct)' : 'var(--color-text-primary)' }}
      >
        {value}
      </p>
    </div>
  )
}
