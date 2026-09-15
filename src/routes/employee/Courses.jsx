import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { Spinner, Badge } from '../../components/Ui'

export default function Courses() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchCourses() {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setCourses(data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCourses()
  }, [])

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>
  if (error) return <div className="text-rose-400 p-4">Error loading courses: {error}</div>

  return (
    <div className="space-y-6 text-white">
      <div>
        <h1 className="text-3xl font-black font-head tracking-wide">Available Courses</h1>
        <p className="text-gray-400 mt-1 text-sm">Explore and enroll in training courses to enhance your skills.</p>
      </div>

      {courses.length === 0 ? (
        <div className="p-8 rounded-3xl bg-[#14181d]/80 border border-white/10 backdrop-blur-xl text-center">
          <p className="text-gray-400">No courses available at the moment.</p>
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
