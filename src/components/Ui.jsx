import React from 'react'

export function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-surface text-ink-700 border-surface-border',
    success: 'bg-teal-light text-teal-dark border-teal-light',
    warning: 'bg-amber-light text-amber border-amber-light',
    danger: 'bg-danger-light text-danger border-danger-light',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${tones[tone]}`}>
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
  const barColor = tone === 'danger' ? 'bg-danger' : 'bg-teal'
  return (
    <div className="w-full h-2 bg-surface-border rounded overflow-hidden" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${barColor} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 text-muted text-sm py-8 justify-center">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </div>
  )
}

export function KpiCard({ label, value, sub, tone = 'default' }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-head font-bold text-ink-800 mt-1">{value}</p>
      {sub && <p className={`text-xs mt-1 ${tone === 'danger' ? 'text-danger' : 'text-muted'}`}>{sub}</p>}
    </div>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-head font-semibold text-ink-800">{title}</p>
      {body && <p className="text-sm text-muted mt-1 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
