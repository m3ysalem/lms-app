import React, { useEffect, useState, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabaseClient'
import { listEmployees, listDepartments, listJobTitles, updateEmployee } from '../../lib/api'
import { Badge, Spinner } from '../../components/Ui'

const emptyForm = { 
  employee_id: '', 
  full_name: '', 
  phone: '', 
  email: '', 
  role: 'employee', 
  department_id: '', 
  job_title_id: '', 
  hire_date: '', 
  password: 'Password123!' 
}

export default function Employees() {
  const [employees, setEmployees] = useState(null)
  const [departments, setDepartments] = useState([])
  const [jobTitles, setJobTitles] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)

  const refresh = () => listEmployees({ search }).then(setEmployees)

  useEffect(() => { refresh() }, [search]) // eslint-disable-line
  useEffect(() => {
    listDepartments().then(setDepartments)
    listJobTitles().then(setJobTitles)
  }, [])

  const createEmployee = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const finalEmail = form.email.trim() !== '' 
        ? form.email.trim() 
        : `emp_${form.employee_id || Date.now()}@alesraa.com`

      // استدعاء دالة الـ RPC المحدثة لإنشاء المستخدم في الـ Auth و Profiles معاً
      const { error: rpcError } = await supabase.rpc('admin_create_employee', {
        p_email: finalEmail,
        p_password: form.password || 'Password123!',
        p_employee_id: form.employee_id || null,
        p_full_name: form.full_name,
        p_role: form.role
      })

      if (rpcError) throw rpcError

      setSaving(false)
      setShowForm(false)
      setForm(emptyForm)
      refresh()
    } catch (err) {
      setSaving(false)
      setError(err.message || 'Failed to create employee.')
    }
  }

  const toggleActive = async (emp) => {
    await updateEmployee(emp.id, { is_active: !emp.is_active })
    refresh()
  }

  const resetPassword = async (emp) => {
    if (!emp.email || emp.email.includes('@alesraa.com') && emp.email.startsWith('emp_')) {
      alert('This user does not have a real email registered. You can update their password directly from Supabase if needed.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(emp.email)
    if (error) alert(error.message)
    else alert(`Password reset email sent to ${emp.email}.`)
  }

  const handleCsvImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        const errors = []
        let success = 0
        for (const row of rows) {
          if (!row['Name'] || !row['Employee ID']) {
            errors.push(`Skipped row — missing Name or Employee ID: ${JSON.stringify(row)}`)
            continue
          }
          
          try {
            const rowEmail = row['Email']?.trim() || `emp_${row['Employee ID']}@alesraa.com`
            const { error: rpcError } = await supabase.rpc('admin_create_employee', {
              p_email: rowEmail,
              p_password: row['Password'] || 'Password123!',
              p_employee_id: row['Employee ID'],
              p_full_name: row['Name'],
              p_role: row['Role'] || 'employee'
            })
            if (rpcError) throw rpcError
            success++
          } catch (err) {
            errors.push(`${row['Employee ID']}: ${err.message}`)
          }
        }
        setImportResult({ success, errors })
        refresh()
        if (fileRef.current) fileRef.current.value = ''
      },
    })
  }

  if (!employees) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-muted mt-1">{employees.length} employees</p>
        </div>
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer">
            Import CSV
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
          </label>
          <button className="btn-primary" onClick={() => setShowForm(true)}>Add employee</button>
        </div>
      </div>

      <input className="input max-w-xs" placeholder="Search by name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {importResult && (
        <div className="card p-4 text-sm">
          <p className="font-medium">Import complete: {importResult.success} created, {importResult.errors.length} errors.</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 text-danger list-disc pl-5 space-y-1">
              {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <p className="text-muted mt-2">Expected columns: Employee ID, Name, Phone, Email, Department, Job Title, Hire Date, Role, Password</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={createEmployee} className="card p-5 space-y-3 max-w-xl">
          <h2 className="font-head font-semibold text-lg">New Employee</h2>
          {error && <div className="text-sm text-danger bg-danger-light border border-danger-light rounded px-3 py-2">{error}</div>}
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Employee ID / كود الموظف *</label>
              <input className="input" required placeholder="e.g. 1003" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
            </div>
            <div>
              <label className="label">Full Name / الاسم الكامل *</label>
              <input className="input" required placeholder="e.g. Mohamed Ali" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone Number / رقم الموبايل</label>
              <input className="input" type="tel" placeholder="010xxxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email / البريد الإلكتروني (اختياري)</label>
              <input className="input" type="email" placeholder="Optional" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Password / كلمة المرور *</label>
              <input className="input" type="text" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password123!" />
            </div>
            <div>
              <label className="label">Role / الصلاحية *</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Employee</option>
                <option value="trainer">Trainer</option>
                <option value="hr_admin">HR / L&D Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Department / الإدارة</label>
              <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">— Select —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Job Title / المسمى الوظيفي</label>
              <select className="input" value={form.job_title_id} onChange={(e) => setForm({ ...form, job_title_id: e.target.value })}>
                <option value="">— Select —</option>
                {jobTitles.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Hire Date / تاريخ التعيين</label>
              <input className="input" type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-2 pt-3">
            <button className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create employee'}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2 font-medium">Job Title</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2">
                  <p className="font-medium text-ink-800">{e.full_name}</p>
                  <p className="text-xs text-muted">ID: {e.employee_id || '—'} {e.email && !e.email.startsWith('emp_') ? `· ${e.email}` : ''}</p>
                </td>
                <td className="px-4 py-2 text-xs">{e.phone || '—'}</td>
                <td className="px-4 py-2">{e.department?.name || '—'}</td>
                <td className="px-4 py-2">{e.job_title?.title || '—'}</td>
                <td className="px-4 py-2"><Badge>{e.role.replace('_', ' ')}</Badge></td>
                <td className="px-4 py-2">
                  <Badge tone={e.is_active ? 'success' : 'danger'}>{e.is_active ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="px-4 py-2 space-x-3 whitespace-nowrap">
                  <button className="text-teal text-xs hover:underline" onClick={() => resetPassword(e)}>Reset password</button>
                  <button className="text-danger text-xs hover:underline" onClick={() => toggleActive(e)}>
                    {e.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
