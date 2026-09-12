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
    <div className="min-h-screen flex bg-[#f4f6f9]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#14171A] text-white shrink-0 shadow-2xl border-r border-white/10">
        {/* Logo Section */}
        <div className="px-6 py-6 border-b border-white/10 flex items-center gap-3.5 bg-[#101214]">
          <div className="bg-white p-2 rounded-xl shrink-0 shadow-lg">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-8 w-auto object-contain" 
              onError={(e) => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
          <div>
            <p className="font-head font-extrabold text-base leading-tight tracking-wide text-white">Al-Esraa</p>
            <p className="text-[10px] text-[#9E1B1B] font-bold tracking-widest uppercase mt-0.5">Optima</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  isActive 
                    ? 'bg-[#9E1B1B] text-white shadow-lg shadow-[#9E1B1B]/40 translate-x-1' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Profile & Logout Box */}
        <div className="p-4 m-3 rounded-xl bg-white/5 border border-white/10 shadow-inner">
          <p className="text-sm font-bold truncate text-white">{profile?.full_name}</p>
          <p className="text-xs text-white/40 truncate mb-3">{profile?.employee_code || profile?.email}</p>
          <button 
            onClick={handleSignOut} 
            className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-[#9E1B1B] text-xs text-white transition-all text-center font-bold tracking-wide border border-white/10 shadow-sm"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-[#14171A] text-white flex items-center justify-between px-4 py-3 border-b border-white/10 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="bg-white p-1.5 rounded-lg shrink-0">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-6 w-auto object-contain" 
              onError={(e) => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
          <div>
            <p className="font-head font-bold text-sm leading-tight">Al-Esraa</p>
            <p className="text-[9px] text-[#9E1B1B] uppercase tracking-wider font-bold">Optima</p>
          </div>
        </div>
        <button onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu" className="p-2 rounded-lg bg-white/10 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed top-14 inset-x-0 z-20 bg-[#14171A] text-white px-3 py-4 max-h-[80vh] overflow-y-auto border-b border-white/10 shadow-2xl space-y-1.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive ? 'bg-[#9E1B1B] text-white shadow' : 'text-white/70 hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="pt-3 mt-3 border-t border-white/10">
            <button 
              onClick={handleSignOut} 
              className="block w-full py-2.5 px-3 text-center rounded-xl bg-[#9E1B1B] text-white text-sm font-bold shadow-md"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 pt-16 md:pt-0 bg-[#f4f6f9]">
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
