import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMyAssignments, getMyProgressMap, getMyCertificates, getMyNotifications } from '../../lib/api'
import { Badge, statusTone, ProgressBar, Spinner, KpiCard, EmptyState } from '../../components/Ui'

export default function Dashboard() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState(null)
  const [progressMap, setProgressMap] = useState({})
  const [certificates, setCertificates] = useState([])
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    Promise.all([
      getMyAssignments(profile.id).catch(() => []),
      getMyProgressMap(profile.id).catch(() => ({})),
      getMyCertificates(profile.id).catch(() => []),
      getMyNotifications(profile.id).catch(() => []),
    ])
      .then(([a, p, c, n]) => {
        setAssignments(a || [])
        setProgressMap(p || {})
        setCertificates(c || [])
        setNotifications(n || [])
      })
      .catch((e) => setError(e.message))
  }, [profile?.id])

  if (error) return <div className="text-danger p-4">{error}</div>
  if (!assignments) return <Spinner />

  const inProgress = assignments.filter((a) => a?.status === 'in_progress' || a?.status === 'started' || a?.status === 'assigned')
  const completed = assignments.filter((a) => a?.status === 'completed')
  const overdue = assignments.filter((a) => a?.status !== 'completed' && a?.due_date && new Date(a.due_date) < new Date())
  const totalHours = Object.values(progressMap).reduce((sum, p) => sum + (p?.time_spent_seconds || 0), 0) / 3600

  const userName = profile?.name || profile?.full_name || 'User'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {userName.split(' ')[0]}</h1>
        <p className="text-muted mt-1">Here's where your training stands today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Assigned courses" value={assignments.length} />
        <KpiCard label="Completed" value={completed.length} />
        <KpiCard label="Overdue" value={overdue.length} tone={overdue.length ? 'danger' : 'default'} sub={overdue.length ? 'Needs attention' : undefined} />
        <KpiCard label="Training hours" value={totalHours.toFixed(1)} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-head font-semibold text-lg">Continue learning</h2>
          <Link to="/my-learning" className="text-sm text-teal hover:underline">View all</Link>
        </div>
        {inProgress.length === 0 ? (
          <EmptyState title="Nothing in progress" body="Start one of your assigned courses to see it here." action={<Link to="/courses" className="btn-primary inline-block">Browse courses</Link>} />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {inProgress.map((a) => {
              const courseId = a.course?.id || a.course_id
              const courseTitle = a.course?.name || a.course?.title || 'Untitled Course'
              const p = progressMap[courseId]
              const statusStr = a.status || 'assigned'

              return (
                <Link to={`/courses/${courseId}`} key={a.id} className="card p-4 block hover:border-teal transition-colors">
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-ink-800">{courseTitle}</p>
                    <Badge tone={statusTone(statusStr)}>{statusStr.replace('_', ' ')}</Badge>
                  </div>
                  <div className="mt-3">
                    <ProgressBar percent={p?.progress_percent ?? p?.progress ?? 0} />
                    <p className="text-xs text-muted mt-1">{p?.progress_percent ?? p?.progress ?? 0}% complete</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-head font-semibold text-lg mb-3">Upcoming deadlines</h2>
          <div className="card divide-y divide-surface-border">
            {assignments.filter((a) => a.status !== 'completed').slice(0, 5).map((a) => {
              const courseTitle = a.course?.name || a.course?.title || 'Untitled Course'
              const statusStr = a.status || 'assigned'

              return (
                <div key={a.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{courseTitle}</p>
                    <p className="text-xs text-muted">{a.due_date ? `Due ${a.due_date}` : 'No due date'}</p>
                  </div>
                  <Badge tone={statusTone(statusStr)}>{statusStr.replace('_', ' ')}</Badge>
                </div>
              )
            })}
            {(assignments.length === 0 || assignments.every((a) => a.status === 'completed')) && (
              <p className="p-4 text-sm text-muted">You're all caught up.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-head font-semibold text-lg mb-3">Recent notifications</h2>
          <div className="card divide-y divide-surface-border">
            {notifications.length === 0 && <p className="p-4 text-sm text-muted">No notifications yet.</p>}
            {notifications.map((n) => (
              <div key={n.id} className="p-3">
                <p className="text-sm font-medium">{n.title || n.message || 'Notification'}</p>
                <p className="text-xs text-muted mt-0.5">{n.body || n.message || ''}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {certificates.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-head font-semibold text-lg">Certificates</h2>
            <Link to="/certificates" className="text-sm text-teal hover:underline">View all</Link>
          </div>
          <div className="flex gap-3 flex-wrap">
            {certificates.slice(0, 3).map((c) => {
              const courseTitle = c.course?.name || c.course?.title || 'Course Certificate'
              const certCode = c.cert_number || c.certificate_code || 'N/A'

              return (
                <div key={c.id} className="card px-4 py-3">
                  <p className="text-sm font-medium">{courseTitle}</p>
                  <p className="text-xs text-muted">{certCode}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
