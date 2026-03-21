import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import * as api from '@/services/vocabApi'
import type { TeacherClass, Assignment, AssignmentProgress } from '@/services/vocabApi'
import type { VocabList } from '@/types/word'

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
          <div className="text-4xl mb-3">🏫</div>
          <p className="text-sm">No classes yet. Create one to get started.</p>
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
                <span className="text-xs text-[var(--color-text-muted)]">{cls.student_count} students</span>
              </div>
              {cls.description && (
                <p className="text-xs text-[var(--color-text-secondary)] mb-2">{cls.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span>{cls.language_from.toUpperCase()} → {cls.language_to.toUpperCase()}</span>
                <span>Code: <code className="font-mono bg-[var(--color-bg)] px-1 rounded">{cls.join_code}</code></span>
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
  const [langTo, setLangTo] = useState('de')
  const [creating, setCreating] = useState(false)

  const LANGS = [
    { code: 'en', label: 'English' }, { code: 'de', label: 'German' },
    { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
    { code: 'ar', label: 'Arabic' }, { code: 'it', label: 'Italian' },
    { code: 'pt', label: 'Portuguese' }, { code: 'zh', label: 'Chinese' },
    { code: 'ja', label: 'Japanese' }, { code: 'ko', label: 'Korean' },
  ]

  const handleSubmit = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const cls = await api.createClass(userId, name.trim(), langFrom, langTo, description.trim() || undefined)
      onCreated(cls)
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-md">
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">Create New Class</h3>

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Class Name</label>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. German 101 - Spring 2026"
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3"
      />

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description (optional)</label>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Course details..."
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3 resize-none"
        rows={2}
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Native Language</label>
          <select
            value={langFrom}
            onChange={e => setLangFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)]"
          >
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Target Language</label>
          <select
            value={langTo}
            onChange={e => setLangTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)]"
          >
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>

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

  useEffect(() => {
    api.getClassStudents(cls.id).then(setStudents).catch(() => {})
    api.getAssignments(cls.id).then(setAssignments).catch(() => {})
  }, [cls.id])

  const handleAssignmentCreated = (a: Assignment) => {
    setAssignments(prev => [a, ...prev])
    setShowCreateAssignment(false)
  }

  const handleViewProgress = async (a: Assignment) => {
    setSelectedAssignment(a)
    const p = await api.getAssignmentProgress(a.id)
    setProgress(p)
  }

  if (selectedAssignment) {
    return (
      <AssignmentDetail
        assignment={selectedAssignment}
        progress={progress}
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

  return (
    <div>
      <button onClick={onBack} className="text-xs text-[var(--color-primary-main)] cursor-pointer mb-3 flex items-center gap-1">
        ← Back to Classes
      </button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg text-[var(--color-text-primary)]">{cls.name}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Join code: <code className="font-mono bg-[var(--color-bg)] px-1.5 py-0.5 rounded text-[var(--color-primary-main)]">{cls.join_code}</code>
            — share with students
          </p>
        </div>
      </div>

      {/* Students */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
          Students ({students.length})
        </h4>
        {students.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] p-3 rounded-lg bg-[var(--color-bg)]">
            No students yet. Share the join code above.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {students.map(s => (
              <span key={s.id} className="px-3 py-1.5 rounded-full text-xs bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                {s.name || s.id.slice(0, 8)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Assignments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-[var(--color-text-secondary)]">Assignments</h4>
          <button
            onClick={() => setShowCreateAssignment(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer bg-[var(--color-primary-main)] text-white"
          >
            + New Assignment
          </button>
        </div>

        {assignments.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] p-3 rounded-lg bg-[var(--color-bg)]">
            No assignments yet.
          </p>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => {
              const completionPct = a.total_students ? ((a.completed_count || 0) / a.total_students * 100) : 0
              const isOverdue = a.deadline && new Date(a.deadline) < new Date()

              return (
                <button
                  key={a.id}
                  onClick={() => handleViewProgress(a)}
                  className="w-full p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left cursor-pointer hover:border-[var(--color-primary-main)] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-[var(--color-text-primary)]">{a.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {isOverdue ? 'Overdue' : a.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span>{a.completed_count || 0}/{a.total_students || 0} completed</span>
                    {a.deadline && <span>Due: {new Date(a.deadline).toLocaleDateString()}</span>}
                    {a.avg_accuracy != null && <span>Avg: {Math.round(a.avg_accuracy)}%</span>}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--color-bg)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${completionPct}%`,
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
  const [listId, setListId] = useState<number | null>(null)
  const [deadline, setDeadline] = useState('')
  const [minAccuracy, setMinAccuracy] = useState(70)
  const [minReviews, setMinReviews] = useState(3)
  const [creating, setCreating] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setCreating(true)
    try {
      const a = await api.createAssignment({
        teacher_id: teacherId,
        class_id: classId,
        title: title.trim(),
        description: description.trim() || undefined,
        list_id: listId ?? undefined,
        criteria: { min_accuracy: minAccuracy, min_reviews: minReviews },
        deadline: deadline || undefined,
      })
      onCreated(a)
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-md">
      <button onClick={onCancel} className="text-xs text-[var(--color-primary-main)] cursor-pointer mb-3">← Back</button>
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">New Assignment</h3>

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Title</label>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Chapter 5 Vocabulary"
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3"
      />

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description (optional)</label>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3 resize-none"
        rows={2}
      />

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Vocabulary List</label>
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

      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Deadline</label>
      <input
        type="date"
        value={deadline}
        onChange={e => setDeadline(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] mb-3"
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Min Accuracy (%)</label>
          <input
            type="number"
            value={minAccuracy}
            onChange={e => setMinAccuracy(Number(e.target.value))}
            min={0} max={100}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Min Reviews/Word</label>
          <input
            type="number"
            value={minReviews}
            onChange={e => setMinReviews(Number(e.target.value))}
            min={1} max={20}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)]"
          />
        </div>
      </div>

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
  green: { bg: 'bg-green-50', text: 'text-green-700', dot: '#10b981', label: 'On track' },
  yellow: { bg: 'bg-amber-50', text: 'text-amber-700', dot: '#f59e0b', label: 'In progress' },
  red: { bg: 'bg-red-50', text: 'text-red-700', dot: '#ef4444', label: 'Needs attention' },
}

// --- Assignment Detail (Student Progress) ---

function AssignmentDetail({ assignment, progress, onBack }: {
  assignment: Assignment
  progress: AssignmentProgress[]
  onBack: () => void
}) {
  const [sortBy, setSortBy] = useState<'status' | 'accuracy' | 'name'>('status')

  const completedCount = progress.filter(p => p.completed).length
  const avgAccuracy = progress.length > 0
    ? progress.reduce((sum, p) => sum + p.accuracy, 0) / progress.length
    : 0

  // Categorize students
  const statusCounts = { green: 0, yellow: 0, red: 0 }
  const statusMap = new Map<string, StudentStatus>()
  progress.forEach(p => {
    const status = getStudentStatus(p, assignment)
    statusCounts[status]++
    statusMap.set(p.student_id, status)
  })

  // Sort students
  const sortedProgress = [...progress].sort((a, b) => {
    if (sortBy === 'status') {
      const order: Record<StudentStatus, number> = { red: 0, yellow: 1, green: 2 }
      const diff = order[statusMap.get(a.student_id)!] - order[statusMap.get(b.student_id)!]
      return diff !== 0 ? diff : a.accuracy - b.accuracy
    }
    if (sortBy === 'accuracy') return a.accuracy - b.accuracy
    return (a.student_name || a.student_id).localeCompare(b.student_name || b.student_id)
  })

  // Days since last activity for at-risk detection
  const inactiveStudents = progress.filter(p => {
    if (p.completed) return false
    if (!p.last_activity) return true
    const daysSince = (Date.now() - new Date(p.last_activity).getTime()) / 86400000
    return daysSince > 3
  })

  return (
    <div>
      <button onClick={onBack} className="text-xs text-[var(--color-primary-main)] cursor-pointer mb-3">← Back</button>

      <h3 className="font-semibold text-lg text-[var(--color-text-primary)] mb-1">{assignment.title}</h3>
      {assignment.description && (
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">{assignment.description}</p>
      )}

      {/* Traffic light overview */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['green', 'yellow', 'red'] as const).map(status => (
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
        <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
          <div className="text-lg font-bold text-[var(--color-text-primary)]">{completedCount}/{progress.length}</div>
          <div className="text-xs text-[var(--color-text-muted)]">Completed</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
          <div className="text-lg font-bold text-[var(--color-text-primary)]">{Math.round(avgAccuracy)}%</div>
          <div className="text-xs text-[var(--color-text-muted)]">Avg Accuracy</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
          <div className="text-lg font-bold text-[var(--color-text-primary)]">
            {assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : '—'}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">Deadline</div>
        </div>
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
                <tr key={p.id} className={`border-t border-[var(--color-border)] ${status === 'red' ? 'bg-red-50/30' : ''}`}>
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
                      {Math.round(p.accuracy)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[var(--color-text-secondary)]">{minutes}m</td>
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

// --- Main Component ---

export function TeacherPortal() {
  const { userId, hubAvailable } = useApp()
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null)
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isTeacher, setIsTeacher] = useState(true) // Toggle between teacher/student view
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
      const cls = await api.joinClass(userId, joinCode.trim())
      setJoinMessage(`Joined "${cls.name}" successfully!`)
      setJoinCode('')
    } catch {
      setJoinMessage('Invalid join code.')
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <span className="text-2xl">🏫</span> Teacher Portal
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
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                placeholder="Enter join code..."
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)]"
              />
              <button onClick={handleJoinClass}
                className="px-4 py-2 rounded-lg bg-[var(--color-primary-main)] text-white text-xs font-medium cursor-pointer">
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
