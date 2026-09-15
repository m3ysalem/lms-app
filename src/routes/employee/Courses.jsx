import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { Spinner, Badge } from '../../components/Ui'

export default function Courses() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchCourses() {
      try {
        // 1. هات الكورسات المنشورة فقط
        let query = supabase
          .from('courses')
          .select('*')
          .eq('status', 'published')

        // 2. لو الموظف عنده department_id، اظهر كورسات إدارته + الكورسات العامة (التي لا تتبع إدارة محددة)
        if (profile?.department_id) {
          query = query.or(`department_id.eq.${profile.department_id},department_id.is.null`)
        } else {
          // لو ملوش إدارة مسجلة، اظهر الكورسات العامة فقط
          query = query.is('department_id', null)
        }

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) throw error
        setCourses(data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (profile) {
      fetchCourses()
    }
  }, [profile])

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>
  if (error) return <div className="text-rose-400 p-4">Error loading courses: {error}</div>

  return (
    <div className="space-y-6 text-white">
      <div>
        <h1 className="text-3xl font-black font-head tracking-wide">Available Courses</h1>
        <p className="text-gray-400 mt-1 text-sm">Explore and enroll in training courses tailored for your department.</p>
      </div>

      {courses.length === 0 ? (
        <div className="p-8 rounded-3xl bg-[#14181d]/80 border border-white/10 backdrop-blur-xl text-center">
          <p className="text-gray-400">No courses available for your department at the moment.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link 
              key={course.id} 
              to={`/courses/${course.id}`} 
              className="p-5 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl block hover:border-rose-500/50 transition-all shadow-xl space-y-3"
            >
              <h2 className="font-semibold text-lg text-white">{course.title || course.name}</h2>
              <p className="text-sm text-gray-400 line-clamp-2">{course.description || 'No description provided.'}</p>
              <div className="pt-2 flex items-center justify-between">
                <Badge tone="info">Active</Badge>
                <span className="text-xs text-rose-400 font-medium">View Course →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
