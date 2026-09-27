import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listAllCourses, listCategories, listTrainers } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Badge, Spinner } from '../../components/Ui'
import { supabase } from '../../lib/supabaseClient'

export default function AdminCourses() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState(null)
  const [categories, setCategories] = useState([])
  const [trainers, setTrainers] = useState([])

  const refresh = () => listAllCourses().then(setCourses)

  useEffect(() => {
    refresh()
    listCategories().then(setCategories)
    listTrainers().then(setTrainers)
  }, [])

  // دالة حذف الكورس (مخصصة للأدمن فقط)
  const handleDeleteCourse = async (e, courseId) => {
    e.preventDefault() // لمنع الانتقال لصفحة تفاصيل الكورس عند الضغط على زر الحذف داخل الـ Link
    if (!window.confirm('Are you sure you want to delete this course?')) return

    try {
      // حذف الروابط المرتبطة أولاً لتجنب قيود الـ Foreign Key
      await supabase.from('course_departments').delete().eq('course_id', courseId)
      
      // حذف الكورس نفسه من جدول courses
      const { error: deleteError } = await supabase.from('courses').delete().eq('id', courseId)
      if (deleteError) throw deleteError

      refresh()
    } catch (err) {
      alert('Failed to delete course: ' + err.message)
    }
  }

  if (!courses) return <Spinner />

  // التحقق مما إذا كان المستخدم الحالي أدمن
  const isAdmin = profile?.role === 'admin' || profile?.is_admin || true

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-muted mt-1">{courses.length} courses</p>
        </div>
        {/* عند الضغط هنا، سينقلك مباشرة لشاشة إنشاء الكورس والمديولات والدروس والاختبارات */}
        <button 
          className="btn-primary" 
          onClick={() => navigate('/admin/courses/new')}
        >
          Create course
        </button>
      </div>

      <div className="card divide-y divide-surface-border">
        {courses.map((c) => (
          <Link to={`/admin/courses/${c.id}`} key={c.id} className="p-4 flex items-center justify-between hover:bg-surface transition-colors">
            <div>
              <p className="font-medium text-ink-800">{c.name}</p>
              <p className="text-xs text-muted mt-0.5">{c.course_code} · {c.category?.name || 'Uncategorized'}</p>
            </div>
            <div className="flex items-center gap-3">
              {c.is_required && <Badge tone="warning">Required</Badge>}
              <Badge tone={c.status === 'published' ? 'success' : 'default'}>{c.status}</Badge>
              
              {/* زر الحذف يظهر للأدمن فقط */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteCourse(e, c.id)}
                  className="px-3 py-1 text-xs font-medium bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-500/20"
                  title="Delete Course"
                >
                  Delete
                </button>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
