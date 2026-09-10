import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './Ui'

export function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner label="Signing you in…" /></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

export function RequireAdmin({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
  if (!profile || !['super_admin', 'hr_admin'].includes(profile.role)) {
    return <Navigate to="/" replace />
  }
  return children
}
