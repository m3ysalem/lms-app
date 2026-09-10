import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMyAssignments, getMyProgressMap } from '../../lib/api'
import { Badge, statusTone, ProgressBar, Spinner, EmptyState } from '../../components/Ui'

export default function MyLearning() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState(null)
  const [progressMap, setProgressMap] = useState({})
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!profile?.id) return
    Promise.all([getMyAssignments(profile.id), getMyProgressMap(profile.id)]).then(([a, p]) => {
      setAssignments(a)
      setProgressMap(p)
    })
  }, [profile?.id])

  if (!assignments) return <Spinner />

  const filtered = assignments.filter((a) => filter === 'all' || a.status === filter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Learning</h1>
        <p className="text-muted mt-1">Everything assigned to you, in one place.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'assigned', 'in_progress', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium border ${filter === f ? 'bg-ink-800 text-white border-ink-800' : 'bg-white border-surface-border text-ink-700'}`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Courses assigned to you will show up in this list." />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const p = progressMap[a.course.id]
            const isOverdue = a.status !== 'completed' && a.due_date && new Date(a.due_date) < new Date()
            return (
              <Link to={`/courses/${a.course.id}`} key={a.id} className="card p-4 flex items-center gap-4 hover:border-teal transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink-800 truncate">{a.course.name}</p>
                    {a.is_mandatory && <Badge tone="warning">Mandatory</Badge>}
                    <Badge tone={isOverdue ? 'danger' : statusTone(a.status)}>{isOverdue ? 'overdue' : a.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted mt-1">{a.due_date ? `Due ${a.due_date}` : 'No due date'}</p>
                  <div className="mt-2 max-w-xs">
                    <ProgressBar percent={p?.progress_percent ?? 0} tone={isOverdue ? 'danger' : 'teal'} />
                  </div>
                </div>
                <span className="text-sm text-teal font-medium shrink-0">
                  {a.status === 'completed' ? 'Review' : 'Continue'} →
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
