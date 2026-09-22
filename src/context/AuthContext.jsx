import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// تعديل دالة التنظيف لتأخذ القيمة من عمود full_name مباشرة دون أي تغيير
function getCleanName(dbName, email, employeeId) {
  if (dbName) return dbName // لو الاسم موجود في عمود full_name، خده زي ما هو تماماً
  
  // الاحتياطيات القديمة في حال كان الحقل فاضي
  if (employeeId) {
    return String(employeeId)
  }
  return email?.split('@')[0] || 'User'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (user) => {
    if (!user?.id) {
      setProfile(null)
      setLoading(false)
      return
    }
    
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      // استخراج كود الموظف من الجدول (سواء كان employee_id أو employee_code)
      const empCode = data?.employee_id || data?.employee_code

      // استخراج الاسم وتمريره لدالة التنظيف المعدلة ليأخذ full_name كما هو
      const rawDbName = data?.full_name || data?.name || user.user_metadata?.full_name
      const cleanedName = getCleanName(rawDbName, user.email, empCode)

      if (error || !data) {
        data = {
          id: user.id,
          email: user.email,
          full_name: cleanedName,
          role: 'employee',
        }
      } else {
        data.full_name = cleanedName
      }

      setProfile(data)
    } catch (err) {
      console.error('Error loading profile:', err)
      setProfile({
        id: user.id,
        email: user.email,
        full_name: getCleanName(null, user.email, null),
        role: 'employee',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      if (session?.user) {
        loadProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? 'employee',
    loading,
    signIn,
    signOut,
    refreshProfile: () => session?.user && loadProfile(session.user),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
