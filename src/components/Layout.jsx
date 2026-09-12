import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const combinedNav = [
  { to: '/admin', label: 'Admin Dashboard', end: true },
  { to: '/admin/employees', label: 'Employees', end: true },
  { to: '/admin/courses', label: 'Manage Courses', end: true },
  { to: '/admin/assignments', label: 'Assignments', end: true },
  { to: '/', label: 'Employee Dashboard', end: true },
  { to: '/courses', label: 'Browse Courses', end: true },
  { to: '/my-learning', label: 'My Learning', end: true },
  { to: '/certificates', label: 'Certificates', end: true },
  { to: '/profile', label: 'Profile', end: true },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'hr_admin' || profile?.email === 'admin@alesraa.net'
  
  const employeeNav = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/courses', label: 'Courses', end: true },
    { to: '/my-learning', label: 'My Learning', end: true },
    { to: '/certificates', label: 'Certificates', end: true },
    { to: '/profile', label: 'Profile', end: true },
  ]

  const nav = isAdmin ? combinedNav : employeeNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-ink-800 text-white shrink-0 shadow-2xl border-r border-white/5">
        <div className="px-6 py-6 border-b border-white/10 flex items-center gap-3 bg-ink-900/40">
          <div className="bg-white p-2 rounded-xl shrink-0 shadow-md ring-2 ring-teal/20">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-7 w-auto object-contain" 
              onError={(e) => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
          <div>
            <p className="font-head font-bold text-base leading-tight tracking-wide text-white">Al-Esraa</p>
            <p className="text-[10px] text-teal-light font-semibold tracking-widest uppercase mt-0.5">Pharmaceutical Optima</p>
          </div>
        </div>
        <nav className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-teal text-white shadow-md shadow-teal/30 translate-x-1' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 m-3 rounded-xl bg-ink-900/60 border border-white/10 shadow-inner">
          <p className="text-sm font-semibold truncate text-white">{profile?.full_name}</p>
          <p className="text-xs text-muted truncate mb-3">{profile?.employee_code || profile?.email}</p>
          <button 
            onClick={handleSignOut} 
            className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-teal hover:text-white text-xs text-white/80 transition-all text-center font-medium border border-white/10"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-ink-800 text-white flex items-center justify-between px-4 py-3 border-b border-white/10 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="bg-white p-1.5 rounded-lg shrink-0 shadow-sm">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-6 w-auto object-contain" 
              onError={(e) => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
          <div>
            <p className="font-head font-bold text-sm leading-tight">Al-Esraa</p>
            <p className="text-[9px] text-teal-light uppercase tracking-wider">Optima</p>
          </div>
        </div>
        <button onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu" className="p-1.5 rounded-lg bg-white/10 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed top-14 inset-x-0 z-20 bg-ink-800 text-white px-3 py-4 max-h-[80vh] overflow-y-auto border-b border-white/10 shadow-2xl space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'bg-teal text-white shadow' : 'text-white/70 hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="pt-3 mt-3 border-t border-white/10">
            <button 
              onClick={handleSignOut} 
              className="block w-full py-2 px-3 text-center rounded-lg bg-teal/20 text-white text-sm font-medium border border-teal/30"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-16 md:pt-0 bg-surface">
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
