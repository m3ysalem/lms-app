import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './Ui'

export function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0f12]">
        <Spinner label="Loading..." />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}

export function RequireAdmin({ children }) {
  const { profile, loading, session } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0f12]">
        <Spinner />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!profile || !['super_admin', 'hr_admin'].includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
