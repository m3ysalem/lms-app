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
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'That email or password is incorrect.'
        : error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen flex">
      {/* Side Branding Section */}
      <div className="hidden md:flex w-1/2 bg-ink-800 text-white flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-lg inline-block">
            <img 
              src="/logo.png" 
              alt="ALESRAA PHARMACEUTICALS" 
              className="h-10 w-auto object-contain"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>
          <span className="font-head font-bold text-lg tracking-wide text-white">
            ALESRAA PHARMACEUTICALS
          </span>
        </div>

        <div>
          <h1 className="font-head text-4xl font-bold leading-tight max-w-sm">
            Training that keeps your whole company moving forward.
          </h1>
          <p className="text-white/60 mt-4 max-w-sm">
            Assign courses, track completion, and issue certificates — all in one place.
          </p>
        </div>

        <p className="text-white/40 text-sm">
          © {new Date().getFullYear()} ALESRAA PHARMACEUTICALS. All rights reserved.
        </p>
      </div>

      {/* Login Form Section */}
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="font-head text-2xl font-bold text-ink-800 mb-1">Sign in</h2>
          <p className="text-sm text-muted mb-6">Use your company email and password.</p>

          <label className="label" htmlFor="email">Email or Employee ID</label>
          <input
            id="email"
            type="email"
            required
            className="input mb-4"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            className="input mb-3"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex items-center justify-between mb-5">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            <a 
              href="#" 
              className="text-sm text-teal hover:underline font-medium" 
              onClick={(e) => { e.preventDefault(); alert('Ask your HR/L&D admin to reset your password from the Employees page.') }}
            >
              Forgot password?
            </a>
          </div>

          {error && (
            <div className="mb-4 text-sm text-danger bg-danger-light border border-danger-light rounded px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full bg-teal hover:bg-teal-dark transition-colors">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-xs text-muted mt-6">
            Test accounts: admin@demo-lms.test · hr@demo-lms.test · emp1@demo-lms.test — see README for passwords.
          </p>
        </form>
      </div>
    </div>
  )
}
