import { useState, useEffect, useMemo } from 'react'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { LeaderboardEntry, SharedList } from '@/services/vocabApi'

type Tab = 'leaderboard' | 'shared' | 'achievements' | 'friends'

// --- Leaderboard ---

function Leaderboard({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'all'>('week')

  useEffect(() => {
    setLoading(true)
    const weekParam = period === 'week' ? undefined : 'all'
    api.getLeaderboard(weekParam).then(e => {
      setEntries(e)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [period])

  if (loading) return <p className="text-sm text-[var(--color-text-muted)] py-4">Loading leaderboard...</p>

  // Find current user's rank
  const myRank = entries.findIndex(e => e.user_id === userId)
  const myEntry = myRank >= 0 ? entries[myRank] : null

  return (
    <div>
      {/* Period toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--color-bg)]">
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
              period === 'week' ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)]'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
              period === 'all' ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)]'
            }`}
          >
            All Time
          </button>
        </div>
        {myEntry && (
          <span className="text-xs text-[var(--color-text-muted)]">
            Your rank: <span className="font-bold text-[var(--color-primary-main)]">#{myRank + 1}</span>
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">{'\u{1F3C6}'}</div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">No leaderboard data yet{period === 'week' ? ' this week' : ''}.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Complete reviews to appear on the leaderboard!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const isMe = entry.user_id === userId
            const medal = i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : i === 2 ? '\u{1F949}' : ''

            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isMe
                    ? 'border-[var(--color-primary-main)] bg-blue-50/50 ring-1 ring-[var(--color-primary-main)]/20'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                }`}
              >
                <div className="w-8 text-center">
                  {medal ? (
                    <span className="text-lg">{medal}</span>
                  ) : (
                    <span className="text-sm font-bold text-[var(--color-text-muted)]">#{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold truncate ${isMe ? 'text-[var(--color-primary-main)]' : 'text-[var(--color-text-primary)]'}`}>
                      {entry.user_name || 'Anonymous'}
                    </span>
                    {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary-main)] text-white font-bold flex-shrink-0">You</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-0.5">
                    <span>{entry.words_learned} words</span>
                    <span>{entry.streak_days}d streak</span>
                    <span>{Math.round(entry.accuracy)}% acc</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-[var(--color-accent-main)]">{entry.xp_earned.toLocaleString()}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">XP</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Shared Lists ---

function SharedLists({ userId }: { userId: string }) {
  const { refreshLists } = useApp()
  const [lists, setLists] = useState<SharedList[]>([])
  const [loading, setLoading] = useState(true)
  const [cloning, setCloning] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'downloads'>('recent')

  useEffect(() => {
    api.getSharedLists(50).then(l => {
      setLists(l)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleClone = async (list: SharedList) => {
    setCloning(list.id)
    try {
      await api.cloneSharedList(list.share_code, userId)
      setMessage(`Added "${list.title || 'List'}" to your word bank!`)
      refreshLists()
      setLists(prev => prev.map(l => l.id === list.id ? { ...l, downloads: l.downloads + 1 } : l))
    } catch {
      setMessage('Failed to add list. It may already be in your word bank.')
    }
    setCloning(null)
    setTimeout(() => setMessage(''), 3000)
  }

  const filteredLists = useMemo(() => {
    let filtered = lists
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(l =>
        (l.title || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q) ||
        (l.author_name || '').toLowerCase().includes(q) ||
        l.language_to.toLowerCase().includes(q)
      )
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === 'popular') return b.likes - a.likes
      if (sortBy === 'downloads') return b.downloads - a.downloads
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [lists, search, sortBy])

  if (loading) return <p className="text-sm text-[var(--color-text-muted)] py-4">Loading shared lists...</p>

  return (
    <div>
      {/* Search and sort bar */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lists by title, author, or language..."
            className="w-full px-3 py-2 pl-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)]"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-secondary)]"
        >
          <option value="recent">Newest</option>
          <option value="popular">Most liked</option>
          <option value="downloads">Most downloaded</option>
        </select>
      </div>

      {message && (
        <div className={`mb-3 p-2 rounded-lg text-xs ${message.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {lists.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">{'\u{1F4CB}'}</div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">No shared lists yet.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Share your word lists from the Word Bank to see them here!</p>
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--color-text-muted)]">No lists match your search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLists.map(list => (
            <div key={list.id} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-main)]/50 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-[var(--color-text-primary)]">{list.title || `List #${list.list_id}`}</span>
                <button
                  onClick={() => handleClone(list)}
                  disabled={cloning === list.id}
                  className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer bg-[var(--color-primary-main)] text-white disabled:opacity-50"
                >
                  {cloning === list.id ? 'Adding...' : '+ Add to My Lists'}
                </button>
              </div>
              {list.description && (
                <p className="text-xs text-[var(--color-text-secondary)] mb-2">{list.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span>by {list.author_name || 'Anonymous'}</span>
                <span>{list.word_count} words</span>
                <span>{list.language_from.toUpperCase()} {'\u2192'} {list.language_to.toUpperCase()}</span>
                <span>{list.downloads} {'\u2B07\uFE0F'}</span>
                {list.likes > 0 && <span>{list.likes} {'\u2764\uFE0F'}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Achievements Summary ---

const ACHIEVEMENT_BADGES: Array<{ id: string; icon: string; title: string; requirement: string }> = [
  { id: 'first_steps', icon: '\u{1F463}', title: 'First Steps', requirement: 'Review 1 word' },
  { id: 'word_collector', icon: '\u{1F4D6}', title: 'Word Collector', requirement: '50 words' },
  { id: 'vocabulary_master', icon: '\u{1F393}', title: 'Vocabulary Master', requirement: '200 words' },
  { id: 'polyglot', icon: '\u{1F30D}', title: 'Polyglot', requirement: '500 words' },
  { id: 'consistent', icon: '\u{1F4C5}', title: 'Consistent', requirement: '3-day streak' },
  { id: 'dedicated', icon: '\u{1F4AA}', title: 'Dedicated', requirement: '7-day streak' },
  { id: 'committed', icon: '\u{1F3CB}\uFE0F', title: 'Committed', requirement: '30-day streak' },
  { id: 'unstoppable', icon: '\u26A1', title: 'Unstoppable', requirement: '100-day streak' },
  { id: 'quick_learner', icon: '\u{1F680}', title: 'Quick Learner', requirement: '10 sessions' },
  { id: 'study_machine', icon: '\u{1F916}', title: 'Study Machine', requirement: '50 sessions' },
  { id: 'sharpshooter', icon: '\u{1F3AF}', title: 'Sharpshooter', requirement: '90% accuracy' },
  { id: 'perfectionist', icon: '\u{1F48E}', title: 'Perfectionist', requirement: '95% accuracy' },
]

function AchievementsGrid() {
  const { totalReviewed, totalWords, daysUsed } = useApp()

  // Determine which are earned based on local context
  const earned = useMemo(() => {
    const set = new Set<string>()
    if (totalReviewed >= 1) set.add('first_steps')
    if (totalWords >= 50) set.add('word_collector')
    if (totalWords >= 200) set.add('vocabulary_master')
    if (totalWords >= 500) set.add('polyglot')
    if (daysUsed >= 3) set.add('consistent')
    if (daysUsed >= 7) set.add('dedicated')
    if (daysUsed >= 30) set.add('committed')
    if (daysUsed >= 100) set.add('unstoppable')
    if (totalReviewed >= 10) set.add('quick_learner')
    if (totalReviewed >= 50) set.add('study_machine')
    return set
  }, [totalReviewed, totalWords, daysUsed])

  const earnedCount = ACHIEVEMENT_BADGES.filter(a => earned.has(a.id)).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--color-text-muted)]">
          {earnedCount} of {ACHIEVEMENT_BADGES.length} unlocked
        </span>
        <div className="h-1.5 w-32 rounded-full bg-[var(--color-bg)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-accent-main)] transition-all"
            style={{ width: `${earnedCount / ACHIEVEMENT_BADGES.length * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {ACHIEVEMENT_BADGES.map(badge => {
          const isEarned = earned.has(badge.id)
          return (
            <div
              key={badge.id}
              className={`p-3 rounded-xl border text-center transition-all ${
                isEarned
                  ? 'border-[var(--color-accent-main)]/30 bg-yellow-50/50'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] opacity-40'
              }`}
              title={badge.requirement}
            >
              <div className={`text-2xl mb-1 ${isEarned ? '' : 'grayscale'}`}>{badge.icon}</div>
              <div className={`text-[10px] font-semibold ${isEarned ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                {badge.title}
              </div>
              <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{badge.requirement}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Friends List ---

function FriendsList({ userId }: { userId: string }) {
  const [friends, setFriends] = useState<Array<{ friend_id: string; friend_name: string; status: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getFriends(userId).then(f => {
      setFriends(f)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId])

  if (loading) return <p className="text-sm text-[var(--color-text-muted)] py-4">Loading friends...</p>

  return (
    <div>
      {friends.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">{'\u{1F465}'}</div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">No friends yet.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Friends can see each other's progress and compete on the leaderboard.</p>
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg)] inline-block">
            <p className="text-xs text-[var(--color-text-muted)]">
              Share your user ID to connect:
            </p>
            <code className="font-mono text-sm font-bold text-[var(--color-primary-main)] tracking-wider">{userId.slice(0, 8)}</code>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map(f => (
            <div key={f.friend_id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-main)]/10 flex items-center justify-center text-sm font-bold text-[var(--color-primary-main)]">
                {(f.friend_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{f.friend_name || f.friend_id.slice(0, 8)}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Connected</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main Component ---

export function Community() {
  const { userId } = useApp()
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard')

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'leaderboard', label: 'Leaderboard', icon: '\u{1F3C6}' },
    { id: 'shared', label: 'Shared Lists', icon: '\u{1F4CB}' },
    { id: 'achievements', label: 'Achievements', icon: '\u{1F3C5}' },
    { id: 'friends', label: 'Friends', icon: '\u{1F465}' },
  ]

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <span className="text-2xl">{'\u{1F30D}'}</span> Community
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Compete, share, and learn together
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-[var(--color-bg)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              activeTab === tab.id
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'leaderboard' && <Leaderboard userId={userId} />}
      {activeTab === 'shared' && <SharedLists userId={userId} />}
      {activeTab === 'achievements' && <AchievementsGrid />}
      {activeTab === 'friends' && <FriendsList userId={userId} />}
    </div>
  )
}
