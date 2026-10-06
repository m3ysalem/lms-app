import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const MIN_LENGTH = 8
// كلمات المرور الافتراضية/الشائعة التي لا يُسمح بها
const BLOCKED_PASSWORDS = ['password123!', 'password123', 'password', '123456', '12345678', 'qwerty123']

const getStrength = (pwd) => {
  if (!pwd) return { score: 0, label: '', color: 'bg-white/10', text: 'text-gray-400' }
  let score = 0
  if (pwd.length >= MIN_LENGTH) score++
  if (pwd.length >= 12) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-400' }
  if (score === 3) return { score: 2, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-400' }
  if (score === 4) return { score: 3, label: 'Good', color: 'bg-emerald-500', text: 'text-emerald-400' }
  return { score: 4, label: 'Strong', color: 'bg-emerald-400', text: 'text-emerald-300' }
}

function PasswordInput({ id, label, value, onChange, autoFocus = false }) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label className="block text-xs font-semibold tracking-wider text-gray-200 uppercase mb-1.5" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoFocus={autoFocus}
          autoComplete="new-password"
          className="w-full px-4 py-3.5 pr-16 rounded-xl bg-[#0d0f12]/70 border border-white/15 text-white placeholder-gray-500 focus:outline-none focus:border-[#9E1B1B] focus:ring-1 focus:ring-[#9E1B1B] transition-all text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
    </div>
  )
}

// شاشة إجبارية لتغيير كلمة المرور الافتراضية عند أول دخول (تظهر بدل الموقع حتى يتم التغيير)
export default function ForcePasswordChange({ fullName, onDone, onSignOut }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const strength = useMemo(() => getStrength(newPassword), [newPassword])

  const rules = useMemo(
    () => [
      { id: 'len', label: `At least ${MIN_LENGTH} characters`, ok: newPassword.length >= MIN_LENGTH },
      { id: 'letter', label: 'Contains a letter', ok: /[A-Za-z]/.test(newPassword) },
      { id: 'number', label: 'Contains a number', ok: /\d/.test(newPassword) },
      {
        id: 'default',
        label: 'Not the default or a common password',
        ok: !!newPassword && !BLOCKED_PASSWORDS.includes(newPassword.toLowerCase()),
      },
      { id: 'match', label: 'Both passwords match', ok: !!newPassword && newPassword === confirmPassword },
    ],
    [newPassword, confirmPassword]
  )

  const canSubmit = rules.every((r) => r.ok)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError('')

    try {
      const { error: pwdErr } = await supabase.auth.updateUser({ password: newPassword })

      // لو كلمة المرور اتغيّرت في محاولة سابقة وفشل الجزء التاني، نكمل بدل ما نعلّق المستخدم
      const alreadyChanged = pwdErr && /different from the old password/i.test(pwdErr.message || '')
      if (pwdErr && !alreadyChanged) throw pwdErr

      const { error: flagErr } = await supabase.rpc('clear_must_change_password')
      if (flagErr) throw new Error(flagErr.message)

      await onDone()
    } catch (err) {
      console.error('Force password change error:', err)
      setError(err.message || 'Failed to update the password. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-6 py-10 overflow-hidden bg-[#0d0f12]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('/company-bg.jpg')` }} />
      <div className="absolute inset-0 bg-[#0d0f12]/60 backdrop-blur-[6px]" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#9E1B1B]/35 rounded-full blur-[130px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-8 sm:p-10 rounded-[2rem] bg-[#14181d]/92 border border-white/15 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-md text-white">
        <div className="text-center flex flex-col items-center mb-6">
          <div className="p-4 rounded-2xl shadow-2xl border border-gray-200 mb-4 flex items-center justify-center bg-white">
            <img
              src="/logo.png"
              alt="ALESRAA PHARMACEUTICALS"
              className="h-9 w-auto object-contain"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>
          <h1 className="font-head text-2xl font-black">Set your new password</h1>
          <p className="text-sm text-gray-300 mt-2">
            {fullName ? `Welcome, ${fullName}. ` : 'Welcome. '}
            For your security, you must replace your default password before continuing.
          </p>
          <p className="text-sm text-gray-400 mt-1" dir="rtl">
            لأسباب أمنية، يجب تغيير كلمة المرور الافتراضية قبل الدخول إلى الموقع.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput id="fp-new" label="New password" value={newPassword} onChange={setNewPassword} autoFocus />

          {newPassword && (
            <div className="space-y-1" aria-live="polite">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div key={level} className={`h-1.5 flex-1 rounded-full ${level <= strength.score ? strength.color : 'bg-white/10'}`} />
                ))}
              </div>
              <p className={`text-xs font-medium ${strength.text}`}>Strength: {strength.label}</p>
            </div>
          )}

          <PasswordInput id="fp-confirm" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />

          <ul className="space-y-1 text-xs">
            {rules.map((rule) => (
              <li key={rule.id} className={rule.ok ? 'text-emerald-400' : 'text-gray-500'}>
                {rule.ok ? '✓' : '○'} {rule.label}
              </li>
            ))}
          </ul>

          {error && (
            <div role="alert" className="text-xs text-rose-400 bg-rose-500/15 border border-rose-500/30 rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#9E1B1B] to-rose-700 hover:from-rose-700 hover:to-[#9E1B1B] text-white font-bold text-sm tracking-wide shadow-lg shadow-red-950/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Updating…' : 'Update password & continue'}
          </button>

          <button type="button" onClick={onSignOut} disabled={busy} className="w-full text-xs text-gray-400 hover:text-white underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
