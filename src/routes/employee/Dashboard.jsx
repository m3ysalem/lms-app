import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMyAssignments, getMyProgressMap, getMyCertificates, getMyNotifications } from '../../lib/api'
import { Badge, statusTone, ProgressBar, Spinner, KpiCard, EmptyState } from '../../components/Ui'

export default function Dashboard() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [progressMap, setProgressMap] = useState({})
  const [certificates, setCertificates] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (!profile?.id) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const [a, p, c, n] = await Promise.all([
          getMyAssignments(profile.id).catch(() => []),
          getMyProgressMap(profile.id).catch(() => ({})),
          getMyCertificates(profile.id).catch(() => []),
          getMyNotifications(profile.id).catch(() => []),
        ])

        if (isMounted) {
          setAssignments(a || [])
          setProgressMap(p || {})
          setCertificates(c || [])
          setNotifications(n || [])
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [profile?.id])

  // مؤقت أمان إجباري يمنع أي تعليق لأكثر من 1.5 ثانية
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner label="Loading dashboard..." />
      </div>
    )
  }

  const inProgress = assignments.filter((a) => a?.status === 'in_progress' || a?.status === 'started' || a?.status === 'assigned')
  const completed = assignments.filter((a) => a?.status === 'completed')
  const overdue = assignments.filter((a) => a?.status !== 'completed' && a?.due_date && new Date(a.due_date) < new Date())
  
  // حساب إجمالي ساعات التدريب بناءً على وقت التقدم المسجل أو مدة الكورسات المكتملة
  const rawSeconds = Object.values(progressMap).reduce((sum, p) => sum + (p?.time_spent_seconds || 0), 0)
  const completedCourseHours = completed.reduce((sum, a) => {
    const courseDuration = a.course?.duration || a.course?.duration_hours || 1
    return sum + (typeof courseDuration === 'number' ? courseDuration : parseFloat(courseDuration) || 1)
  }, 0)
  const totalHours = rawSeconds > 0 ? rawSeconds / 3600 : completedCourseHours

  // استخدام القيمة من عمود full_name مباشرة دون تكرار
  const displayName = profile?.full_name || 'User'

  return (
    <div className="space-y-8 text-white">
      <div>
        <h1 className="text-3xl font-black font-head tracking-wide text-white">Welcome back, {displayName}</h1>
        <p className="text-gray-400 mt-1 text-sm">Here's where your training stands today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Assigned courses" value={assignments.length} />
        <KpiCard label="Completed" value={completed.length} />
        <KpiCard label="Overdue" value={overdue.length} tone={overdue.length ? 'danger' : 'default'} sub={overdue.length ? 'Needs attention' : undefined} />
        <KpiCard label="Training hours" value={totalHours.toFixed(1)} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-head font-bold text-lg text-white">Continue learning</h2>
          <Link to="/my-learning" className="text-sm text-rose-400 hover:text-rose-300 font-medium transition-colors">View all</Link>
        </div>
        {inProgress.length === 0 ? (
          <div className="p-8 rounded-3xl bg-[#14181d]/80 border border-white/10 backdrop-blur-xl text-center">
            <EmptyState title="Nothing in progress" body="Start one of your assigned courses to see it here." action={<Link to="/courses" className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#9E1B1B] to-rose-700 text-white font-bold text-sm shadow-lg shadow-red-950/50 mt-3">Browse courses</Link>} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {inProgress.map((a) => {
              const courseId = a.course?.id || a.course_id
              const courseTitle = a.course?.name || a.course?.title || 'Untitled Course'
              const p = progressMap[courseId]
              const statusStr = a.status || 'assigned'

              return (
                <Link to={`/courses/${courseId}`} key={a.id} className="p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl block hover:border-rose-500/50 transition-all shadow-xl">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-white text-base">{courseTitle}</p>
                    <Badge tone={statusTone(statusStr)}>{statusStr.replace('_', ' ')}</Badge>
                  </div>
                  <div className="mt-4">
                    <ProgressBar percent={p?.progress_percent ?? p?.progress ?? 0} />
                    <p className="text-xs text-gray-400 mt-2 font-medium">{p?.progress_percent ?? p?.progress ?? 0}% complete</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-head font-bold text-lg mb-3 text-white">Upcoming deadlines</h2>
          <div className="rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl divide-y divide-white/10 overflow-hidden shadow-xl">
            {assignments.filter((a) => a.status !== 'completed').slice(0, 5).map((a) => {
              const courseTitle = a.course?.name || a.course?.title || 'Untitled Course'
              const statusStr = a.status || 'assigned'

              return (
                <div key={a.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-white">{courseTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.due_date ? `Due ${a.due_date}` : 'No due date'}</p>
                  </div>
                  <Badge tone={statusTone(statusStr)}>{statusStr.replace('_', ' ')}</Badge>
                </div>
              )
            })}
            {(assignments.length === 0 || assignments.every((a) => a.status === 'completed')) && (
              <p className="p-5 text-sm text-gray-400">You're all caught up.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-head font-bold text-lg mb-3 text-white">Recent notifications</h2>
          <div className="rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl divide-y divide-white/10 overflow-hidden shadow-xl">
            {notifications.length === 0 && <p className="p-5 text-sm text-gray-400">No notifications yet.</p>}
            {notifications.map((n) => (
              <div key={n.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                <p className="text-sm font-semibold text-white">{n.title || n.message || 'Notification'}</p>
                <p className="text-xs text-gray-400 mt-1">{n.body || n.message || ''}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {certificates.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-head font-bold text-lg text-white">Certificates</h2>
            <Link to="/certificates" className="text-sm text-rose-400 hover:text-rose-300 font-medium transition-colors">View all</Link>
          </div>
          <div className="flex gap-4 flex-wrap">
            {certificates.slice(0, 3).map((c) => {
              const courseTitle = c.course?.name || c.course?.title || 'Course Certificate'
              const certCode = c.cert_number || c.certificate_code || 'N/A'

              return (
                <div key={c.id} className="p-4 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl shadow-xl min-w-[220px]">
                  <p className="text-sm font-semibold text-white">{courseTitle}</p>
                  <p className="text-xs text-gray-400 mt-1 font-mono">Code: {certCode}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
