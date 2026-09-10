import React, { useEffect, useState, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabaseClient'
import { listEmployees, listDepartments, listJobTitles, updateEmployee } from '../../lib/api'
import { Badge, Spinner } from '../../components/Ui'

const emptyForm = { email: '', full_name: '', role: 'employee', department_id: '', job_title_id: '', hire_date: '' }

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
    const { data, error } = await supabase.functions.invoke('admin-create-employee', { body: form })
    setSaving(false)
    if (error) {
      setError(error.message || 'Failed to create employee. Is the admin-create-employee edge function deployed?')
      return
    }
    setShowForm(false)
    setForm(emptyForm)
    refresh()
  }

  const toggleActive = async (emp) => {
    await updateEmployee(emp.id, { is_active: !emp.is_active })
    refresh()
  }

  const resetPassword = async (emp) => {
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
          if (!row['Email'] || !row['Name']) {
            errors.push(`Skipped row — missing Email or Name: ${JSON.stringify(row)}`)
            continue
          }
          const dept = departments.find((d) => d.name.toLowerCase() === (row['Department'] || '').toLowerCase())
          const { error } = await supabase.functions.invoke('admin-create-employee', {
            body: {
              email: row['Email'],
              full_name: row['Name'],
              department_id: dept?.id,
              hire_date: row['Hire Date'] || null,
              role: 'employee',
            },
          })
          if (error) errors.push(`${row['Email']}: ${error.message}`)
          else success++
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

      <input className="input max-w-xs" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {importResult && (
        <div className="card p-4 text-sm">
          <p className="font-medium">Import complete: {importResult.success} created, {importResult.errors.length} errors.</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 text-danger list-disc pl-5 space-y-1">
              {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <p className="text-muted mt-2">Expected columns: Employee ID, Name, Email, Department, Section, Job Title, Manager, Hire Date, Status</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={createEmployee} className="card p-5 space-y-3 max-w-lg">
          <h2 className="font-head font-semibold">New employee</h2>
          {error && <div className="text-sm text-danger bg-danger-light border border-danger-light rounded px-3 py-2">{error}</div>}
          <div>
            <label className="label">Full name</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Employee</option>
                <option value="trainer">Trainer</option>
                <option value="hr_admin">HR / L&D Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Job title</label>
              <select className="input" value={form.job_title_id} onChange={(e) => setForm({ ...form, job_title_id: e.target.value })}>
                <option value="">—</option>
                {jobTitles.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Hire date</label>
              <input className="input" type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create employee'}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2 font-medium">Job title</th>
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
                  <p className="text-xs text-muted">{e.employee_code} · {e.email}</p>
                </td>
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
