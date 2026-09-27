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

  // دالة لتغيير حالة الكورس (Published / Draft) مباشرة من القائمة المنسدلة السريعة
  const handleStatusChange = async (courseId, newStatus) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ 
          status: newStatus,
          publish_date: newStatus === 'published' ? new Date().toISOString().slice(0, 10) : null
        })
        .eq('id', courseId)

      if (error) throw error
      refresh()
    } catch (err) {
      alert('Failed to update status: ' + err.message)
    }
  }

  // دالة حذف الكورس (مخصصة للأدمن فقط)
  const handleDeleteCourse = async (e, courseId) => {
    e.preventDefault()
    if (!window.confirm('Are you sure you want to delete this course?')) return

    try {
      await supabase.from('course_departments').delete().eq('course_id', courseId)
      const { error: deleteError } = await supabase.from('courses').delete().eq('id', courseId)
      if (deleteError) throw deleteError

      refresh()
    } catch (err) {
      alert('Failed to delete course: ' + err.message)
    }
  }

  if (!courses) return <Spinner />

  const isAdmin = profile?.role === 'admin' || profile?.is_admin || true

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-muted mt-1">{courses.length} courses</p>
        </div>
        {/* زر إنشاء كورس جديد يوجهك لشاشة الإنشاء الشاملة */}
        <button 
          className="btn-primary" 
          onClick={() => navigate('/admin/courses/new')}
        >
          Create course
        </button>
      </div>

      <div className="card divide-y divide-surface-border">
        {courses.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between hover:bg-surface transition-colors">
            {/* الضغط على اسم الكورس يوجهك لصفحة تفاصيل الكورس */}
            <div 
              className="cursor-pointer flex-1"
              onClick={() => navigate(`/admin/courses/${c.id}`)}
            >
              <p className="font-medium text-ink-800">{c.name}</p>
              <p className="text-xs text-muted mt-0.5">{c.course_code} · {c.category?.name || 'Uncategorized'}</p>
            </div>

            <div className="flex items-center gap-3">
              {c.is_required && <Badge tone="warning">Required</Badge>}
              
              {/* قائمة منسدلة سريعة لتغيير حالة الكورس (Draft / Published) بدون الدخول للصفحة */}
              <select
                value={c.status || 'draft'}
                onChange={(e) => handleStatusChange(c.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="text-xs p-1.5 rounded bg-black/30 border border-white/20 text-white cursor-pointer focus:outline-none"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>

              {/* زر التعديل (Edit) الموجه لصفحة تفاصيل أو تعديل الكورس */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/admin/courses/${c.id}`)
                }}
                className="px-3 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white rounded-lg transition-colors border border-blue-500/20"
                title="Edit Course Details"
              >
                Edit
              </button>

              {/* زر الحذف */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteCourse(e, c.id)
                  }}
                  className="px-3 py-1 text-xs font-medium bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-500/20"
                  title="Delete Course"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
