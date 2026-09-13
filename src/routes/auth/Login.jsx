import React, { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

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
    const loginIdentifier = rawInput.includes('@')
      ? rawInput
      : `${rawInput}@alesraa.com`

    try {
      const { error } = await signIn(loginIdentifier, password)
      setBusy(false)
      if (error) {
        setError(
          error.message === 'Invalid login credentials'
            ? 'Employee ID / Email or password is incorrect.'
            : error.message
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
    <div className="min-h-screen flex bg-[#0d0f12] overflow-hidden">
      {/* Left Banner Section - Clean & Minimalist */}
      <div className="hidden md:flex w-7/12 relative text-white flex-col justify-between p-12 overflow-hidden border-r border-white/5 bg-cover bg-center" style={{ backgroundImage: `url('/company-bg.jpg')` }}>
        
        {/* Dark Overlay for depth & visibility */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />

        {/* Brand Header Only */}
        <div className="relative z-20 flex items-center gap-4">
          <div className="bg-white/95 p-2.5 rounded-2xl shadow-xl shadow-black/40 backdrop-blur-md border border-white/20">
            <img 
              src="/logo.png" 
              alt="ALESRAA PHARMACEUTICALS" 
              className="h-9 w-auto object-contain"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>
          <div>
            <span className="font-head font-black text-xl tracking-wider text-white block">
              ALESRAA
            </span>
            <span className="text-[10px] text-gray-300 tracking-[0.2em] font-medium block uppercase">
              Pharmaceuticals LMS
            </span>
          </div>
        </div>

        {/* Empty Center Space to let background image shine */}
        <div className="relative z-20 my-auto" />

        {/* Footer */}
        <div className="relative z-20 flex items-center justify-between text-xs text-gray-400 border-t border-white/10 pt-6">
          <p>© {new Date().getFullYear()} ALESRAA PHARMACEUTICALS.</p>
          <p className="text-gray-400">Optima LMS v2.5</p>
        </div>
      </div>

      {/* Right Form Section */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0d0f12] text-white">
        <div className="w-full max-w-md bg-[#161a1e] p-8 sm:p-10 rounded-3xl border border-white/5 shadow-2xl shadow-black/80">
          <div className="mb-8">
            <h2 className="font-head text-3xl font-black text-white mb-2">Welcome Back</h2>
            <p className="text-sm text-gray-400">Enter your credentials to access your portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-gray-300 uppercase mb-2" htmlFor="email">
                Employee ID or Email
              </label>
              <input
                id="email"
                type="text"
                required
                className="w-full px-4 py-3.5 rounded-xl bg-[#0d0f12] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#9E1B1B] focus:ring-1 focus:ring-[#9E1B1B] transition-all"
                placeholder="e.g. 1001 or admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-gray-300 uppercase mb-2" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="w-full px-4 py-3.5 rounded-xl bg-[#0d0f12] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#9E1B1B] focus:ring-1 focus:ring-[#9E1B1B] transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={remember} 
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-white/10 bg-[#0d0f12] text-[#9E1B1B] focus:ring-0"
                />
                Remember me
              </label>
              <a 
                href="#" 
                className="text-sm text-rose-500 hover:text-rose-400 font-medium transition-colors" 
                onClick={(e) => { e.preventDefault(); alert('Ask your HR/L&D admin to reset your password from the Employees page.') }}
              >
                Forgot password?
              </a>
            </div>

            {error && (
              <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={busy} 
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#9E1B1B] to-rose-700 hover:from-rose-700 hover:to-[#9E1B1B] text-white font-bold tracking-wide shadow-lg shadow-red-950/50 transition-all duration-300 disabled:opacity-50 mt-2"
            >
              {busy ? 'Signing in…' : 'Sign in to Dashboard'}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-8 pt-6 border-t border-white/5">
            Default Password: <span className="text-gray-300 font-mono">1234</span>
          </p>
        </div>
      </div>
    </div>
  )
}
