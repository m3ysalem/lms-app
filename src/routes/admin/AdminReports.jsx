import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Spinner } from '../../components/Ui'
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

// الجداول التي يتم الاشتراك في تغييراتها لتحديث التقارير تلقائياً
const LIVE_TABLES = [
  'profiles',
  'departments',
  'courses',
  'course_departments',
  'course_progress',
  'course_assignments',
  'lesson_progress',
  'certificates',
  'quiz_attempts',
]

const DONE_STATUSES = ['completed', 'complete', 'finished']
const isDoneStatus = (s) => DONE_STATUSES.includes(String(s || '').toLowerCase())

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : 'N/A')
const formatDateTime = (v) => (v ? new Date(v).toLocaleString() : 'N/A')

// تحويل أي قيمة مدة (رقم أو نص مثل "1h 30m") إلى دقائق
const parseMinutes = (rawVal) => {
  if (rawVal === null || rawVal === undefined || rawVal === '') return 0

  const num = Number(rawVal)
  if (!isNaN(num)) return num > 0 ? num : 0

  const strVal = String(rawVal).toLowerCase()
  let totalMins = 0
  const hourMatch = strVal.match(/(\d+)\s*(h|hr|hour|ساعة)/)
  const minMatch = strVal.match(/(\d+)\s*(m|min|minute|دقيقة)/)

  if (hourMatch) totalMins += parseInt(hourMatch[1]) * 60
  if (minMatch) totalMins += parseInt(minMatch[1])

  return totalMins > 0 ? totalMins : 0
}

// استخراج عدد الدقائق من أي كورس بغض النظر عن اسم الحقل أو صيغته
const getCourseDurationMinutes = (course) => {
  if (!course) return 0
  const candidates = [course.duration_minutes, course.duration, course.duration_mins, course.minutes, course.time]
  for (const v of candidates) {
    const mins = parseMinutes(v)
    if (mins > 0) return mins
  }
  return 0
}

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState('completion')
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportData, setReportData] = useState([])
  const requestRef = useRef(0)

  // جلب وتجهيز بيانات التقارير بشكل دقيق ومفلتر ومتكامل
  const fetchReportData = async (tab, silent = false) => {
    const reqId = ++requestRef.current
    if (!silent) setLoadingReport(true)
    try {
      const [
        { data: profilesData },
        { data: departmentsData },
        { data: coursesData },
        { data: courseDeptData },
        { data: progData },
        { data: assignmentsData },
        { data: lessonsData },
        { data: lessonProgData },
        { data: certsData },
        { data: quizAttData },
        { data: quizzesData },
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role, department_id, department, is_active'),
        supabase.from('departments').select('*'),
        supabase.from('courses').select('*'),
        supabase.from('course_departments').select('*'),
        supabase.from('course_progress').select('*'),
        supabase.from('course_assignments').select('*'),
        supabase.from('lessons').select('*'),
        supabase.from('lesson_progress').select('*'),
        supabase.from('certificates').select('*'),
        supabase.from('quiz_attempts').select('*'),
        supabase.from('quizzes').select('*'),
      ])

      if (reqId !== requestRef.current) return

      const profiles = profilesData || []
      const profilesMap = Object.fromEntries(profiles.map(p => [p.id, p]))
      const validEmployeeIds = new Set(Object.keys(profilesMap))

      const deptMap = Object.fromEntries((departmentsData || []).map(d => [d.id, d.name]))
      const getDeptName = (p) => (p && (deptMap[p.department_id] || p.department)) || null
      const deptLabel = (p) => getDeptName(p) || 'N/A'

      const coursesMap = Object.fromEntries((coursesData || []).map(c => [c.id, c]))
      const lessonsMap = Object.fromEntries((lessonsData || []).map(l => [l.id, l]))
      const quizzesMap = Object.fromEntries((quizzesData || []).map(q => [q.id, q]))

      // تصفية صارمة لكل الجداول المرتبطة بالموظفين الموجودين فقط في الـ profiles
      const validProgData = (progData || []).filter(p => validEmployeeIds.has(p.employee_id))
      const validAssignments = (assignmentsData || []).filter(a => validEmployeeIds.has(a.employee_id))
      const validLessonProg = (lessonProgData || []).filter(p => validEmployeeIds.has(p.employee_id))
      const validCerts = (certsData || []).filter(c => validEmployeeIds.has(c.employee_id))
      const validQuizAttempts = (quizAttData || []).filter(q => validEmployeeIds.has(q.employee_id))

      // دمج التعيينات مع التقدم: كل (موظف + كورس) سجل واحد
      const enrollMap = new Map()
      const keyOf = (empId, courseId) => `${empId}|${courseId}`

      validAssignments.forEach(a => {
        if (!coursesMap[a.course_id]) return
        enrollMap.set(keyOf(a.employee_id, a.course_id), {
          employee_id: a.employee_id,
          course_id: a.course_id,
          assignment: a,
          progress: null,
        })
      })

      validProgData.forEach(p => {
        if (!coursesMap[p.course_id]) return
        const k = keyOf(p.employee_id, p.course_id)
        const existing = enrollMap.get(k)
        if (existing) {
          existing.progress = p
        } else {
          enrollMap.set(k, {
            employee_id: p.employee_id,
            course_id: p.course_id,
            assignment: null,
            progress: p,
          })
        }
      })

      const enrollments = Array.from(enrollMap.values()).map(en => {
        const rawPercent = Number(en.progress?.progress_percent || 0)
        const completed =
          rawPercent >= 100 ||
          isDoneStatus(en.progress?.status) ||
          isDoneStatus(en.assignment?.status)
        const percent = completed ? 100 : Math.min(Math.max(rawPercent, 0), 100)
        const assignmentStatus = String(en.assignment?.status || '').toLowerCase()
        const status = completed
          ? 'Completed'
          : (percent > 0 || assignmentStatus === 'in_progress' ? 'In Progress' : 'Not Started')
        const course = coursesMap[en.course_id]
        const lastDate =
          en.progress?.completed_at ||
          en.progress?.last_accessed_at ||
          en.progress?.started_at ||
          en.assignment?.assigned_date ||
          en.assignment?.created_at ||
          null

        return {
          ...en,
          percent,
          completed,
          status,
          course,
          profile: profilesMap[en.employee_id] || {},
          minutes: getCourseDurationMinutes(course),
          lastDate,
        }
      })

      let data = []

      if (tab === 'department') {
        const employees = profiles.filter(p => p.role === 'employee')

        const publishedCourses = (coursesData || []).filter(c => String(c.status || '').toLowerCase() === 'published')
        const linksByCourse = {}
        ;(courseDeptData || []).forEach(l => {
          if (!linksByCourse[l.course_id]) linksByCourse[l.course_id] = new Set()
          linksByCourse[l.course_id].add(l.department_id)
        })
        const countCoursesForDept = (deptId) =>
          publishedCourses.filter(c =>
            !c.department_id ||
            (deptId && (c.department_id === deptId || linksByCourse[c.id]?.has(deptId)))
          ).length

        // كل الإدارات المسجلة + أي إدارة نصية موجودة عند الموظفين + غير المصنفين
        const groups = new Map()
        ;(departmentsData || []).forEach(d => {
          if (d.name) groups.set(d.name, { id: d.id })
        })
        employees.forEach(p => {
          const name = getDeptName(p) || 'Unassigned'
          if (!groups.has(name)) groups.set(name, { id: null })
        })

        const rows = Array.from(groups.entries()).map(([deptName, group]) => {
          const deptEmployees = employees.filter(p => (getDeptName(p) || 'Unassigned') === deptName)
          const empIds = new Set(deptEmployees.map(e => e.id))
          const deptEnrollments = enrollments.filter(en => empIds.has(en.employee_id))
          const completedEnrollments = deptEnrollments.filter(en => en.completed)

          const totalAssigned = deptEnrollments.length
          const completedCount = completedEnrollments.length
          const completionRate = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0
          const avgProgress = totalAssigned > 0
            ? Math.round(deptEnrollments.reduce((acc, en) => acc + en.percent, 0) / totalAssigned)
            : 0

          const totalMinutes = completedEnrollments.reduce((acc, en) => acc + en.minutes, 0)
          const totalHours = totalMinutes / 60

          return {
            sortRate: completionRate,
            sortEmployees: deptEmployees.length,
            row: {
              'Department Name': deptName,
              'Total Employees': deptEmployees.length,
              'Total Courses': countCoursesForDept(group.id),
              'Total Assignments': totalAssigned,
              'Completed Assignments': completedCount,
              'Total Training Hours': totalHours.toFixed(1) + ' hrs',
              'Avg Progress (%)': avgProgress + '%',
              'Completion Rate (%)': completionRate + '%',
              'Remaining (%)': (totalAssigned > 0 ? 100 - completionRate : 0) + '%',
            },
          }
        })

        rows.sort((a, b) => b.sortRate - a.sortRate || b.sortEmployees - a.sortEmployees)
        data = rows.map(r => r.row)
      } else if (tab === 'completion') {
        data = enrollments.map(en => ({
          'Employee Name': en.profile.full_name || en.profile.email || 'N/A',
          'Department': deptLabel(en.profile),
          'Course Name': en.course?.name || 'N/A',
          'Duration': en.minutes > 0 ? `${en.minutes} mins` : 'N/A',
          'Status': en.status,
          'Progress (%)': en.percent + '%',
        }))
      } else if (tab === 'employee_history') {
        data = enrollments.map(en => ({
          'Employee': en.profile.full_name || 'N/A',
          'Department': deptLabel(en.profile),
          'Course Code': en.course?.course_code || (en.course?.id ? en.course.id.substring(0, 8) : 'N/A'),
          'Course Name': en.course?.name || 'N/A',
          'Current Status': en.status,
          'Last Updated': formatDate(en.lastDate),
        }))
      } else if (tab === 'course_performance') {
        data = (coursesData || []).map(c => {
          const cEnroll = enrollments.filter(en => en.course_id === c.id)
          const enrolled = cEnroll.length
          const completed = cEnroll.filter(en => en.completed).length
          const passRate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0
          const avgProgress = enrolled > 0
            ? Math.round(cEnroll.reduce((acc, en) => acc + en.percent, 0) / enrolled)
            : 0
          const durationMins = getCourseDurationMinutes(c)

          return {
            'Course Code': c.course_code || (c.id ? c.id.substring(0, 8) : 'N/A'),
            'Course Name': c.name || 'N/A',
            'Status': c.status || 'N/A',
            'Duration': durationMins > 0 ? `${durationMins} mins` : 'N/A',
            'Total Enrolled': enrolled,
            'Completed Count': completed,
            'Avg Progress': avgProgress + '%',
            'Success Rate': passRate + '%',
          }
        })
      } else if (tab === 'attendance') {
        data = validLessonProg.map(item => {
          const lesson = lessonsMap[item.lesson_id] || {}
          const profile = profilesMap[item.employee_id] || {}
          return {
            'Employee Name': profile.full_name || 'N/A',
            'Department': deptLabel(profile),
            'Lesson Title': lesson.title || 'N/A',
            'Status': item.status || 'Viewed',
            'Date Attended': formatDateTime(item.completed_at || item.updated_at || item.created_at),
          }
        })
      } else if (tab === 'certificates') {
        data = validCerts.map(item => {
          const course = coursesMap[item.course_id] || {}
          const profile = profilesMap[item.employee_id] || {}
          return {
            'Employee Name': profile.full_name || 'N/A',
            'Department': deptLabel(profile),
            'Course Name': course.name || item.course_name || 'N/A',
            'Issue Date': formatDate(item.issued_date || item.created_at),
          }
        })
      } else if (tab === 'assessment') {
        data = validQuizAttempts.map(item => {
          const quiz = quizzesMap[item.quiz_id] || {}
          const profile = profilesMap[item.employee_id] || {}
          let scorePercent = null
          if (item.percentage !== null && item.percentage !== undefined) {
            scorePercent = Math.round(Number(item.percentage))
          } else if (Number(item.total_points) > 0 && item.score_points !== null && item.score_points !== undefined) {
            scorePercent = Math.round((Number(item.score_points) / Number(item.total_points)) * 100)
          }
          const submitted = !!item.submitted_at
          return {
            'Employee Name': profile.full_name || 'N/A',
            'Department': deptLabel(profile),
            'Quiz Title': quiz.title || 'N/A',
            'Attempt #': item.attempt_number ?? 1,
            'Score (%)': scorePercent !== null ? scorePercent + '%' : 'N/A',
            'Result': item.passed ? 'Passed' : (submitted ? 'Failed' : 'In Progress'),
            'Attempt Date': formatDate(item.submitted_at || item.started_at),
          }
        })
      }

      setReportData(data)
    } catch (err) {
      console.error('Error fetching report:', err)
      if (reqId === requestRef.current) setReportData([])
    } finally {
      if (reqId === requestRef.current) setLoadingReport(false)
    }
  }

  // تحميل التقرير + تحديث تلقائي عند أي تغيير في البيانات (Realtime) + تحديث دوري احتياطي
  useEffect(() => {
    fetchReportData(activeTab)

    let timer = null
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => fetchReportData(activeTab, true), 700)
    }

    const channel = supabase.channel(`reports-live-${activeTab}`)
    LIVE_TABLES.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    })
    channel.subscribe()

    const interval = setInterval(() => fetchReportData(activeTab, true), 30000)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
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
        const val = row[key]
        return `"${String(val ?? '').replace(/"/g, '""')}"`
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

  return (
    <div className="space-y-8 text-white">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black font-head tracking-wide text-white">Advanced Reports & Analytics</h1>
          <p className="text-gray-400 mt-1 text-sm">Comprehensive platform metrics and detailed employee reports.</p>
        </div>
        <Link
          to="/admin"
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* قسم التقارير المتقدمة */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-head font-bold text-xl text-white">Detailed System Reports</h2>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 text-white font-medium text-sm shadow-lg hover:opacity-95 transition-opacity flex items-center gap-2"
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
    </div>
  )
}
