import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { KpiCard, Spinner, Badge } from '../../components/Ui'
import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [overdue, setOverdue] = useState([])

  useEffect(() => {
    async function load() {
      // جلب البيانات الأساسية مع تصفية الموظفين الحقيقيين فقط
      const [employees, courses, assignments, certificates] = await Promise.all([
        supabase.from('profiles').select('id, is_active, role', { count: 'exact' }),
        supabase.from('courses').select('id, status', { count: 'exact' }),
        supabase.from('course_assignments').select('id, status, due_date, employee_id'),
        supabase.from('certificates').select('id, employee_id', { count: 'exact' }),
      ])

      const employeeRows = employees.data || []
      const validEmployeeIds = new Set(employeeRows.map(e => e.id))
      const courseRows = courses.data || []
      
      // تصفية الواجبات والشهادات لتشمل الموظفين الموجودين فقط في profiles
      const assignmentRows = (assignments.data || []).filter(a => validEmployeeIds.has(a.employee_id))
      const validCertificates = (certificates.data || []).filter(c => validEmployeeIds.has(c.employee_id))

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
        certificates: validCertificates.length,
      })

      // جلب المتأخرات مع التأكد من وجود الموظف والكورس بشكل سليم
      const { data: overdueDetail } = await supabase
        .from('course_assignments')
        .select('id, due_date, course_id, employee_id, courses(name), profiles(full_name)')
        .neq('status', 'completed')
        .lt('due_date', new Date().toISOString().slice(0, 10))
        .limit(8)
      
      const formattedOverdue = (overdueDetail || [])
        .filter(o => o.profiles && validEmployeeIds.has(o.employee_id))
        .map(o => ({
          ...o,
          course: o.courses || { name: 'N/A' },
          employee: o.profiles || { full_name: 'N/A' }
        }))
      setOverdue(formattedOverdue)
    }
    load()
  }, [])

  if (!stats) return <Spinner />

  return (
    <div className="space-y-8 text-white">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black font-head tracking-wide text-white">Admin dashboard</h1>
          <p className="text-gray-400 mt-1 text-sm">Core KPIs & System Overview.</p>
        </div>
        {/* زر الانتقال لصفحة التقارير المستقلة */}
        <Link
          to="/admin/reports"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-medium text-sm shadow-lg hover:opacity-95 transition-all flex items-center gap-2"
        >
          📊 Go to Advanced Reports
        </Link>
      </div>

      {/* مؤشرات الأداء الرئيسية (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Employees" value={stats.totalEmployees} sub={`${stats.activeEmployees} active`} />
        <KpiCard label="Courses" value={stats.totalCourses} sub={`${stats.activeCourses} published`} />
        <KpiCard label="Assignments" value={stats.totalAssignments} sub={`${stats.completed} completed`} />
        <KpiCard label="Completion rate" value={`${stats.completionRate}%`} />
        <KpiCard label="Overdue" value={stats.overdueCount} tone={stats.overdueCount ? 'danger' : 'default'} />
        <KpiCard label="Certificates issued" value={stats.certificates} />
      </div>

      {/* روابط الإدارة السريعة */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link to="/admin/employees" className="p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl block hover:border-rose-500/50 transition-all shadow-xl">
          <p className="font-semibold text-white text-base">Manage employees</p>
          <p className="text-sm text-gray-400 mt-1">Add, edit, deactivate, and import employees.</p>
        </Link>
        <Link to="/admin/courses" className="p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl block hover:border-rose-500/50 transition-all shadow-xl">
          <p className="font-semibold text-white text-base">Manage courses</p>
          <p className="text-sm text-gray-400 mt-1">Build modules, lessons, materials and quizzes.</p>
        </Link>
        <Link to="/admin/assignments" className="p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl block hover:border-rose-500/50 transition-all shadow-xl">
          <p className="font-semibold text-white text-base">Assignments</p>
          <p className="text-sm text-gray-400 mt-1">Assign courses to individuals, groups or departments.</p>
        </Link>
      </div>

      {/* قسم التدريبات المتأخرة */}
      <section>
        <h2 className="font-head font-bold text-lg mb-3 text-white">Overdue training</h2>
        <div className="rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl divide-y divide-white/10 overflow-hidden shadow-xl">
          {overdue.length === 0 && <p className="p-5 text-sm text-gray-400">Nothing overdue right now.</p>}
          {overdue.map((o) => (
            <div key={o.id} className="p-4 flex items-center justify-between text-sm hover:bg-white/[0.02] transition-colors">
              <div>
                <p className="font-semibold text-white">{o.employee?.full_name}</p>
                <p className="text-gray-400 text-xs mt-0.5">{o.course?.name}</p>
              </div>
              <Badge tone="danger">Due {o.due_date}</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
