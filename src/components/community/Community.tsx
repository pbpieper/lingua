import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { LeaderboardEntry, SharedList } from '@/services/vocabApi'

type Tab = 'leaderboard' | 'shared' | 'friends'

// --- Leaderboard ---

function Leaderboard({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getLeaderboard().then(e => {
      setEntries(e)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-[var(--color-text-muted)] py-4">Loading leaderboard...</p>

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🏆</div>
        <p className="text-sm text-[var(--color-text-secondary)]">No leaderboard data yet this week.</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Complete reviews to appear on the leaderboard!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => {
        const isMe = entry.user_id === userId
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''

        return (
          <div
            key={entry.id}
            className={`flex items-center gap-3 p-3 rounded-xl border ${
              isMe ? 'border-[var(--color-primary-main)] bg-blue-50/50' : 'border-[var(--color-border)] bg-[var(--color-surface)]'
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
                <span className={`text-sm font-semibold ${isMe ? 'text-[var(--color-primary-main)]' : 'text-[var(--color-text-primary)]'}`}>
                  {entry.user_name || 'Anonymous'}
                </span>
                {isMe && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-primary-main)] text-white">You</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-0.5">
                <span>{entry.words_learned} words</span>
                <span>{entry.streak_days}d streak</span>
                <span>{Math.round(entry.accuracy)}% acc</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-[var(--color-accent-main)]">{entry.xp_earned}</div>
              <div className="text-xs text-[var(--color-text-muted)]">XP</div>
            </div>
          </div>
        )
      })}
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

  useEffect(() => {
    api.getSharedLists().then(l => {
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
      // Update download count locally
      setLists(prev => prev.map(l => l.id === list.id ? { ...l, downloads: l.downloads + 1 } : l))
    } catch {
      setMessage('Failed to clone list.')
    }
    setCloning(null)
  }

  if (loading) return <p className="text-sm text-[var(--color-text-muted)] py-4">Loading shared lists...</p>

  if (lists.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm text-[var(--color-text-secondary)]">No shared lists yet.</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Share your word lists from the Word Bank to see them here!</p>
      </div>
    )
  }

  return (
    <div>
      {message && (
        <div className={`mb-3 p-2 rounded-lg text-xs ${message.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}
      <div className="space-y-2">
        {lists.map(list => (
          <div key={list.id} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
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
              <span>{list.language_from.toUpperCase()} → {list.language_to.toUpperCase()}</span>
              <span>{list.downloads} downloads</span>
            </div>
          </div>
        ))}
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
          <div className="text-4xl mb-3">👥</div>
          <p className="text-sm text-[var(--color-text-secondary)]">No friends yet.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Friends will be able to see each other's progress and compete on the leaderboard.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-3 p-3 rounded-lg bg-[var(--color-bg)]">
            Share your user ID to connect: <code className="font-mono text-[var(--color-primary-main)]">{userId.slice(0, 8)}</code>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map(f => (
            <div key={f.friend_id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-main)]/10 flex items-center justify-center text-sm">
                {(f.friend_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{f.friend_name || f.friend_id.slice(0, 8)}</span>
              </div>
              <span className="text-xs text-green-600">Connected</span>
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
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { id: 'shared', label: 'Shared Lists', icon: '📋' },
    { id: 'friends', label: 'Friends', icon: '👥' },
  ]

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <span className="text-2xl">🌍</span> Community
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
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
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
      {activeTab === 'friends' && <FriendsList userId={userId} />}
    </div>
  )
}
