import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { TeacherClass, Assignment, AssignmentProgress } from '@/services/vocabApi'
import type { VocabList } from '@/types/word'

// --- Assignment Types ---

type AssignmentType = 'vocabulary' | 'quiz' | 'reading' | 'writing'

const ASSIGNMENT_TYPES: Array<{ id: AssignmentType; label: string; icon: string; description: string }> = [
  { id: 'vocabulary', label: 'Vocabulary Review', icon: '\u{1F4DA}', description: 'Flashcard-based review of word list' },
  { id: 'quiz', label: 'Quiz', icon: '\u{1F4DD}', description: 'Timed assessment with scored results' },
  { id: 'reading', label: 'Reading', icon: '\u{1F4D6}', description: 'Read a passage and answer questions' },
  { id: 'writing', label: 'Writing', icon: '\u270D\uFE0F', description: 'Free-form or prompted writing exercise' },
]

// --- Class List ---

function ClassList({ classes, onCreate, onSelect }: {
  classes: TeacherClass[]
  onCreate: () => void
  onSelect: (cls: TeacherClass) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--color-text-primary)]">Your Classes</h3>
        <button
          onClick={onCreate}
          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer bg-[var(--color-primary-main)] text-white"
        >
          + New Class
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <div className="text-4xl mb-3">{'\u{1F3EB}'}</div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">No classes yet</p>
          <p className="text-xs">Create a class and share the join code with your students.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => onSelect(cls)}
              className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left cursor-pointer hover:border-[var(--color-primary-main)] transition-colors w-full"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-[var(--color-text-primary)]">{cls.name}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{cls.student_count} student{cls.student_count !== 1 ? 's' : ''}</span>
              </div>
              {cls.description && (
                <p className="text-xs text-[var(--color-text-secondary)] mb-2">{cls.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span>{cls.language_from.toUpperCase()} → {cls.language_to.toUpperCase()}</span>
                <span>Code: <code className="font-mono bg-[var(--color-bg)] px-1.5 py-0.5 rounded text-[var(--color-primary-main)] font-bold">{cls.join_code}</code></span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Create Class Form ---

function CreateClassForm({ onCreated, onCancel }: {
  onCreated: (cls: TeacherClass) => void
  onCancel: () => void
}) {
  const { userId } = useApp()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [langFrom, setLangFrom] = useState('en')
  const [langTo, setLangTo] = useState('es')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const LANGS = [
    { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' },
    { code: 'de', label: 'German' }, { code: 'fr', label: 'French' },
    { code: 'ar', label: 'Arabic' }, { code: 'it', label: 'Italian' },
    { code: 'pt', label: 'Portuguese' }, { code: 'zh', label: 'Chinese' },
    { code: 'ja', label: 'Japanese' }, { code: 'ko', label: 'Korean' },
  ]

  const handleSubmit = async () => {
    if (!name.trim()) return
    if (langFrom === langTo) { setError('Native and target language must be different.'); return }
    setCreating(true)
    setError('')
    try {
      const cls = await api.createClass(userId, name.trim(), langFrom, langTo, description.trim() || undefined)
      onCreated(cls)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create class.')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-md">
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">Create New Class</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">Students will use a join code to enroll.</p>

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Class Name *</label>
      <input
        ref={nameRef}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Spanish 1 - Period 3"
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3"
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      />

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description (optional)</label>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="e.g. MWF 10:00-10:50, Room 204"
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3 resize-none"
        rows={2}
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Students speak</label>
          <select
            value={langFrom}
            onChange={e => setLangFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)]"
          >
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Learning</label>
          <select
            value={langTo}
            onChange={e => setLangTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)]"
          >
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg text-xs bg-red-100 text-red-700">{error}</div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-xs font-medium cursor-pointer text-[var(--color-text-secondary)]">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={!name.trim() || creating}
          className="px-4 py-2 rounded-lg bg-[var(--color-primary-main)] text-white text-xs font-medium cursor-pointer disabled:opacity-50">
          {creating ? 'Creating...' : 'Create Class'}
        </button>
      </div>
    </div>
  )
}

// --- Class Detail ---

type ClassTab = 'overview' | 'assignments' | 'analytics'

function ClassDetail({ cls, onBack }: {
  cls: TeacherClass
  onBack: () => void
}) {
  const { userId, lists } = useApp()
  const [students, setStudents] = useState<Array<{ id: string; name: string; enrolled_at: string }>>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [progress, setProgress] = useState<AssignmentProgress[]>([])
  const [classTab, setClassTab] = useState<ClassTab>('overview')
  const [codeCopied, setCodeCopied] = useState(false)

  useEffect(() => {
    api.getClassStudents(cls.id).then(setStudents).catch(() => {})
    api.getAssignments(cls.id).then(setAssignments).catch(() => {})
  }, [cls.id])

  const handleAssignmentCreated = (a: Assignment) => {
    setAssignments(prev => [a, ...prev])
    setShowCreateAssignment(false)
    setClassTab('assignments')
  }

  const handleViewProgress = async (a: Assignment) => {
    setSelectedAssignment(a)
    const p = await api.getAssignmentProgress(a.id)
    setProgress(p)
  }

  const copyJoinCode = () => {
    navigator.clipboard.writeText(cls.join_code).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }).catch(() => {})
  }

  if (selectedAssignment) {
    return (
      <AssignmentDetail
        assignment={selectedAssignment}
        progress={progress}
        students={students}
        onBack={() => setSelectedAssignment(null)}
      />
    )
  }

  if (showCreateAssignment) {
    return (
      <CreateAssignmentForm
        classId={cls.id}
        teacherId={userId}
        lists={lists}
        onCreated={handleAssignmentCreated}
        onCancel={() => setShowCreateAssignment(false)}
      />
    )
  }

  const CLASS_TABS: Array<{ id: ClassTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'assignments', label: `Assignments (${assignments.length})` },
    { id: 'analytics', label: 'Analytics' },
  ]

  return (
    <div>
      <button onClick={onBack} className="text-xs text-[var(--color-primary-main)] cursor-pointer mb-3 flex items-center gap-1">
        {'\u2190'} Back to Classes
      </button>

      {/* Class header with join code */}
      <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg text-[var(--color-text-primary)]">{cls.name}</h3>
          <span className="text-xs text-[var(--color-text-muted)]">{students.length} student{students.length !== 1 ? 's' : ''} enrolled</span>
        </div>
        {cls.description && (
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">{cls.description}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">Join code:</span>
          <code className="font-mono text-sm font-bold bg-[var(--color-bg)] px-2 py-1 rounded text-[var(--color-primary-main)] tracking-wider">
            {cls.join_code}
          </code>
          <button
            onClick={copyJoinCode}
            className="px-2 py-1 rounded text-xs cursor-pointer border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
          >
            {codeCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-[var(--color-bg)]">
        {CLASS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setClassTab(tab.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              classTab === tab.id
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {classTab === 'overview' && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
            Students ({students.length})
          </h4>
          {students.length === 0 ? (
            <div className="p-4 rounded-lg bg-[var(--color-bg)] text-center">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                No students yet. Share the join code above with your class.
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Students enter the code in their Lingua app under Teacher Portal {'\u2192'} Student {'\u2192'} Join a Class.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-bg)]">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2 text-[var(--color-text-primary)]">{s.name || s.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)] text-xs">{new Date(s.enrolled_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Assignments tab */}
      {classTab === 'assignments' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[var(--color-text-secondary)]">Assignments</h4>
            <button
              onClick={() => setShowCreateAssignment(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer bg-[var(--color-primary-main)] text-white"
            >
              + New Assignment
            </button>
          </div>

          {assignments.length === 0 ? (
            <div className="p-4 rounded-lg bg-[var(--color-bg)] text-center">
              <p className="text-xs text-[var(--color-text-muted)]">No assignments yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map(a => {
                const completionPct = a.total_students ? ((a.completed_count || 0) / a.total_students * 100) : 0
                const isOverdue = a.deadline && new Date(a.deadline) < new Date()
                const typeLabel = ASSIGNMENT_TYPES.find(t => t.id === (a.status || 'vocabulary'))?.icon || '\u{1F4DA}'

                return (
                  <button
                    key={a.id}
                    onClick={() => handleViewProgress(a)}
                    className="w-full p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left cursor-pointer hover:border-[var(--color-primary-main)] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-[var(--color-text-primary)] flex items-center gap-1.5">
                        <span>{typeLabel}</span>
                        {a.title}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isOverdue ? 'bg-red-100 text-red-700' : completionPct >= 100 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isOverdue ? 'Overdue' : completionPct >= 100 ? 'Complete' : 'Active'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      <span>{a.completed_count || 0}/{a.total_students || 0} completed</span>
                      {a.deadline && <span>Due: {new Date(a.deadline).toLocaleDateString()}</span>}
                      {a.avg_accuracy != null && <span>Avg: {Math.round(a.avg_accuracy)}%</span>}
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[var(--color-bg)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(completionPct, 100)}%`,
                          background: completionPct >= 80 ? '#10b981' : completionPct >= 40 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Analytics tab */}
      {classTab === 'analytics' && (
        <ClassAnalytics assignments={assignments} students={students} />
      )}
    </div>
  )
}

// --- Class Analytics ---

function ClassAnalytics({ assignments, students }: {
  assignments: Assignment[]
  students: Array<{ id: string; name: string; enrolled_at: string }>
}) {
  const [allProgress, setAllProgress] = useState<AssignmentProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch progress for all assignments
    Promise.all(assignments.map(a => api.getAssignmentProgress(a.id).catch(() => [] as AssignmentProgress[])))
      .then(results => {
        setAllProgress(results.flat())
        setLoading(false)
      })
  }, [assignments])

  if (loading) return <p className="text-sm text-[var(--color-text-muted)] py-4">Loading analytics...</p>

  // Compute class-wide stats
  const totalAssignments = assignments.length
  const completedTotal = allProgress.filter(p => p.completed).length
  const totalProgressEntries = allProgress.length
  const avgCompletionRate = totalProgressEntries > 0
    ? (completedTotal / totalProgressEntries * 100) : 0
  const avgClassAccuracy = allProgress.length > 0
    ? allProgress.reduce((s, p) => s + p.accuracy, 0) / allProgress.length : 0
  const avgTimeMinutes = allProgress.length > 0
    ? Math.round(allProgress.reduce((s, p) => s + p.time_spent_seconds, 0) / allProgress.length / 60) : 0

  // Most struggled words: lowest accuracy students
  const studentStats = new Map<string, { name: string; avgAcc: number; totalTime: number; completed: number; total: number }>()
  for (const p of allProgress) {
    const existing = studentStats.get(p.student_id)
    if (existing) {
      existing.avgAcc = (existing.avgAcc * existing.total + p.accuracy) / (existing.total + 1)
      existing.totalTime += p.time_spent_seconds
      existing.completed += p.completed ? 1 : 0
      existing.total += 1
    } else {
      studentStats.set(p.student_id, {
        name: p.student_name || p.student_id.slice(0, 8),
        avgAcc: p.accuracy,
        totalTime: p.time_spent_seconds,
        completed: p.completed ? 1 : 0,
        total: 1,
      })
    }
  }

  const studentRankings = Array.from(studentStats.entries())
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => a.avgAcc - b.avgAcc)

  // Students who have never appeared in any progress
  const studentsWithProgress = new Set(allProgress.map(p => p.student_id))
  const inactiveStudents = students.filter(s => !studentsWithProgress.has(s.id))

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Assignments" value={String(totalAssignments)} />
        <StatCard label="Avg Completion" value={`${Math.round(avgCompletionRate)}%`} color={avgCompletionRate >= 70 ? 'green' : avgCompletionRate >= 40 ? 'amber' : 'red'} />
        <StatCard label="Avg Accuracy" value={`${Math.round(avgClassAccuracy)}%`} color={avgClassAccuracy >= 70 ? 'green' : avgClassAccuracy >= 50 ? 'amber' : 'red'} />
        <StatCard label="Avg Time / Assignment" value={`${avgTimeMinutes}m`} />
      </div>

      {/* Inactive students alert */}
      {inactiveStudents.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs">
          <span className="font-semibold text-red-700">
            {inactiveStudents.length} student{inactiveStudents.length > 1 ? 's' : ''} with no activity:
          </span>
          <span className="text-red-600 ml-1">
            {inactiveStudents.map(s => s.name || s.id.slice(0, 8)).join(', ')}
          </span>
        </div>
      )}

      {/* Student performance ranking */}
      {studentRankings.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Student Performance</h4>
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)]">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Student</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]">Avg Accuracy</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]">Completed</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]">Total Time</th>
                </tr>
              </thead>
              <tbody>
                {studentRankings.map(s => (
                  <tr key={s.id} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">{s.name}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-medium ${s.avgAcc >= 80 ? 'text-green-600' : s.avgAcc >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {Math.round(s.avgAcc)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-[var(--color-text-secondary)]">{s.completed}/{s.total}</td>
                    <td className="px-3 py-2 text-center text-[var(--color-text-secondary)]">{Math.round(s.totalTime / 60)}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allProgress.length === 0 && (
        <div className="p-4 rounded-lg bg-[var(--color-bg)] text-center">
          <p className="text-xs text-[var(--color-text-muted)]">No student activity yet. Analytics will appear once students start working on assignments.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: 'green' | 'amber' | 'red' }) {
  const colorCls = color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : color === 'red' ? 'text-red-600' : 'text-[var(--color-text-primary)]'
  return (
    <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
      <div className={`text-lg font-bold ${colorCls}`}>{value}</div>
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
    </div>
  )
}

// --- Create Assignment Form ---

function CreateAssignmentForm({ classId, teacherId, lists, onCreated, onCancel }: {
  classId: number
  teacherId: string
  lists: VocabList[]
  onCreated: (a: Assignment) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('vocabulary')
  const [listId, setListId] = useState<number | null>(null)
  const [deadline, setDeadline] = useState('')
  const [minAccuracy, setMinAccuracy] = useState(70)
  const [minReviews, setMinReviews] = useState(3)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Default deadline to 7 days from now
  useEffect(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    setDeadline(d.toISOString().split('T')[0])
  }, [])

  const handleSubmit = async () => {
    if (!title.trim()) return
    if (assignmentType === 'vocabulary' && !listId) {
      setError('Please select a vocabulary list.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const a = await api.createAssignment({
        teacher_id: teacherId,
        class_id: classId,
        title: title.trim(),
        description: description.trim() || undefined,
        list_id: listId ?? undefined,
        criteria: { min_accuracy: minAccuracy, min_reviews: minReviews },
        deadline: deadline || undefined,
        status: assignmentType,
      })
      onCreated(a)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create assignment.')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-lg">
      <button onClick={onCancel} className="text-xs text-[var(--color-primary-main)] cursor-pointer mb-3">{'\u2190'} Back</button>
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">New Assignment</h3>

      {/* Assignment type selector */}
      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">Assignment Type</label>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {ASSIGNMENT_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setAssignmentType(t.id)}
            className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
              assignmentType === t.id
                ? 'border-[var(--color-primary-main)] bg-blue-50/50'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-main)]/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg">{t.icon}</span>
              <span className={`text-xs font-semibold ${assignmentType === t.id ? 'text-[var(--color-primary-main)]' : 'text-[var(--color-text-primary)]'}`}>
                {t.label}
              </span>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]">{t.description}</p>
          </button>
        ))}
      </div>

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Title *</label>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Chapter 5 - Food Vocabulary"
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3"
      />

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Instructions (optional)</label>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Additional instructions for students..."
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3 resize-none"
        rows={2}
      />

      {/* Vocabulary list selector (shown for vocab and quiz types) */}
      {(assignmentType === 'vocabulary' || assignmentType === 'quiz') && (
        <>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Vocabulary List *</label>
          <select
            value={listId ?? ''}
            onChange={e => setListId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3"
          >
            <option value="">Select a list...</option>
            {lists.map(l => (
              <option key={l.id} value={l.id}>{l.name} ({l.word_count} words)</option>
            ))}
          </select>
        </>
      )}

      {/* Due date */}
      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Due Date</label>
      <input
        type="date"
        value={deadline}
        onChange={e => setDeadline(e.target.value)}
        min={new Date().toISOString().split('T')[0]}
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3"
      />

      {/* Completion criteria */}
      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">Completion Criteria</label>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Minimum Score (%)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              value={minAccuracy}
              onChange={e => setMinAccuracy(Number(e.target.value))}
              min={0} max={100} step={5}
              className="flex-1"
            />
            <span className="text-sm font-medium text-[var(--color-text-primary)] w-10 text-right">{minAccuracy}%</span>
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Min Reviews / Word</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              value={minReviews}
              onChange={e => setMinReviews(Number(e.target.value))}
              min={1} max={10}
              className="flex-1"
            />
            <span className="text-sm font-medium text-[var(--color-text-primary)] w-6 text-right">{minReviews}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg text-xs bg-red-100 text-red-700">{error}</div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-xs font-medium cursor-pointer text-[var(--color-text-secondary)]">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={!title.trim() || creating}
          className="px-4 py-2 rounded-lg bg-[var(--color-primary-main)] text-white text-xs font-medium cursor-pointer disabled:opacity-50">
          {creating ? 'Creating...' : 'Create Assignment'}
        </button>
      </div>
    </div>
  )
}

// --- Student Status helpers ---

type StudentStatus = 'green' | 'yellow' | 'red'

function getStudentStatus(p: AssignmentProgress, assignment: Assignment): StudentStatus {
  const minAcc = assignment.criteria.min_accuracy || 70
  if (p.completed && p.accuracy >= minAcc) return 'green'
  if (p.words_reviewed > 0) return 'yellow'
  return 'red'
}

const STATUS_CONFIG: Record<StudentStatus, { bg: string; text: string; dot: string; label: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', dot: '#10b981', label: 'Met requirements' },
  yellow: { bg: 'bg-amber-50', text: 'text-amber-700', dot: '#f59e0b', label: 'In progress' },
  red: { bg: 'bg-red-50', text: 'text-red-700', dot: '#ef4444', label: 'Not started' },
}

// --- Assignment Detail (Student Progress) ---

function AssignmentDetail({ assignment, progress, students, onBack }: {
  assignment: Assignment
  progress: AssignmentProgress[]
  students: Array<{ id: string; name: string; enrolled_at: string }>
  onBack: () => void
}) {
  const [sortBy, setSortBy] = useState<'status' | 'accuracy' | 'name'>('status')
  const [showPrintQuiz, setShowPrintQuiz] = useState(false)

  // Include students with no progress as red
  const studentsWithProgress = new Set(progress.map(p => p.student_id))
  const missingStudents: AssignmentProgress[] = students
    .filter(s => !studentsWithProgress.has(s.id))
    .map(s => ({
      id: 0,
      assignment_id: assignment.id,
      student_id: s.id,
      student_name: s.name,
      words_reviewed: 0,
      words_mastered: 0,
      accuracy: 0,
      time_spent_seconds: 0,
      completed: 0,
      last_activity: null,
    }))

  const allProgress = [...progress, ...missingStudents]

  const completedCount = allProgress.filter(p => p.completed).length
  const avgAccuracy = allProgress.length > 0
    ? allProgress.filter(p => p.words_reviewed > 0).reduce((sum, p) => sum + p.accuracy, 0) / Math.max(allProgress.filter(p => p.words_reviewed > 0).length, 1)
    : 0

  // Categorize students
  const statusCounts = { green: 0, yellow: 0, red: 0 }
  const statusMap = new Map<string, StudentStatus>()
  allProgress.forEach(p => {
    const status = getStudentStatus(p, assignment)
    statusCounts[status]++
    statusMap.set(p.student_id, status)
  })

  // Sort students
  const sortedProgress = [...allProgress].sort((a, b) => {
    if (sortBy === 'status') {
      const order: Record<StudentStatus, number> = { red: 0, yellow: 1, green: 2 }
      const diff = order[statusMap.get(a.student_id)!] - order[statusMap.get(b.student_id)!]
      return diff !== 0 ? diff : a.accuracy - b.accuracy
    }
    if (sortBy === 'accuracy') return a.accuracy - b.accuracy
    return (a.student_name || a.student_id).localeCompare(b.student_name || b.student_id)
  })

  // Days since last activity for at-risk detection
  const inactiveStudents = allProgress.filter(p => {
    if (p.completed) return false
    if (!p.last_activity) return true
    const daysSince = (Date.now() - new Date(p.last_activity).getTime()) / 86400000
    return daysSince > 3
  })

  if (showPrintQuiz) {
    return <PrintableQuiz assignment={assignment} onBack={() => setShowPrintQuiz(false)} />
  }

  return (
    <div>
      <button onClick={onBack} className="text-xs text-[var(--color-primary-main)] cursor-pointer mb-3">{'\u2190'} Back</button>

      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-lg text-[var(--color-text-primary)]">{assignment.title}</h3>
        <button
          onClick={() => setShowPrintQuiz(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
        >
          {'\u{1F5A8}\uFE0F'} Print Quiz
        </button>
      </div>
      {assignment.description && (
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">{assignment.description}</p>
      )}

      {/* Traffic light overview */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['red', 'yellow', 'green'] as const).map(status => (
          <div
            key={status}
            className={`p-4 rounded-xl border-2 text-center ${
              status === 'green' ? 'border-green-200 bg-green-50' :
              status === 'yellow' ? 'border-amber-200 bg-amber-50' :
              'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ background: STATUS_CONFIG[status].dot }} />
              <span className={`text-2xl font-bold ${STATUS_CONFIG[status].text}`}>{statusCounts[status]}</span>
            </div>
            <div className={`text-xs font-medium ${STATUS_CONFIG[status].text}`}>
              {STATUS_CONFIG[status].label}
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Completed" value={`${completedCount}/${allProgress.length}`} />
        <StatCard label="Avg Accuracy" value={`${Math.round(avgAccuracy)}%`} color={avgAccuracy >= 70 ? 'green' : avgAccuracy >= 50 ? 'amber' : 'red'} />
        <StatCard label="Deadline" value={assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : '\u2014'} />
      </div>

      {/* At-risk alert */}
      {inactiveStudents.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs">
          <span className="font-semibold text-red-700">
            {inactiveStudents.length} student{inactiveStudents.length > 1 ? 's' : ''} inactive for 3+ days:
          </span>
          <span className="text-red-600 ml-1">
            {inactiveStudents.map(s => s.student_name || s.student_id.slice(0, 8)).join(', ')}
          </span>
        </div>
      )}

      {/* Criteria */}
      {(assignment.criteria.min_accuracy || assignment.criteria.min_reviews) && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg)] text-xs text-[var(--color-text-secondary)]">
          <span className="font-semibold">Completion criteria:</span>
          {assignment.criteria.min_accuracy && <span> {assignment.criteria.min_accuracy}% accuracy</span>}
          {assignment.criteria.min_reviews && <span> · {assignment.criteria.min_reviews} reviews/word</span>}
        </div>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-[var(--color-text-muted)]">Sort by:</span>
        {(['status', 'accuracy', 'name'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-2 py-1 rounded text-xs cursor-pointer ${
              sortBy === s
                ? 'bg-[var(--color-primary-main)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
            }`}
          >
            {s === 'status' ? 'Needs attention first' : s === 'accuracy' ? 'Lowest accuracy' : 'Name'}
          </button>
        ))}
      </div>

      {/* Student table */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg)]">
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Student</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]">Reviewed</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]">Mastered</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]">Accuracy</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]">Time</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedProgress.map(p => {
              const status = statusMap.get(p.student_id)!
              const cfg = STATUS_CONFIG[status]
              const minutes = Math.round(p.time_spent_seconds / 60)

              return (
                <tr key={p.student_id} className={`border-t border-[var(--color-border)] ${status === 'red' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
                      <span className="text-[var(--color-text-primary)]">
                        {p.student_name || p.student_id.slice(0, 8)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-[var(--color-text-secondary)]">{p.words_reviewed}</td>
                  <td className="px-3 py-2 text-center text-[var(--color-text-secondary)]">{p.words_mastered}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`font-medium ${p.accuracy >= 80 ? 'text-green-600' : p.accuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {p.words_reviewed > 0 ? `${Math.round(p.accuracy)}%` : '\u2014'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[var(--color-text-secondary)]">{minutes > 0 ? `${minutes}m` : '\u2014'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Printable Quiz ---

function PrintableQuiz({ assignment, onBack }: {
  assignment: Assignment
  onBack: () => void
}) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${assignment.title} - Quiz</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #111; max-width: 700px; margin: 0 auto; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
          .student-line { display: flex; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
          .student-line label { font-size: 13px; color: #666; }
          .student-line span { font-size: 13px; border-bottom: 1px solid #333; min-width: 200px; display: inline-block; }
          .question { margin-bottom: 16px; page-break-inside: avoid; }
          .question-num { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
          .answer-line { border-bottom: 1px solid #ccc; height: 28px; margin-left: 24px; }
          .criteria { background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; color: #555; }
          .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
          @media print { body { padding: 20px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const today = new Date().toLocaleDateString()
  const questionCount = assignment.list_id ? 20 : 10

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-xs text-[var(--color-primary-main)] cursor-pointer">{'\u2190'} Back</button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 rounded-lg bg-[var(--color-primary-main)] text-white text-xs font-medium cursor-pointer"
        >
          {'\u{1F5A8}\uFE0F'} Print / Save PDF
        </button>
      </div>

      <div ref={printRef}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{assignment.title}</h1>
        <div className="subtitle" style={{ color: '#666', fontSize: '13px', marginBottom: '24px' }}>
          {assignment.description || 'Vocabulary Quiz'} — {today}
        </div>

        <div className="student-line" style={{ display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
          <span style={{ fontSize: '13px' }}>Name: ______________________________</span>
          <span style={{ fontSize: '13px' }}>Period: ________</span>
          <span style={{ fontSize: '13px' }}>Score: ______ / {questionCount}</span>
        </div>

        {assignment.criteria.min_accuracy && (
          <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: '#555' }}>
            Passing score: {assignment.criteria.min_accuracy}%
            {assignment.criteria.min_reviews ? ` | Minimum ${assignment.criteria.min_reviews} reviews per word required` : ''}
          </div>
        )}

        <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
          Part A: Write the translation (1 point each)
        </div>
        {Array.from({ length: Math.ceil(questionCount / 2) }, (_, i) => (
          <div key={`a-${i}`} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{i + 1}. ______________________________</div>
            <div style={{ borderBottom: '1px solid #ccc', height: '28px', marginLeft: '24px' }} />
          </div>
        ))}

        <div style={{ marginBottom: '12px', marginTop: '24px', fontSize: '14px', fontWeight: 600 }}>
          Part B: Fill in the blank (1 point each)
        </div>
        {Array.from({ length: Math.floor(questionCount / 2) }, (_, i) => (
          <div key={`b-${i}`} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{i + Math.ceil(questionCount / 2) + 1}. ______________________________</div>
            <div style={{ borderBottom: '1px solid #ccc', height: '28px', marginLeft: '24px' }} />
          </div>
        ))}

        <div style={{ marginTop: '40px', textAlign: 'center', color: '#999', fontSize: '11px' }}>
          Generated by Lingua — {today}
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---

export function TeacherPortal() {
  const { userId, hubAvailable } = useApp()
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null)
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isTeacher, setIsTeacher] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joinMessage, setJoinMessage] = useState('')

  useEffect(() => {
    if (!hubAvailable) { setLoading(false); return }
    api.getClasses(userId).then(c => {
      setClasses(c)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId, hubAvailable])

  const handleClassCreated = useCallback((cls: TeacherClass) => {
    setClasses(prev => [cls, ...prev])
    setShowCreateClass(false)
  }, [])

  const handleJoinClass = async () => {
    if (!joinCode.trim()) return
    try {
      const cls = await api.joinClass(userId, joinCode.trim().toUpperCase())
      setJoinMessage(`Joined "${cls.name}" successfully!`)
      setJoinCode('')
    } catch {
      setJoinMessage('Invalid join code. Check the code and try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-primary-main)] border-t-transparent animate-spin" />
        <p className="text-sm text-[var(--color-text-muted)]">Loading Teacher Portal...</p>
      </div>
    )
  }

  if (!hubAvailable) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">{'\u{1F3EB}'}</div>
        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Backend Required</p>
        <p className="text-xs text-[var(--color-text-muted)]">The Teacher Portal requires the Creative Hub backend to be running.</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Check Settings for backend configuration.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <span className="text-2xl">{'\u{1F3EB}'}</span> Teacher Portal
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Manage classes, assign vocabulary, track student progress
          </p>
        </div>
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          <button
            onClick={() => setIsTeacher(true)}
            className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
              isTeacher ? 'bg-[var(--color-primary-main)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
            }`}
          >
            Teacher
          </button>
          <button
            onClick={() => setIsTeacher(false)}
            className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
              !isTeacher ? 'bg-[var(--color-primary-main)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
            }`}
          >
            Student
          </button>
        </div>
      </div>

      {/* Student view: join class */}
      {!isTeacher && (
        <div className="mb-6">
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Join a Class</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">Enter the code your teacher gave you.</p>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] font-mono tracking-wider uppercase"
                onKeyDown={e => e.key === 'Enter' && handleJoinClass()}
                maxLength={10}
              />
              <button onClick={handleJoinClass}
                className="px-4 py-2 rounded-lg bg-[var(--color-primary-main)] text-white text-xs font-medium cursor-pointer disabled:opacity-50"
                disabled={!joinCode.trim()}
              >
                Join
              </button>
            </div>
            {joinMessage && (
              <p className={`text-xs mt-2 ${joinMessage.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                {joinMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Teacher view */}
      {isTeacher && (
        <>
          {showCreateClass ? (
            <CreateClassForm
              onCreated={handleClassCreated}
              onCancel={() => setShowCreateClass(false)}
            />
          ) : selectedClass ? (
            <ClassDetail cls={selectedClass} onBack={() => setSelectedClass(null)} />
          ) : (
            <ClassList
              classes={classes}
              onCreate={() => setShowCreateClass(true)}
              onSelect={setSelectedClass}
            />
          )}
        </>
      )}
    </div>
  )
}
