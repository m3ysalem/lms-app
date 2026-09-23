import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { KpiCard, Spinner, Badge } from '../../components/Ui'
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

  // حالات قسم التقارير
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
        .select('id, due_date, course_id, employee_id, courses(name), profiles(full_name)')
        .neq('status', 'completed')
        .lt('due_date', new Date().toISOString().slice(0, 10))
        .limit(8)
      
      const formattedOverdue = (overdueDetail || []).map(o => ({
        ...o,
        course: o.courses || { name: 'N/A' },
        employee: o.profiles || { full_name: 'N/A' }
      }))
      setOverdue(formattedOverdue)
    }
    load()
  }, [])

  // جلب وتجهيز بيانات التقارير بالاعتماد الكامل على جدول profiles
  const fetchReportData = async (tab) => {
    setLoadingReport(true)
    try {
      // جلب الجداول الأساسية مع التركيز على profiles لجميع البيانات الوصفية للموظف والادارة
      const [
        { data: progData }, 
        { data: coursesData }, 
        { data: profilesData }, 
        { data: lessonsData }, 
        { data: lessonProgData }, 
        { data: certsData }, 
        { data: quizAttData }, 
        { data: quizzesData }
      ] = await Promise.all([
        supabase.from('course_progress').select('*'),
        supabase.from('courses').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('lessons').select('*'),
        supabase.from('lesson_progress').select('*'),
        supabase.from('certificates').select('*'),
        supabase.from('quiz_attempts').select('*'),
        supabase.from('quizzes').select('*'),
      ])

      const coursesMap = Object.fromEntries((coursesData || []).map(c => [c.id, c]))
      const profilesMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]))
      const lessonsMap = Object.fromEntries((lessonsData || []).map(l => [l.id, l]))
      const quizzesMap = Object.fromEntries((quizzesData || []).map(q => [q.id, q]))

      let data = []

if (tab === 'department') {
        const [{ data: profiles }, { data: coursesList }, { data: progress }] = await Promise.all([
          supabase.from('profiles').select('id, department'),
          supabase.from('courses').select('id, duration'),
          supabase.from('course_progress').select('employee_id, course_id, status, progress_percent')
        ])

        const uniqueDepts = [...new Set((profiles || []).map(p => p.department).filter(Boolean))]
        const coursesMap = Object.fromEntries((coursesList || []).map(c => [c.id, c]))

        const deptReport = uniqueDepts.map(deptName => {
          const deptEmployees = (profiles || []).filter(p => p.department === deptName)
          const empIds = deptEmployees.map(e => e.id)
          
          const empProgress = (progress || []).filter(p => empIds.includes(p.employee_id))
          
          // تصفية التقدم المكتمل فقط وحساب مجموع مدة كورساتهم بالدقائق ثم تحويلها لساعات
          const completedProgress = empProgress.filter(p => p.status === 'completed' || p.progress_percent === 100)
          const totalMinutes = completedProgress.reduce((acc, curr) => {
            const course = coursesMap[curr.course_id] || {}
            return acc + (course.duration || 0)
          }, 0)
          
          const totalHours = totalMinutes / 60

          const totalAssigned = empProgress.length
          const completedCount = completedProgress.length
          const successRate = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0
          const failureRate = totalAssigned > 0 ? 100 - successRate : 0

          return {
            'Department Name': deptName,
            'Total Employees': deptEmployees.length,
            'Total Courses': (coursesList || []).length,
            'Total Training Hours': totalHours.toFixed(1) + ' hrs',
            'Completed Assignments': completedCount,
            'Success Rate (%)': successRate + '%',
            'Incomplete / Failure Rate (%)': failureRate + '%'
          }
        })

        setReportData(deptReport)
        setLoadingReport(false)
        return
      }
    } else if (tab === 'completion') {
        data = (progData || []).map(item => {
          const course = coursesMap[item.course_id] || {}
          const profile = profilesMap[item.employee_id] || {}
          return {
            'Employee Name': profile.full_name || profile.email || 'N/A',
            'Department': profile.department || 'N/A',
            'Course Name': course.name || 'N/A',
            'Status': item.status || 'In Progress',
            'Progress (%)': (item.progress_percent || 0) + '%'
          }
        })
      } else if (tab === 'employee_history') {
        data = (progData || []).map(item => {
          const course = coursesMap[item.course_id] || {}
          const profile = profilesMap[item.employee_id] || {}
          return {
            'Employee': profile.full_name || 'N/A',
            'Department': profile.department || 'N/A',
            'Course Code': course.id ? course.id.substring(0, 8) : 'N/A',
            'Course Name': course.name || 'N/A',
            'Current Status': item.status || 'Active',
            'Last Updated': item.updated_at ? new Date(item.updated_at).toLocaleDateString() : 'N/A'
          }
        })
      } else if (tab === 'course_performance') {
        data = (coursesData || []).map(c => {
          const cProg = (progData || []).filter(p => p.course_id === c.id)
          const enrolled = cProg.length
          const completed = cProg.filter(p => p.status === 'completed').length
          const passRate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0
          return {
            'Course Code': c.id ? c.id.substring(0, 8) : 'N/A',
            'Course Name': c.name || 'N/A',
            'Status': c.status || 'N/A',
            'Duration (Mins)': c.duration || 0,
            'Total Enrolled': enrolled,
            'Completed Count': completed,
            'Success Rate': passRate + '%'
          }
        })
      } else if (tab === 'attendance') {
        data = (lessonProgData || []).map(item => {
          const lesson = lessonsMap[item.lesson_id] || {}
          const profile = profilesMap[item.employee_id] || {}
          return {
            'Employee Name': profile.full_name || 'N/A',
            'Department': profile.department || 'N/A',
            'Lesson Title': lesson.title || 'N/A',
            'Status': item.status || 'Viewed',
            'Date Attended': item.updated_at ? new Date(item.updated_at).toLocaleString() : 'N/A'
          }
        })
      } else if (tab === 'certificates') {
        data = (certsData || []).map(item => {
          const course = coursesMap[item.course_id] || {}
          const profile = profilesMap[item.employee_id] || {}
          return {
            'Employee Name': profile.full_name || 'N/A',
            'Department': profile.department || 'N/A',
            'Course Name': course.name || 'N/A',
            'Issue Date': item.issued_at ? new Date(item.issued_at).toLocaleDateString() : 'N/A'
          }
        })
      } else if (tab === 'assessment') {
        data = (quizAttData || []).map(item => {
          const quiz = quizzesMap[item.quiz_id] || {}
          const profile = profilesMap[item.employee_id] || {}
          return {
            'Employee Name': profile.full_name || 'N/A',
            'Department': profile.department || 'N/A',
            'Quiz Title': quiz.title || 'N/A',
            'Score (%)': item.score ?? 'N/A',
            'Result': item.passed ? 'Passed' : 'Failed',
            'Attempt Date': item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'
          }
        })
      }

      setReportData(data)
    } catch (err) {
      console.error('Error fetching report:', err)
      setReportData([])
    } finally {
      setLoadingReport(false)
    }
  }

  useEffect(() => {
    fetchReportData(activeTab)
  }, [activeTab])

  // تصدير التقرير الحالي لملف Excel (CSV)
  const exportToExcel = () => {
    if (!reportData.length) {
      alert('No data available to export.')
      return
    }

    let csvContent = '\uFEFF'
    const keys = Object.keys(reportData[0])
    csvContent += keys.join(',') + '\n'

    reportData.forEach(row => {
      const values = keys.map(key => {
        let val = row[key]
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
        <p className="text-gray-400 mt-1 text-sm">Core KPIs & Detailed Analytics & Reports.</p>
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

      {/* قسم التقارير المتقدمة */}
      <section className="space-y-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-head font-bold text-xl text-white">Advanced Detailed Reports</h2>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 text-white font-medium text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            📥 Export Current Report to Excel
          </button>
        </div>

        {/* التابات */}
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

        {/* جدول عرض التقارير */}
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
                    {Object.keys(reportData[0]).map((key) => (
                      <th key={key} className="p-3">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                  {reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      {Object.keys(reportData[0]).map((key) => (
                        <td key={key} className="p-3 truncate max-w-xs">
                          {String(row[key] ?? '')}
                        </td>
                      ))}
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
