import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const employeeNav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/courses', label: 'Courses' },
  { to: '/my-learning', label: 'My Learning' },
  { to: '/certificates', label: 'Certificates' },
  { to: '/profile', label: 'Profile' },
]

const adminNav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/employees', label: 'Employees' },
  { to: '/admin/courses', label: 'Courses' },
  { to: '/admin/assignments', label: 'Assignments' },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'hr_admin' || profile?.email === 'admin@alesraa.net'
  const nav = isAdmin ? adminNav : employeeNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-ink-800 text-white shrink-0">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          {/* Logo Addition */}
          <div className="bg-white/95 p-1.5 rounded-lg shrink-0 shadow-sm">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-7 w-auto object-contain" 
              onError={(e) => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
          <div>
            <p className="font-head font-bold text-base leading-snug">Al-Esraa</p>
            <p className="text-[10px] text-white/50 tracking-wider uppercase">Pharmaceutical Optima</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive ? 'bg-teal text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <p className="text-sm font-medium truncate">{profile?.full_name}</p>
          <p className="text-xs text-white/50 truncate mb-2">{profile?.employee_code}</p>
          <button onClick={handleSignOut} className="text-xs text-white/70 hover:text-white underline">
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-ink-800 text-white flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="bg-white/95 p-1 rounded shrink-0">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-6 w-auto object-contain" 
              onError={(e) => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
          <p className="font-head font-bold text-sm">Al-Esraa Optima</p>
        </div>
        <button onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu" className="p-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed top-12 inset-x-0 z-20 bg-ink-800 text-white px-2 pb-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm font-medium ${isActive ? 'bg-teal text-white' : 'text-white/70'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button onClick={handleSignOut} className="block w-full text-left px-3 py-2 text-sm text-white/70">
            Sign out
          </button>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
