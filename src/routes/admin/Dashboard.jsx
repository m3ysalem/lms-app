import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { KpiCard, Spinner, Badge, statusTone } from '../../components/Ui'
import { Link } from 'react-router-dom'

const REPORTS_TABS = [
  { id: 'completion', label: 'Training Completion Rate' },
  { id: 'employee_history', label: 'Employee History' },
  { id: 'course_performance', label: 'Course Performance' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'department', label: 'Department Report' },
  { id: 'assessment', label: 'Assessment Report' },
]

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [overdue, setOverdue] = useState([])

  // حالات قسم التقارير الجديدة
  const [activeTab, setActiveTab] = useState('completion')
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportData, setReportData] = useState([])

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

  // دالة جلب بيانات التقارير حسب التاب النشط
  const fetchReportData = async (tab) => {
    setLoadingReport(true)
    try {
      let data = []
      if (tab === 'completion') {
        const { data: res } = await supabase.from('course_progress').select('*, courses(name), profiles(full_name, email)')
        data = res || []
      } else if (tab === 'employee_history') {
        const { data: res } = await supabase.from('course_progress').select('*, courses(name, course_code), profiles(full_name, email)')
        data = res || []
      } else if (tab === 'course_performance') {
        const { data: res } = await supabase.from('courses').select('id, name, course_code, status, duration_minutes, passing_score')
        data = res || []
      } else if (tab === 'attendance') {
        const { data: res } = await supabase.from('lesson_progress').select('*, profiles(full_name), lessons(title)')
        data = res || []
      } else if (tab === 'certificates') {
        const { data: res } = await supabase.from('certificates').select('*, courses(name), profiles(full_name, email)')
        data = res || []
      } else if (tab === 'department') {
        const { data: res } = await supabase.from('departments').select('id, name')
        data = res || []
      } else if (tab === 'assessment') {
        const { data: res } = await supabase.from('quiz_attempts').select('*, quizzes(title), profiles(full_name)')
        data = res || []
      }
      setReportData(data)
    } catch (err) {
      console.error('Error fetching report:', err)
    } finally {
      setLoadingReport(false)
    }
  }

  useEffect(() => {
    fetchReportData(activeTab)
  }, [activeTab])

  // دالة لتصدير التقرير الحالي إلى ملف Excel شغال ومنسق
  const exportToExcel = () => {
    if (!reportData.length) {
      alert('No data available to export.')
      return
    }

    let csvContent = '\uFEFF' // دعم الحروف العربية في Excel
    const keys = Object.keys(reportData[0])
    csvContent += keys.join(',') + '\n'

    reportData.forEach(row => {
      const values = keys.map(key => {
        let val = row[key]
        if (typeof val === 'object' && val !== null) {
          val = val.name || val.full_name || val.title || JSON.stringify(val)
        }
        return `"${String(val || '').replace(/"/g, '""')}"`
      })
      csvContent += values.join(',') + '\n'
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${activeTab}_report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!stats) return <Spinner />

  return (
    <div className="space-y-8 text-white">
      <div>
        <h1 className="text-3xl font-black font-head tracking-wide text-white">Admin dashboard</h1>
        <p className="text-gray-400 mt-1 text-sm">Core KPIs & Advanced Training Reports Management.</p>
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

      {/* قسم التقارير المتقدمة والتابات وزر تصدير الاكسيل */}
      <section className="space-y-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-head font-bold text-xl text-white">Advanced Training Reports</h2>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 text-white font-medium text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            📥 Export Current Report to Excel
          </button>
        </div>

        {/* التابات الشيك */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10">
          {REPORTS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-black/40 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* عرض بيانات التقرير */}
        <div className="p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl shadow-xl">
          {loadingReport ? (
            <div className="py-12 flex justify-center"><Spinner /></div>
          ) : reportData.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No records found for this report.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider">
                    {Object.keys(reportData[0]).slice(0, 6).map((key) => (
                      <th key={key} className="p-3">{key.replace('_', ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                  {reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      {Object.keys(reportData[0]).slice(0, 6).map((key) => {
                        let val = row[key]
                        if (typeof val === 'object' && val !== null) {
                          val = val.name || val.full_name || val.title || JSON.stringify(val)
                        }
                        return (
                          <td key={key} className="p-3 truncate max-w-xs">
                            {String(val ?? '')}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

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
