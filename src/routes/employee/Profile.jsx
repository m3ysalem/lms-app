import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { Spinner } from '../../components/Ui'

// ---------- ثوابت وأدوات التحقق ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const DEFAULT_PASSWORD = 'Password123!'
const MIN_PASSWORD_LENGTH = 8

const normalizePhone = (value) => value.replace(/[\s()-]/g, '')

const validateFullName = (value) =>
  value.trim().length >= 2 ? '' : 'Full name must be at least 2 characters.'

const validatePhone = (value) => {
  if (!value.trim()) return ''
  return /^\+?\d{8,15}$/.test(normalizePhone(value.trim()))
    ? ''
    : 'Enter a valid phone number (8–15 digits, e.g. +20 10 1234 5678).'
}

const validateEmail = (value) => {
  if (!value.trim()) return ''
  return EMAIL_RE.test(value.trim()) ? '' : 'Enter a valid email address.'
}

const getPasswordStrength = (pwd) => {
  if (!pwd) return { score: 0, label: '', color: 'bg-white/10', text: 'text-gray-400' }
  let score = 0
  if (pwd.length >= MIN_PASSWORD_LENGTH) score++
  if (pwd.length >= 12) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-400' }
  if (score === 3) return { score: 2, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-400' }
  if (score === 4) return { score: 3, label: 'Good', color: 'bg-emerald-500', text: 'text-emerald-400' }
  return { score: 4, label: 'Strong', color: 'bg-emerald-400', text: 'text-emerald-300' }
}

const formatRole = (role) =>
  String(role || 'employee')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

const getInitials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?'

// ---------- مكونات صغيرة ----------
const inputClass =
  'w-full p-2.5 border rounded-lg bg-black/40 text-white focus:outline-none transition-colors'

function Alert({ feedback }) {
  if (!feedback) return null
  const styles = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    error: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  }
  return (
    <div
      role={feedback.type === 'error' ? 'alert' : 'status'}
      className={`text-sm font-medium rounded-lg border px-3 py-2 ${styles[feedback.type] || styles.error}`}
    >
      {feedback.text}
    </div>
  )
}

function Field({ id, label, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block mb-1 text-sm font-medium text-gray-300">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}

function PasswordField({ id, label, value, onChange, autoComplete, placeholder }) {
  const [visible, setVisible] = useState(false)
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`${inputClass} pr-16 border-white/10 focus:border-rose-500`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </Field>
  )
}

const cardClass =
  'p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl shadow-xl'

export default function Profile() {
  const { profile, user, refreshProfile } = useAuth()

  // ----- بيانات شخصية -----
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsFeedback, setDetailsFeedback] = useState(null)

  // ----- تغيير كلمة المرور -----
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState(null)

  // ----- أسماء الإدارة والوظيفة (من الجداول المرجعية) -----
  const [lookups, setLookups] = useState({ department: '', jobTitle: '' })

  // مزامنة الفورم مع البروفايل. الاعتماد على قيم بسيطة (وليس الكائن) حتى لا يُعاد ضبط ما يكتبه المستخدم
  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name || '')
    setPhone(profile.phone || '')
    setContactEmail(profile.contact_email || '')
    setFieldErrors({})
  }, [profile?.id, profile?.full_name, profile?.phone, profile?.contact_email]) // eslint-disable-line

  useEffect(() => {
    let cancelled = false
    async function loadLookups() {
      try {
        const [dept, job] = await Promise.all([
          profile?.department_id
            ? supabase.from('departments').select('name').eq('id', profile.department_id).maybeSingle()
            : Promise.resolve({ data: null }),
          profile?.job_title_id
            ? supabase.from('job_titles').select('*').eq('id', profile.job_title_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        if (cancelled) return
        setLookups({
          department: dept.data?.name || '',
          jobTitle: job.data?.title || job.data?.name || '',
        })
      } catch (err) {
        console.warn('Profile lookups failed:', err)
      }
    }
    loadLookups()
    return () => {
      cancelled = true
    }
  }, [profile?.department_id, profile?.job_title_id])

  // إخفاء رسائل النجاح تلقائياً
  useEffect(() => {
    if (detailsFeedback?.type !== 'success') return
    const t = setTimeout(() => setDetailsFeedback(null), 4000)
    return () => clearTimeout(t)
  }, [detailsFeedback])

  useEffect(() => {
    if (passwordFeedback?.type !== 'success') return
    const t = setTimeout(() => setPasswordFeedback(null), 4000)
    return () => clearTimeout(t)
  }, [passwordFeedback])

  const isDirty = useMemo(() => {
    if (!profile) return false
    return (
      fullName.trim() !== (profile.full_name || '') ||
      phone.trim() !== (profile.phone || '') ||
      contactEmail.trim().toLowerCase() !== (profile.contact_email || '').toLowerCase()
    )
  }, [profile, fullName, phone, contactEmail])

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword])

  const passwordRules = useMemo(
    () => [
      { id: 'len', label: `At least ${MIN_PASSWORD_LENGTH} characters`, ok: newPassword.length >= MIN_PASSWORD_LENGTH },
      { id: 'letter', label: 'Contains a letter', ok: /[A-Za-z]/.test(newPassword) },
      { id: 'number', label: 'Contains a number', ok: /\d/.test(newPassword) },
      {
        id: 'diff',
        label: 'Different from the current and default password',
        ok: !!newPassword && newPassword !== currentPassword && newPassword !== DEFAULT_PASSWORD,
      },
      { id: 'match', label: 'Both new passwords match', ok: !!newPassword && newPassword === confirmPassword },
    ],
    [newPassword, currentPassword, confirmPassword]
  )

  const canChangePassword = !!currentPassword && passwordRules.every((r) => r.ok)

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner label="Loading profile..." />
      </div>
    )
  }

  // ---------- حفظ البيانات الشخصية ----------
  const handleSaveDetails = async (e) => {
    e.preventDefault()
    setDetailsFeedback(null)

    const errors = {
      fullName: validateFullName(fullName),
      phone: validatePhone(phone),
      contactEmail: validateEmail(contactEmail),
    }
    setFieldErrors(errors)
    if (Object.values(errors).some(Boolean)) return

    setSavingDetails(true)
    try {
      const { error } = await supabase.rpc('update_my_profile', {
        new_name: fullName.trim(),
        new_phone: phone.trim(),
        new_contact_email: contactEmail.trim().toLowerCase(),
      })
      if (error) throw new Error(error.message)

      await refreshProfile()
      setDetailsFeedback({ type: 'success', text: 'Your details were updated successfully.' })
    } catch (err) {
      console.error('Profile update error:', err)
      setDetailsFeedback({ type: 'error', text: err.message || 'Failed to update your details.' })
    } finally {
      setSavingDetails(false)
    }
  }

  const handleResetDetails = () => {
    setFullName(profile.full_name || '')
    setPhone(profile.phone || '')
    setContactEmail(profile.contact_email || '')
    setFieldErrors({})
    setDetailsFeedback(null)
  }

  // ---------- تغيير كلمة المرور ----------
  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordFeedback(null)

    if (!canChangePassword) {
      setPasswordFeedback({ type: 'error', text: 'Please complete all password requirements first.' })
      return
    }

    const loginEmail = user?.email || profile.email
    if (!loginEmail) {
      setPasswordFeedback({ type: 'error', text: 'Could not determine your account email. Please sign in again.' })
      return
    }

    setSavingPassword(true)
    try {
      // 1) التحقق من كلمة المرور الحالية
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: currentPassword,
      })
      if (verifyError) throw new Error('Your current password is incorrect.')

      // 2) تحديث كلمة المرور في Authentication
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordFeedback({ type: 'success', text: 'Password changed successfully. Use it the next time you sign in.' })
    } catch (err) {
      console.error('Password change error:', err)
      setPasswordFeedback({ type: 'error', text: err.message || 'Failed to change your password.' })
    } finally {
      setSavingPassword(false)
    }
  }

  const infoRows = [
    ['Employee ID', profile.employee_id || profile.employee_code || '—'],
    ['Login', user?.email || profile.email || '—'],
    ['Department', lookups.department || profile.department || '—'],
    ['Job title', lookups.jobTitle || profile.job_title || '—'],
    ['Role', formatRole(profile.role)],
    ['Hire date', formatDate(profile.hire_date)],
    ['Account status', profile.is_active === false ? 'Inactive' : 'Active'],
  ]

  return (
    <div className="max-w-2xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-gray-400 mt-1 text-sm">Manage your personal information and account security.</p>
      </div>

      {/* ---------- بطاقة التعريف ---------- */}
      <div className={`${cardClass} flex items-center gap-4`}>
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#9E1B1B] to-rose-700 flex items-center justify-center text-lg font-bold shadow-lg shadow-red-950/50">
          {getInitials(profile.full_name)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-lg truncate">{profile.full_name || 'Unnamed user'}</p>
          <p className="text-sm text-gray-400 truncate">
            {formatRole(profile.role)} · ID {profile.employee_id || profile.employee_code || '—'}
          </p>
        </div>
      </div>

      {/* ---------- البيانات الشخصية ---------- */}
      <form onSubmit={handleSaveDetails} noValidate className={`${cardClass} space-y-4`}>
        <h2 className="font-semibold text-lg border-b border-white/10 pb-2">Personal details</h2>

        <Field id="fullName" label="Full name" error={fieldErrors.fullName}>
          <input
            id="fullName"
            className={`${inputClass} ${fieldErrors.fullName ? 'border-rose-500' : 'border-white/10 focus:border-rose-500'}`}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Mohamed Ahmed"
            autoComplete="name"
          />
        </Field>

        <Field id="phone" label="Phone number" error={fieldErrors.phone} hint="Include the country code if possible, e.g. +20 10 1234 5678.">
          <input
            id="phone"
            type="tel"
            className={`${inputClass} ${fieldErrors.phone ? 'border-rose-500' : 'border-white/10 focus:border-rose-500'}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+20 10 000 0000"
            autoComplete="tel"
          />
        </Field>

        <Field
          id="contactEmail"
          label="Contact email"
          error={fieldErrors.contactEmail}
          hint="Used by HR to contact you. Your sign-in details do not change."
        >
          <input
            id="contactEmail"
            type="email"
            className={`${inputClass} ${fieldErrors.contactEmail ? 'border-rose-500' : 'border-white/10 focus:border-rose-500'}`}
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
          />
        </Field>

        <Alert feedback={detailsFeedback} />

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#9E1B1B] to-rose-700 text-white font-medium disabled:opacity-50 shadow-lg shadow-red-950/50"
            disabled={savingDetails || !isDirty}
          >
            {savingDetails ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={handleResetDetails}
            disabled={savingDetails || !isDirty}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm disabled:opacity-40"
          >
            Reset
          </button>
          {isDirty && !savingDetails && <span className="text-xs text-amber-400">Unsaved changes</span>}
        </div>
      </form>

      {/* ---------- الأمان وكلمة المرور ---------- */}
      <form onSubmit={handleChangePassword} className={`${cardClass} space-y-4`}>
        <h2 className="font-semibold text-lg border-b border-white/10 pb-2">Security · Change password</h2>

        <PasswordField
          id="currentPassword"
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />

        <PasswordField
          id="newPassword"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
        />

        {newPassword && (
          <div className="space-y-1" aria-live="polite">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-1.5 flex-1 rounded-full ${level <= strength.score ? strength.color : 'bg-white/10'}`}
                />
              ))}
            </div>
            <p className={`text-xs font-medium ${strength.text}`}>Strength: {strength.label}</p>
          </div>
        )}

        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />

        <ul className="space-y-1 text-xs">
          {passwordRules.map((rule) => (
            <li key={rule.id} className={rule.ok ? 'text-emerald-400' : 'text-gray-500'}>
              {rule.ok ? '✓' : '○'} {rule.label}
            </li>
          ))}
        </ul>

        <Alert feedback={passwordFeedback} />

        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#9E1B1B] to-rose-700 text-white font-medium disabled:opacity-50 shadow-lg shadow-red-950/50"
          disabled={savingPassword || !canChangePassword}
        >
          {savingPassword ? 'Updating…' : 'Update password'}
        </button>
      </form>

      {/* ---------- بيانات الموارد البشرية ---------- */}
      <div className={`${cardClass} space-y-3`}>
        <h2 className="font-semibold text-base text-gray-400">Official HR information</h2>
        <div className="divide-y divide-white/10">
          {infoRows.map(([label, value]) => (
            <div key={label} className="py-2.5 flex justify-between gap-4 text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="text-white font-medium text-right break-all">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">These details are managed by HR. Contact your HR team to change them.</p>
      </div>
    </div>
  )
}
