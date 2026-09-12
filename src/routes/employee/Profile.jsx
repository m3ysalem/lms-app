import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!profile) return null

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    try {
      // 1. تحديث بيانات البروفايل (الاسم والرقم)
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone })
        .eq('id', profile.id)

      if (profileErr) throw profileErr

      // 2. تحديث كلمة المرور إذا قام أدخل كلمة جديدة
      if (newPassword.trim()) {
        const { error: pwdErr } = await supabase.auth.updateUser({
          password: newPassword.trim(),
        })
        if (pwdErr) throw pwdErr
        setNewPassword('')
      }

      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const rows = [
    ['Employee ID', profile.employee_code],
    ['Email', profile.email],
    ['Department', profile.department?.name || '—'],
    ['Job title', profile.job_title?.title || '—'],
    ['Hire date', profile.hire_date || '—'],
    ['Employment status', profile.employment_status],
    ['Location', profile.location || '—'],
  ]

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted mt-1">Manage your personal information and account settings.</p>
      </div>

      {/* Editable Information Form */}
      <form onSubmit={handleSaveProfile} className="card p-5 space-y-4">
        <h2 className="font-semibold text-lg border-b border-surface-border pb-2">Edit Details</h2>
        
        <div>
          <label className="label block mb-1 text-sm font-medium" htmlFor="fullName">Full Name</label>
          <input 
            id="fullName" 
            className="input w-full p-2.5 border rounded-lg bg-surface border-surface-border" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            required 
          />
        </div>

        <div>
          <label className="label block mb-1 text-sm font-medium" htmlFor="phone">Phone Number</label>
          <input 
            id="phone" 
            className="input w-full p-2.5 border rounded-lg bg-surface border-surface-border" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            placeholder="+20 10 000 0000" 
          />
        </div>

        <div>
          <label className="label block mb-1 text-sm font-medium" htmlFor="password">New Password (optional)</label>
          <input 
            id="password" 
            type="password"
            className="input w-full p-2.5 border rounded-lg bg-surface border-surface-border" 
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
            placeholder="Leave blank to keep current password" 
          />
        </div>

        {errorMsg && <div className="text-sm text-red-500 font-medium">{errorMsg}</div>}

        <div className="flex items-center gap-3 pt-2">
          <button className="btn-primary px-5 py-2 rounded-lg bg-teal text-white font-medium disabled:opacity-50" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-teal font-medium">Profile updated successfully!</span>}
        </div>
      </form>

      {/* Official HR Record (Read-Only) */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-base text-muted">Official HR Information</h2>
        <div className="divide-y divide-surface-border">
          {rows.map(([label, value]) => (
            <div key={label} className="py-2.5 flex justify-between text-sm">
              <span className="text-muted">{label}</span>
              <span className="text-ink-800 font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
