import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!profile) return null

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({ phone }).eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const rows = [
    ['Employee ID', profile.employee_code],
    ['Full name', profile.full_name],
    ['Email', profile.email],
    ['Department', profile.department?.name || '—'],
    ['Job title', profile.job_title?.title || '—'],
    ['Hire date', profile.hire_date || '—'],
    ['Employment status', profile.employment_status],
    ['Location', profile.location || '—'],
  ]

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My profile</h1>
        <p className="text-muted mt-1">Your HR record. Contact HR/L&D to update anything besides your phone number.</p>
      </div>

      <div className="card divide-y divide-surface-border">
        {rows.map(([label, value]) => (
          <div key={label} className="px-4 py-3 flex justify-between text-sm">
            <span className="text-muted">{label}</span>
            <span className="text-ink-800 font-medium">{value}</span>
          </div>
        ))}
      </div>

      <form onSubmit={save} className="card p-4 space-y-3">
        <label className="label" htmlFor="phone">Phone number</label>
        <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20 10 000 0000" />
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        {saved && <span className="text-sm text-teal ml-3">Saved.</span>}
      </form>
    </div>
  )
}
