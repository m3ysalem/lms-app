import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import ForcePasswordChange from '../components/ForcePasswordChange'

const AuthContext = createContext(null)

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

      if (error || !data) {
        // لو مفيش بروفايل، ننشئ كائن افتراضي بالاسم من الإيميل
        data = {
          id: user.id,
          email: user.email,
          full_name: user.email?.split('@')[0] || 'User',
          role: 'employee',
        }
      } else {
        // نضمن تماماً إن الـ full_name ياخد القيمة اللي راجعة من العمود الحقيقي في الجدول
        data.full_name = data.full_name || user.email?.split('@')[0] || 'User'
      }

      setProfile(data)
    } catch (err) {
      console.error('Error loading profile:', err)
      setProfile({
        id: user.id,
        email: user.email,
        full_name: user.email?.split('@')[0] || 'User',
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

  const refreshProfile = () => session?.user && loadProfile(session.user)

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? 'employee',
    loading,
    signIn,
    signOut,
    refreshProfile,
  }

  // أول دخول (أو بعد إعادة تعيين الباسورد من الأدمن): إجبار تغيير كلمة المرور قبل عرض الموقع
  const mustChangePassword = !!session && profile?.must_change_password === true
  // أثناء تحميل بيانات المستخدم بعد تسجيل الدخول لا نعرض الموقع حتى لا يظهر للحظة قبل شاشة التغيير
  const waitingForProfile = !!session && !profile

  return (
    <AuthContext.Provider value={value}>
      {waitingForProfile ? (
        <div className="min-h-screen flex items-center justify-center bg-[#0d0f12] text-gray-300 text-sm">Loading…</div>
      ) : mustChangePassword ? (
        <ForcePasswordChange fullName={profile?.full_name} onDone={refreshProfile} onSignOut={signOut} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
