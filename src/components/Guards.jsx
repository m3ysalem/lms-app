import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './Ui'

export function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  
  // لو لسه بيحمّل لفترة قصيرة نظهر الـ Spinner، ولو الجلسة موجودة بنعدي فوراً
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading..." />
      </div>
    )
  }

  // لو مفيش جلسة (Session)، يروح فوراً لصفحة تسجيل الدخول بدل التعليق
  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}

export function RequireAdmin({ children }) {
  const { profile, loading, session } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // لو مفيش جلسة أساساً، رجعه لصفحة تسجيل الدخول
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // لو البروفايل لسه محملش أو الصلاحية مش أدمن، وجهه للرئيسية بدل التعليق
  if (!profile || !['super_admin', 'hr_admin'].includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
