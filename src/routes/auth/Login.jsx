import React, { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

export default function Login() {
  const { signIn, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    const rawInput = email.trim()
    let loginIdentifier = rawInput

    try {
      if (!rawInput.includes('@')) {
        // محاولة البحث المباشر في الجدول أولاً كبديل أو التأكد من دالة الـ RPC
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('email')
          .eq('employee_id', rawInput)
          .maybeSingle()

        console.log("Direct Profile Lookup:", { profileData, profileErr });

        if (profileData && profileData.email) {
          loginIdentifier = profileData.email.trim()
        } else {
          // لو فشل البحث المباشر، جرب الـ RPC
          const { data: emailData, error: rpcErr } = await supabase
            .rpc('get_email_by_employee_id', { emp_id: rawInput })

          console.log("RPC Lookup Result:", { emailData, rpcErr });

          if (rpcErr || !emailData) {
            setBusy(false)
            setError('كود الموظف غير مسجل أو غير صحيح في النظام.')
            return
          }
          loginIdentifier = emailData.trim()
        }
      }

      console.log("Final Login Identifier sent to Supabase:", loginIdentifier);

      const { error: signErr } = await signIn(loginIdentifier, password)
      setBusy(false)
      
      if (signErr) {
        setError(
          signErr.message === 'Invalid login credentials'
            ? 'Employee ID / Email or password is incorrect.'
            : signErr.message
        )
        return
      }
      navigate('/')
    } catch (err) {
      setBusy(false)
      setError(err.message || 'An unexpected error occurred.')
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#0d0f12] overflow-hidden bg-cover bg-center" style={{ backgroundImage: `url('/company-bg.jpg')` }}>
      <div className="absolute inset-0 bg-[#0d0f12]/80 backdrop-blur-md" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#9E1B1B]/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-rose-950/30 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg mx-4 p-8 sm:p-12 rounded-[2.5rem] bg-[#14181d]/90 border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl text-white">
        <div className="text-center flex flex-col items-center mb-8">
          <div className="px-6 py-3.5 rounded-2xl shadow-2xl border border-white mb-4 flex items-center justify-center" style={{ backgroundColor: '#ffffff', opacity: 1 }}>
            <img src="/logo.png" alt="ALESRAA PHARMACEUTICALS" className="h-10 w-auto object-contain" onError={(e) => { e.target.style.display = 'none' }} />
          </div>
          <span className="font-head font-black text-xl tracking-wider text-white block mb-1">ALESRAA PHARMACEUTICALS</span>
          <span className="text-xs text-rose-400 font-semibold tracking-[0.25em] uppercase">Optima Learning Management System</span>
        </div>

        <div className="mb-6 text-center">
          <h2 className="font-head text-2xl font-black text-white mb-1">Welcome Back</h2>
          <p className="text-xs text-gray-400">Enter your credentials to access your portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-300 uppercase mb-1.5" htmlFor="email">Employee ID or Email</label>
            <input
              id="email"
              type="text"
              required
              className="w-full px-4 py-3.5 rounded-xl bg-[#0d0f12]/80 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#9E1B1B] focus:ring-1 focus:ring-[#9E1B1B] transition-all text-sm"
              placeholder="e.g. 1001 or admin@alesraa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-300 uppercase mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              className="w-full px-4 py-3.5 rounded-xl bg-[#0d0f12]/80 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#9E1B1B] focus:ring-1 focus:ring-[#9E1B1B] transition-all text-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-white/10 bg-[#0d0f12] text-[#9E1B1B] focus:ring-0" />
              Remember me
            </label>
            <a href="#" className="text-rose-500 hover:text-rose-400 font-medium transition-colors" onClick={(e) => { e.preventDefault(); alert('Ask your HR/L&D admin to reset your password from the Employees page.') }}>Forgot password?</a>
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{error}</div>
          )}

          <button type="submit" disabled={busy} className="w-full py-4 rounded-xl bg-gradient-to-r from-[#9E1B1B] to-rose-700 hover:from-rose-700 hover:to-[#9E1B1B] text-white font-bold text-sm tracking-wide shadow-lg shadow-red-950/50 transition-all duration-300 disabled:opacity-50 mt-2">
            {busy ? 'Signing in…' : 'Sign in to Dashboard'}
          </button>
        </form>

        <div className="text-center mt-6 pt-5 border-t border-white/5 text-[11px] text-gray-500 flex justify-between items-center">
          <span>Default Password: <strong className="text-gray-300 font-mono">1234</strong></span>
          <span>© {new Date().getFullYear()} ALESRAA</span>
        </div>
      </div>
    </div>
  )
}
