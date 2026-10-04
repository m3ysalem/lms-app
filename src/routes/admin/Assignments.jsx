import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import {
  listAllCourses,
  listEmployees,
  listDepartments,
  assignCourse,
  listAssignments,
} from '../../lib/api'
import { DEPARTMENTS_LIST } from '../../lib/departments'
import { Badge, ProgressBar, statusTone, Spinner } from '../../components/Ui'

const MODES = [
  { id: 'individual', label: 'Select employees' },
  { id: 'department', label: 'By department' },
  { id: 'all', label: 'All employees' },
]

const STATUS_FILTERS = [
  { id: '', label: 'All statuses' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
]

// الجداول التي تؤثر على هذه الصفحة؛ أي تغيير فيها يحدّث القائمة تلقائياً
const LIVE_TABLES = ['course_assignments', 'course_progress', 'profiles', 'courses', 'departments']

const PAGE_SIZE = 50

const todayISO = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD بتوقيت الجهاز
const isPublished = (c) => String(c?.status || '').toLowerCase() === 'published'
const keyOf = (employeeId, courseId) => `${employeeId}|${courseId}`

function StatCard({ label, value, danger = false }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${danger && value > 0 ? 'text-danger' : 'text-white'}`}>{value}</p>
    </div>
  )
}

export default function Assignments() {
  const { profile } = useAuth()

  // ----- البيانات -----
  const [courses, setCourses] = useState([])
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [assignments, setAssignments] = useState(null)
  const [progressMap, setProgressMap] = useState({})
  const [loadError, setLoadError] = useState('')

  // ----- فورم التعيين -----
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState('individual')
  const [selectedEmployees, setSelectedEmployees] = useState(new Set())
  const [selectedDepts, setSelectedDepts] = useState(new Set())
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerDept, setPickerDept] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [mandatory, setMandatory] = useState(true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error' | 'info', text }

  // ----- فلاتر جدول التعيينات -----
  const [tableSearch, setTableSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // ----- التحميل -----
  const loadPeople = useCallback(async () => {
    try {
      const [courseList, employeeList, departmentList] = await Promise.all([
        listAllCourses(),
        listEmployees(),
        listDepartments(),
      ])
      setCourses(courseList)
      setEmployees(employeeList)
      setDepartments(departmentList)
      setLoadError('')
    } catch (err) {
      console.error('Assignments loadPeople error:', err)
      setLoadError(err.message || 'Failed to load data.')
    }
  }, [])

  const loadAssignments = useCallback(async () => {
    try {
      const [list, progressRes] = await Promise.all([
        listAssignments(),
        supabase.from('course_progress').select('employee_id, course_id, progress_percent'),
      ])
      const map = {}
      ;(progressRes.data || []).forEach((p) => {
        map[keyOf(p.employee_id, p.course_id)] = Number(p.progress_percent || 0)
      })
      setProgressMap(map)
      setAssignments(list)
    } catch (err) {
      console.error('Assignments loadAssignments error:', err)
      setAssignments((prev) => prev ?? [])
    }
  }, [])

  useEffect(() => {
    loadPeople()
    loadAssignments()

    // تحديث تلقائي عند أي تغيير (موظف جديد / إدارة / كورس / تعيين / تقدم)
    let timer = null
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        loadPeople()
        loadAssignments()
      }, 600)
    }

    const channel = supabase.channel('assignments-live')
    LIVE_TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
    })
    channel.subscribe()

    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [loadPeople, loadAssignments])

  // ----- بيانات مشتقة -----
  const deptMap = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d.name])),
    [departments]
  )

  // اسم إدارة الموظف: من جدول departments (department_id) وإلا من النص المحفوظ في الموظف
  const getDeptName = useCallback(
    (emp) => (emp && (deptMap[emp.department_id] || emp.department)) || '',
    [deptMap]
  )

  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees]
  )

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c])),
    [courses]
  )

  const publishedCourses = useMemo(
    () => courses.filter(isPublished).sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [courses]
  )

  // الموظفون المؤهلون للتعيين: دور employee وحسابهم نشط
  const eligible = useMemo(
    () => employees.filter((e) => e.role === 'employee' && e.is_active !== false),
    [employees]
  )

  // كل الإدارات: القايمة المرجعية (نفس فورم إضافة موظف) + جدول departments + أي إدارة عند الموظفين
  const departmentOptions = useMemo(() => {
    const names = new Set(DEPARTMENTS_LIST)
    departments.forEach((d) => d?.name && names.add(d.name))
    employees.forEach((e) => {
      const n = getDeptName(e)
      if (n) names.add(n)
    })
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        count: eligible.filter((e) => getDeptName(e) === name).length,
      }))
  }, [departments, employees, eligible, getDeptName])

  const assignedToCourse = useMemo(
    () =>
      new Set(
        (assignments || []).filter((a) => a.course_id === courseId).map((a) => a.employee_id)
      ),
    [assignments, courseId]
  )

  // المستهدفون من التعيين الحالي (الجدد فقط يتم إدخالهم، والمعيّنين مسبقاً يتم تخطيهم)
  const targets = useMemo(() => {
    let list = []
    if (mode === 'individual') list = eligible.filter((e) => selectedEmployees.has(e.id))
    else if (mode === 'department') list = eligible.filter((e) => selectedDepts.has(getDeptName(e)))
    else list = eligible

    const all = list.map((e) => e.id)
    const fresh = all.filter((id) => !assignedToCourse.has(id))
    return { all, fresh, skipped: all.length - fresh.length }
  }, [mode, eligible, selectedEmployees, selectedDepts, assignedToCourse, getDeptName])

  const pickerList = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    return eligible.filter((e) => {
      if (pickerDept && getDeptName(e) !== pickerDept) return false
      if (!q) return true
      return [e.full_name, e.email, e.employee_id].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    })
  }, [eligible, pickerSearch, pickerDept, getDeptName])

  // صفوف جدول التعيينات بعد دمجها مع بيانات الموظف والكورس والتقدم
  const rows = useMemo(() => {
    const today = todayISO()
    return (assignments || [])
      .map((a) => {
        const emp = employeeMap[a.employee_id] || a.employee || {}
        const course = courseMap[a.course_id] || a.course || {}
        const percent = progressMap[keyOf(a.employee_id, a.course_id)] ?? 0
        const rawStatus = String(a.status || '').toLowerCase()
        const done = rawStatus === 'completed' || percent >= 100
        const overdue = !done && a.due_date && String(a.due_date).slice(0, 10) < today

        let status = 'assigned'
        if (done) status = 'completed'
        else if (overdue) status = 'overdue'
        else if (percent > 0 || rawStatus === 'in_progress') status = 'in_progress'

        return {
          id: a.id,
          employeeName: emp.full_name || emp.email || '—',
          employeeCode: emp.employee_id || '',
          department: getDeptName(emp),
          courseName: course.name || '—',
          dueDate: a.due_date ? String(a.due_date).slice(0, 10) : '',
          mandatory: !!a.is_mandatory,
          percent: done ? 100 : Math.min(Math.max(percent, 0), 100),
          status,
          sortDate: a.assigned_date || a.created_at || '',
        }
      })
      .sort((x, y) => String(y.sortDate).localeCompare(String(x.sortDate)))
  }, [assignments, employeeMap, courseMap, progressMap, getDeptName])

  const stats = useMemo(
    () => ({
      total: rows.length,
      completed: rows.filter((r) => r.status === 'completed').length,
      inProgress: rows.filter((r) => r.status === 'in_progress').length,
      overdue: rows.filter((r) => r.status === 'overdue').length,
    }),
    [rows]
  )

  const filteredRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false
      if (deptFilter && r.department !== deptFilter) return false
      if (!q) return true
      return [r.employeeName, r.employeeCode, r.courseName].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    })
  }, [rows, tableSearch, statusFilter, deptFilter])

  // إعادة ضبط عدد الصفوف الظاهرة عند تغيير الفلاتر
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [tableSearch, statusFilter, deptFilter])

  // ----- أفعال -----
  const toggleEmployee = (id) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleDept = (name) => {
    setSelectedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const selectAllShown = () => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev)
      pickerList.forEach((e) => {
        if (!assignedToCourse.has(e.id)) next.add(e.id)
      })
      return next
    })
  }

  const clearSelection = () => setSelectedEmployees(new Set())

  const submit = async (e) => {
    e.preventDefault()
    setFeedback(null)

    if (!courseId) {
      setFeedback({ type: 'error', text: 'Please select a course first.' })
      return
    }
    if (dueDate && dueDate < todayISO()) {
      setFeedback({ type: 'error', text: 'Due date cannot be in the past.' })
      return
    }
    if (targets.all.length === 0) {
      const hint =
        mode === 'individual'
          ? 'Select at least one employee.'
          : mode === 'department'
            ? 'Select at least one department that has active employees.'
            : 'There are no active employees to assign to.'
      setFeedback({ type: 'error', text: hint })
      return
    }
    if (targets.fresh.length === 0) {
      setFeedback({ type: 'info', text: 'All selected employees already have this course assigned.' })
      return
    }

    setBusy(true)
    try {
      await assignCourse({
        courseId,
        employeeIds: targets.fresh,
        assignedBy: profile?.id,
        dueDate,
        mandatory,
      })

      const courseName = courseMap[courseId]?.name || 'the course'
      const skippedNote = targets.skipped > 0 ? ` (${targets.skipped} already assigned, skipped)` : ''
      setFeedback({
        type: 'success',
        text: `Assigned "${courseName}" to ${targets.fresh.length} employee(s)${skippedNote}.`,
      })
      setSelectedEmployees(new Set())
      setSelectedDepts(new Set())
      await loadAssignments()
    } catch (err) {
      console.error('assignCourse error:', err)
      setFeedback({ type: 'error', text: err.message || 'Failed to assign the course.' })
    } finally {
      setBusy(false)
    }
  }

  if (!assignments) return <Spinner />

  const feedbackClass =
    feedback?.type === 'success'
      ? 'text-teal'
      : feedback?.type === 'error'
        ? 'text-danger'
        : 'text-muted'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-muted mt-1">
          Assign courses to specific employees, to whole departments, or company-wide. Every assignment feeds the reports automatically.
        </p>
      </div>

      {loadError && (
        <div className="text-sm text-danger bg-danger-light border border-danger-light rounded px-3 py-2">
          {loadError}
        </div>
      )}

      {/* ---------- فورم التعيين ---------- */}
      <form onSubmit={submit} className="card p-5 space-y-5 max-w-3xl">
        <div>
          <label className="label">Course</label>
          <select className="input" required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Select a published course…</option>
            {publishedCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.course_code ? ` (${c.course_code})` : ''}
              </option>
            ))}
          </select>
          {publishedCourses.length === 0 && (
            <p className="text-xs text-muted mt-1">No published courses yet. Publish a course from Course Management first.</p>
          )}
        </div>

        <div>
          <label className="label">Assign to</label>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  mode === m.id
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-black/30 text-gray-300 border-white/10 hover:bg-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- اختيار موظفين محددين ---- */}
        {mode === 'individual' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                className="input flex-1 min-w-[180px]"
                placeholder="Search by name, email or employee ID…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
              <select className="input w-56" value={pickerDept} onChange={(e) => setPickerDept(e.target.value)}>
                <option value="">All departments</option>
                {departmentOptions.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {selectedEmployees.size} selected · {pickerList.length} shown
              </span>
              <span className="space-x-3">
                <button type="button" className="text-teal hover:underline" onClick={selectAllShown}>
                  Select all shown
                </button>
                <button type="button" className="text-teal hover:underline" onClick={clearSelection}>
                  Clear
                </button>
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto border border-white/10 rounded-lg divide-y divide-white/5">
              {pickerList.length === 0 ? (
                <p className="p-3 text-sm text-muted">No employees match your search.</p>
              ) : (
                pickerList.map((emp) => {
                  const already = assignedToCourse.has(emp.id)
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 px-3 py-2 text-sm ${
                        already ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={already}
                        checked={selectedEmployees.has(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                      />
                      <span className="font-medium text-white">{emp.full_name || emp.email}</span>
                      <span className="text-muted text-xs">
                        {emp.employee_id ? `ID ${emp.employee_id} · ` : ''}
                        {getDeptName(emp) || 'No department'}
                      </span>
                      {already && <span className="ml-auto text-xs text-muted">Already assigned</span>}
                    </label>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ---- اختيار إدارات ---- */}
        {mode === 'department' && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              {selectedDepts.size} department(s) selected. The number in brackets is the active employees count.
            </p>
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
              {departmentOptions.map((d) => {
                const active = selectedDepts.has(d.name)
                const empty = d.count === 0
                return (
                  <button
                    type="button"
                    key={d.name}
                    disabled={empty}
                    title={empty ? 'No active employees in this department' : ''}
                    onClick={() => toggleDept(d.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-black/30 text-gray-300 border-white/10 hover:bg-white/10'
                    } ${empty ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {d.name} ({d.count})
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {mode === 'all' && (
          <p className="text-sm text-muted">
            The course will be assigned to all {eligible.length} active employee(s).
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Due date</label>
            <input
              className="input"
              type="date"
              min={todayISO()}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
              Mandatory
            </label>
          </div>
        </div>

        {courseId && targets.all.length > 0 && (
          <p className="text-sm text-muted">
            {targets.all.length} employee(s) targeted · <span className="text-white">{targets.fresh.length} new</span>
            {targets.skipped > 0 ? ` · ${targets.skipped} already assigned (will be skipped)` : ''}
          </p>
        )}

        {feedback && <p className={`text-sm ${feedbackClass}`}>{feedback.text}</p>}

        <button className="btn-primary" disabled={busy || !courseId}>
          {busy ? 'Assigning…' : 'Assign course'}
        </button>
      </form>

      {/* ---------- جدول التعيينات ---------- */}
      <section className="space-y-4">
        <h2 className="font-head font-semibold text-lg">All assignments</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="In progress" value={stats.inProgress} />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard label="Overdue" value={stats.overdue} danger />
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1 min-w-[200px]"
            placeholder="Search by employee, ID or course…"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
          />
          <select className="input w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <select className="input w-56" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All departments</option>
            {departmentOptions.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Course</th>
                <th className="px-4 py-2 font-medium">Due date</th>
                <th className="px-4 py-2 font-medium w-40">Progress</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-muted">
                    No assignments found.
                  </td>
                </tr>
              ) : (
                filteredRows.slice(0, visibleCount).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-white">{r.employeeName}</p>
                      {r.employeeCode && <p className="text-xs text-muted">ID: {r.employeeCode}</p>}
                    </td>
                    <td className="px-4 py-2 text-muted">{r.department || '—'}</td>
                    <td className="px-4 py-2">
                      {r.courseName}
                      {r.mandatory && <span className="ml-2 text-xs text-muted">· Mandatory</span>}
                    </td>
                    <td className="px-4 py-2">{r.dueDate || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ProgressBar percent={r.percent} />
                        </div>
                        <span className="text-xs text-muted w-9 text-right">{r.percent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={r.status === 'overdue' ? 'danger' : statusTone(r.status)}>
                        {r.status.replace('_', ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > visibleCount && (
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              Showing {visibleCount} of {filteredRows.length}
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            >
              Show more
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
