import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  // حالات نافذة تعديل بيانات الكورس الأساسية (المعلومات البسيطة فقط)
  const [editingCourse, setEditingCourse] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const refresh = () => listAllCourses().then(setCourses)

  useEffect(() => {
    refresh()
    listCategories().then(setCategories)
    listTrainers().then(setTrainers)
  }, [])

  // حفظ التعديلات الأساسية للكورس
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingCourse) return

    try {
      setSavingEdit(true)
      const { error } = await supabase
        .from('courses')
        .update({
          name: editingCourse.name,
          description: editingCourse.description,
          status: editingCourse.status,
          passing_score: editingCourse.passing_score,
          publish_date: editingCourse.status === 'published' ? new Date().toISOString().slice(0, 10) : null
        })
        .eq('id', editingCourse.id)

      if (error) throw error

      alert('Course details updated successfully!')
      setEditingCourse(null)
      refresh()
    } catch (err) {
      alert('Failed to update course: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  // تغيير الحالة مباشرة من القائمة
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
    <div className="space-y-6 text-white">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Courses Management</h1>
          <p className="text-gray-400 mt-1">{courses.length} total courses available</p>
        </div>
        <button 
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium transition-all shadow-lg" 
          onClick={() => navigate('/admin/courses/new')}
        >
          + Create New Course
        </button>
      </div>

      <div className="card divide-y divide-white/10 bg-[#14181d]/85 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
        {courses.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors gap-4 flex-wrap">
            <div className="flex-1">
              <p className="font-bold text-lg text-white">{c.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.course_code || 'N/A'} · {c.category?.name || 'Uncategorized'}</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {c.is_required && <span className="px-2.5 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-md">Required</span>}
              
              <select
                value={c.status || 'draft'}
                onChange={(e) => handleStatusChange(c.id, e.target.value)}
                className="text-xs p-1.5 rounded-lg bg-black/40 border border-white/20 text-white cursor-pointer focus:outline-none"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>

              {/* زر إدارة المنهج والمديولات (ينقلك لصفحة كاملة مخصصة للمحتوى تمنع أي تداخل مع القائمة الجانبية) */}
              <button
                type="button"
                onClick={() => navigate(`/admin/courses/${c.id}/edit`)}
                className="px-3 py-1.5 text-xs font-medium bg-teal-600/20 text-teal-300 hover:bg-teal-600 hover:text-white rounded-lg transition-colors border border-teal-500/30"
              >
                Manage Curriculum & Quiz
              </button>

              {/* زر تعديل التفاصيل الأساسية */}
              <button
                type="button"
                onClick={() => setEditingCourse({ ...c })}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-blue-500/30"
              >
                Edit Info
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteCourse(e, c.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-colors border border-rose-500/30"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* نافذة تعديل المعلومات الأساسية */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1b222c] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-xl font-bold text-rose-500">Edit Course Info: {editingCourse.name}</h3>
              <button onClick={() => setEditingCourse(null)} className="text-gray-400 hover:text-white text-lg font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Course Name</label>
                <input 
                  type="text"
                  value={editingCourse.name || ''}
                  onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                  className="w-full p-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Description</label>
                <textarea 
                  rows="3"
                  value={editingCourse.description || ''}
                  onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                  className="w-full p-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Status</label>
                  <select 
                    value={editingCourse.status || 'draft'}
                    onChange={(e) => setEditingCourse({ ...editingCourse, status: e.target.value })}
                    className="w-full p-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Passing Score (%)</label>
                  <input 
                    type="number"
                    value={editingCourse.passing_score || 70}
                    onChange={(e) => setEditingCourse({ ...editingCourse, passing_score: Number(e.target.value) })}
                    className="w-full p-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setEditingCourse(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={savingEdit} className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium">{savingEdit ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
