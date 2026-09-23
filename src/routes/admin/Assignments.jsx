import React, { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listAllCourses, listEmployees, listDepartments, assignCourse, listAssignments } from '../../lib/api'
import { Badge, statusTone, Spinner } from '../../components/Ui'

export default function Assignments() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState([])
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [assignments, setAssignments] = useState(null)

  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState('individual') // individual | department | all
  const [selectedEmployees, setSelectedEmployees] = useState(new Set())
  const [departmentId, setDepartmentId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [mandatory, setMandatory] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = () => listAssignments().then(setAssignments)

  useEffect(() => {
    listAllCourses().then((c) => setCourses(c.filter((x) => x.status === 'published')))
    listEmployees().then(setEmployees)
    listDepartments().then(setDepartments)
    refresh()
  }, [])

  const toggleEmployee = (id) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!courseId) return
    setBusy(true)
    setMessage('')
    let targetIds = []
    if (mode === 'individual') targetIds = Array.from(selectedEmployees)
    else if (mode === 'department') targetIds = employees.filter((emp) => emp.department_id === departmentId).map((e) => e.id)
    else targetIds = employees.filter((e) => e.role === 'employee').map((e) => e.id)

    if (targetIds.length === 0) {
      setMessage('Select at least one employee, department, or "all employees".')
      setBusy(false)
      return
    }

    await assignCourse({ courseId, employeeIds: targetIds, assignedBy: profile.id, dueDate, mandatory })
    setMessage(`Assigned to ${targetIds.length} employee(s).`)
    setSelectedEmployees(new Set())
    setBusy(false)
    refresh()
  }

  if (!assignments) return <Spinner />

  // عمل خريطة للأقسام لسهولة عرض اسم القسم بجانب الموظف بدقة
  const deptMap = departments.reduce((acc, d) => ({ ...acc, [d.id]: d.name }), {})

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-muted mt-1">Assign courses to employees individually, by department, or company-wide.</p>
      </div>

      <form onSubmit={submit} className="card p-5 space-y-4 max-w-2xl">
        <div>
          <label className="label">Course</label>
          <select className="input" required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Select a course…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          {['individual', 'department', 'all'].map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded text-sm font-medium border ${mode === m ? 'bg-ink-800 text-white border-ink-800' : 'bg-white border-surface-border'}`}
            >
              {m === 'individual' ? 'Select employees' : m === 'department' ? 'By department' : 'All employees'}
            </button>
          ))}
        </div>

        {mode === 'individual' && (
          <div className="max-h-48 overflow-y-auto border border-surface-border rounded p-2 space-y-1">
            {employees.filter((e) => e.role === 'employee').map((emp) => (
              <label key={emp.id} className="flex items-center gap-2 text-sm px-1 py-0.5 cursor-pointer">
                <input type="checkbox" checked={selectedEmployees.has(emp.id)} onChange={() => toggleEmployee(emp.id)} />
                <span className="font-medium text-white">{emp.full_name || emp.email}</span> 
                <span className="text-muted">· {deptMap[emp.department_id] || 'No Department'}</span>
              </label>
            ))}
          </div>
        )}

        {mode === 'department' && (
          <select className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Select department…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Due date</label>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
              Mandatory
            </label>
          </div>
        </div>

        {message && <p className="text-sm text-teal">{message}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Assigning…' : 'Assign course'}</button>
      </form>

      <section>
        <h2 className="font-head font-semibold text-lg mb-3">All assignments</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Course</th>
                <th className="px-4 py-2 font-medium">Due date</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-medium text-white">{a.employee?.full_name || a.employee?.email || '—'}</td>
                  <td className="px-4 py-2">{a.course?.name || '—'}</td>
                  <td className="px-4 py-2">{a.due_date || '—'}</td>
                  <td className="px-4 py-2"><Badge tone={statusTone(a.status)}>{a.status ? a.status.replace('_', ' ') : 'assigned'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
