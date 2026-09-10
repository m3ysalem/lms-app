import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { KpiCard, Spinner, Badge, statusTone } from '../../components/Ui'
import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [overdue, setOverdue] = useState([])

  useEffect(() => {
    async function load() {
      const [employees, courses, assignments, certificates] = await Promise.all([
        supabase.from('profiles').select('id, is_active, role', { count: 'exact' }),
        supabase.from('courses').select('id, status', { count: 'exact' }),
        supabase.from('course_assignments').select('id, status, due_date'),
        supabase.from('certificates').select('id', { count: 'exact' }),
      ])

      const employeeRows = employees.data || []
      const courseRows = courses.data || []
      const assignmentRows = assignments.data || []

      const today = new Date()
      const overdueRows = assignmentRows.filter((a) => a.status !== 'completed' && a.due_date && new Date(a.due_date) < today)
      const completed = assignmentRows.filter((a) => a.status === 'completed').length

      setStats({
        totalEmployees: employeeRows.filter((e) => e.role === 'employee').length,
        activeEmployees: employeeRows.filter((e) => e.role === 'employee' && e.is_active).length,
        totalCourses: courseRows.length,
        activeCourses: courseRows.filter((c) => c.status === 'published').length,
        totalAssignments: assignmentRows.length,
        completed,
        completionRate: assignmentRows.length ? Math.round((completed / assignmentRows.length) * 100) : 0,
        overdueCount: overdueRows.length,
        certificates: certificates.count ?? 0,
      })

      const { data: overdueDetail } = await supabase
        .from('course_assignments')
        .select('id, due_date, course:course_id(name), employee:employee_id(full_name)')
        .neq('status', 'completed')
        .lt('due_date', new Date().toISOString().slice(0, 10))
        .limit(8)
      setOverdue(overdueDetail || [])
    }
    load()
  }, [])

  if (!stats) return <Spinner />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin dashboard</h1>
        <p className="text-muted mt-1">Core KPIs — the full analytics dashboard (charts, training matrix, department breakdowns) ships in Phase 2.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Employees" value={stats.totalEmployees} sub={`${stats.activeEmployees} active`} />
        <KpiCard label="Courses" value={stats.totalCourses} sub={`${stats.activeCourses} published`} />
        <KpiCard label="Assignments" value={stats.totalAssignments} sub={`${stats.completed} completed`} />
        <KpiCard label="Completion rate" value={`${stats.completionRate}%`} />
        <KpiCard label="Overdue" value={stats.overdueCount} tone={stats.overdueCount ? 'danger' : 'default'} />
        <KpiCard label="Certificates issued" value={stats.certificates} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/admin/employees" className="card p-4 hover:border-teal transition-colors">
          <p className="font-medium text-ink-800">Manage employees</p>
          <p className="text-sm text-muted mt-1">Add, edit, deactivate, and import employees.</p>
        </Link>
        <Link to="/admin/courses" className="card p-4 hover:border-teal transition-colors">
          <p className="font-medium text-ink-800">Manage courses</p>
          <p className="text-sm text-muted mt-1">Build modules, lessons, materials and quizzes.</p>
        </Link>
        <Link to="/admin/assignments" className="card p-4 hover:border-teal transition-colors">
          <p className="font-medium text-ink-800">Assignments</p>
          <p className="text-sm text-muted mt-1">Assign courses to individuals, groups or departments.</p>
        </Link>
      </div>

      <section>
        <h2 className="font-head font-semibold text-lg mb-3">Overdue training</h2>
        <div className="card divide-y divide-surface-border">
          {overdue.length === 0 && <p className="p-4 text-sm text-muted">Nothing overdue right now.</p>}
          {overdue.map((o) => (
            <div key={o.id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-ink-800">{o.employee?.full_name}</p>
                <p className="text-muted">{o.course?.name}</p>
              </div>
              <Badge tone="danger">Due {o.due_date}</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
