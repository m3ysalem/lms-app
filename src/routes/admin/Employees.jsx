import React, { useEffect, useState, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabaseClient'
import { listEmployees, updateEmployee, createEmployee as createEmployeeAccount, setEmployeePassword } from '../../lib/api'
import { Badge, Spinner } from '../../components/Ui'

const emptyForm = { 
  employee_id: '', 
  full_name: '', 
  phone: '', 
  email: '', 
  role: 'employee', 
  department: '', 
  job_title: '', 
  hire_date: '', 
  password: 'Password123!' 
}

const DEPARTMENTS_LIST = [
  'Promotion',
  'Finance',
  'Sales & Distribution',
  'HR',
  'Supply Chain',
  'Registration',
  'IT',
  'Commercial & Compliance',
  'Marketing & Business Development',
  'R&D',
  'Management',
  'QA',
  'Production',
  'Pharmacovigilance',
  'Engineering',
  'Events & Conferences',
  'QC',
  'Odoo',
  'New Products On-Boarding',
  'Digital Marketing'
]

export default function Employees() {
  const [employees, setEmployees] = useState(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)

  const refresh = () => listEmployees({ search }).then(setEmployees)

  useEffect(() => { refresh() }, [search]) // eslint-disable-line

  const createEmployee = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (!form.employee_id || !form.employee_id.trim()) {
        throw new Error('Employee ID is required / كود الموظف إلزامي لتسجيل الدخول')
      }

      const finalEmail = form.email && form.email.trim() !== '' 
        ? form.email.trim() 
        : `emp_${form.employee_id.trim()}@alesraa.com`

      const finalPassword = form.password || 'Password123!'

      // إنشاء المستخدم في Authentication بباسورد حقيقي + صف البروفايل في public.profiles
      // (يتم عبر Edge Function آمنة، فلا تتأثر جلسة الأدمن الحالية)
      await createEmployeeAccount({
        email: finalEmail,
        password: finalPassword,
        full_name: form.full_name,
        role: form.role,
        employee_id: form.employee_id.trim(),
        phone: form.phone || null,
        department: form.department || null,
        job_title: form.job_title || null,
        hire_date: form.hire_date || null,
      })

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

  // تم تحديث دالة الحذف لتحاول مسح المستخدم من الـ Auth عبر دالة RPC أو الحذف المباشر المتاح
  const deleteEmployee = async (emp) => {
    if (!window.confirm(`Are you sure you want to delete employee: ${emp.full_name}?`)) {
      return
    }

    try {
      // 1. محاولة حذف المستخدم من جدول auth باستخدام دالة RPC (إذا كنت قد أنشأتها في قاعدة البيانات) أو الحذف من البروفايل
      const { error: rpcError } = await supabase.rpc('delete_user_by_id', { target_user_id: emp.id })
      
      // لو مفيش RPC مخصص، نقوم بالحذف المباشر من جدول profiles (والذي سيمنع ظهوره في اللوحة)
      if (rpcError) {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', emp.id)

        if (error) throw error
      }

      // تحديث القائمة بعد الحذف بنجاح
      refresh()
    } catch (err) {
      alert('Failed to delete employee: ' + err.message)
    }
  }

  const resetPassword = async (emp) => {
    if (!emp.email || (emp.email.includes('@alesraa.com') && emp.email.startsWith('emp_'))) {
      alert('This user does not have a real external email registered.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(emp.email)
    if (error) alert(error.message)
    else alert(`Password reset email sent to ${emp.email}.`)
  }

  const setPassword = async (emp) => {
    const newPassword = window.prompt(`New password for ${emp.full_name} (min 6 characters):`)
    if (newPassword === null) return
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters.')
      return
    }
    try {
      await setEmployeePassword(emp.id, newPassword)
      alert(`Password updated for ${emp.full_name}.`)
    } catch (err) {
      alert('Failed to set password: ' + err.message)
    }
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
            const empId = row['Employee ID'].toString().trim()
            const rowEmail = row['Email']?.trim() || `emp_${empId}@alesraa.com`
            const rowPassword = row['Password'] || 'Password123!'

            // إنشاء المستخدم في Authentication بباسورد حقيقي + صف البروفايل (عبر Edge Function)
            await createEmployeeAccount({
              email: rowEmail,
              password: rowPassword,
              full_name: row['Name'],
              role: row['Role'] || 'employee',
              employee_id: empId,
              phone: row['Phone'] || null,
              department: row['Department'] || null,
              job_title: row['Job Title'] || null,
              hire_date: row['Hire Date'] || null,
            })

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
        </div>
      )}

      {showForm && (
        <form onSubmit={createEmployee} className="card p-5 space-y-3 max-w-xl">
          <h2 className="font-head font-semibold text-lg">New Employee</h2>
          {error && <div className="text-sm text-danger bg-danger-light border border-danger-light rounded px-3 py-2">{error}</div>}
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Employee ID / كود الموظف *</label>
              <input className="input" required placeholder="e.g. 1005" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
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
              <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">— Select —</option>
                {DEPARTMENTS_LIST.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Job Title / المسمى الوظيفي</label>
              <input className="input" type="text" placeholder="e.g. Software Engineer" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
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
                <td className="px-4 py-2">{e.department || e.department?.name || '—'}</td>
                <td className="px-4 py-2">{e.job_title || '—'}</td>
                <td className="px-4 py-2"><Badge>{e.role.replace('_', ' ')}</Badge></td>
                <td className="px-4 py-2">
                  <Badge tone={e.is_active ? 'success' : 'danger'}>{e.is_active ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="px-4 py-2 space-x-3 whitespace-nowrap">
                  <button className="text-teal text-xs hover:underline" onClick={() => setPassword(e)}>Set password</button>
                  <button className="text-teal text-xs hover:underline" onClick={() => resetPassword(e)}>Reset password</button>
                  <button className="text-danger text-xs hover:underline" onClick={() => toggleActive(e)}>
                    {e.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                  {/* زرار الحذف */}
                  <button className="text-red-600 text-xs hover:underline font-semibold" onClick={() => deleteEmployee(e)}>
                    Delete
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
