import React from 'react'

export function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-white/10 text-gray-200 border-white/10',
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    danger: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border backdrop-blur-md ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function statusTone(status) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in_progress':
    case 'started':
      return 'default'
    case 'overdue':
      return 'danger'
    case 'assigned':
      return 'warning'
    default:
      return 'default'
  }
}

export function ProgressBar({ percent = 0, tone = 'teal' }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const barColor = tone === 'danger' ? 'bg-rose-500' : 'bg-gradient-to-r from-rose-600 to-rose-400'
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-md" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${barColor} transition-all duration-500 rounded-full`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 text-gray-400 text-sm py-12 justify-center">
      <svg className="animate-spin h-5 w-5 text-rose-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <span className="font-medium">{label}</span>
    </div>
  )
}

export function KpiCard({ label, value, sub, tone = 'default' }) {
  return (
    <div className="p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl shadow-xl">
      <p className="text-sm text-gray-400 font-medium">{label}</p>
      <p className="text-3xl font-head font-black text-white mt-1.5">{value}</p>
      {sub && <p className={`text-xs mt-1.5 font-medium ${tone === 'danger' ? 'text-rose-400' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="p-10 rounded-3xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl text-center shadow-xl">
      <p className="font-head font-bold text-lg text-white">{title}</p>
      {body && <p className="text-sm text-gray-400 mt-1.5 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
