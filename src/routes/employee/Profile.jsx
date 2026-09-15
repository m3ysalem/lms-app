import React, { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { Spinner } from '../../components/Ui'

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (profile) {
      const rawName = profile.full_name || profile.name || ''
      if (!rawName || rawName.toLowerCase().includes('emp')) {
        const emailPrefix = profile.email?.split('@')[0]
        setFullName(emailPrefix && !emailPrefix.toLowerCase().includes('emp') ? emailPrefix : '')
      } else {
        setFullName(rawName)
      }
      setPhone(profile.phone || '')
    }
  }, [profile])

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner label="Loading profile..." />
      </div>
    )
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    try {
      // تحديث بيانات البروفايل في جدول profiles بدون تداخل
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName.trim(), 
          phone: phone.trim() 
        })
        .eq('id', profile.id)

      if (profileErr) {
        throw new Error(profileErr.message)
      }

      // تحديث كلمة المرور إذا تم إدخالها
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
      console.error('Profile update error:', err)
      setErrorMsg(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const rows = [
    ['Employee ID', profile.employee_code || '—'],
    ['Email', profile.email || '—'],
    ['Department', profile.department?.name || '—'],
    ['Job title', profile.job_title?.title || '—'],
    ['Hire date', profile.hire_date || '—'],
    ['Employment status', profile.employment_status || 'Active'],
    ['Location', profile.location || '—'],
  ]

  return (
    <div className="max-w-xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-gray-400 mt-1 text-sm">Manage your personal information and account settings.</p>
      </div>

      <form onSubmit={handleSaveProfile} className="p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl shadow-xl space-y-4">
        <h2 className="font-semibold text-lg border-b border-white/10 pb-2">Edit Details</h2>
        
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-300" htmlFor="fullName">Full Name</label>
          <input 
            id="fullName" 
            className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            placeholder="Enter your real name (e.g. Mohamed Ahmed)"
            required 
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-300" htmlFor="phone">Phone Number</label>
          <input 
            id="phone" 
            className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            placeholder="+20 10 000 0000" 
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-300" htmlFor="password">New Password (optional)</label>
          <input 
            id="password" 
            type="password"
            className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" 
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
            placeholder="Leave blank to keep current password" 
          />
        </div>

        {errorMsg && <div className="text-sm text-rose-400 font-medium">{errorMsg}</div>}

        <div className="flex items-center gap-3 pt-2">
          <button className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#9E1B1B] to-rose-700 text-white font-medium disabled:opacity-50 shadow-lg shadow-red-950/50" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-emerald-400 font-medium">Profile updated successfully!</span>}
        </div>
      </form>

      <div className="p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl shadow-xl space-y-3">
        <h2 className="font-semibold text-base text-gray-400">Official HR Information</h2>
        <div className="divide-y divide-white/10">
          {rows.map(([label, value]) => (
            <div key={label} className="py-2.5 flex justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="text-white font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
