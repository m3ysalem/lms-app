import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function CreateCourse() {
  const navigate = useNavigate()
  const [departments, setDepartments] = useState([])
  const [selectedDepts, setSelectedDepts] = useState([])
  const [courseData, setCourseData] = useState({
    name: '',
    course_code: '',
    passing_score: 70,
    certificate_eligible: true,
    required: false
  })
  const [busy, setBusy] = useState(false)

  // جلب الأقسام المرتبطة من جدول departments مباشرة
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const { data, error } = await supabase.from('departments').select('id, name')
        if (!error && data) {
          setDepartments(data)
        } else {
          console.error('Error fetching departments:', error)
        }
      } catch (err) {
        console.error('Error fetching departments:', err)
      }
    }
    fetchDepartments()
  }, [])

  // دالة تحديد أو إلغاء تحديد القسم (تعتمد على الـ id)
  const handleCheckboxChange = (deptId) => {
    setSelectedDepts(prev => 
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    )
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!courseData.name.trim()) {
      alert('Please enter course name')
      return
    }

    try {
      setBusy(true)

      // 1. إدخال الكورس الأساسي
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert([{
          name: courseData.name,
          course_code: courseData.course_code,
          passing_score: Number(courseData.passing_score),
          certificate_eligible: courseData.certificate_eligible,
          required: courseData.required
        }])
        .select()
        .single()

      if (courseError) throw courseError

      // 2. ربط الكورس بالأقسام المستهدفة في الجدول الوسيط course_departments (إذا تم اختيار أقسام)
      if (selectedDepts.length > 0 && newCourse) {
        const relations = selectedDepts.map(deptId => ({
          course_id: newCourse.id,
          department_id: deptId
        }))

        const { error: relationError } = await supabase
          .from('course_departments')
          .insert(relations)

        if (relationError) throw relationError
      }

      alert('Course created and departments linked successfully!')
      navigate('/admin/courses')
    } catch (err) {
      alert('Failed to create course: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl text-white p-6">
      <h1 className="text-2xl font-bold">Create New Course</h1>
      
      <form onSubmit={handleCreate} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Course Name</label>
            <input 
              type="text" 
              className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none"
              placeholder="e.g. JavaScript Basics"
              value={courseData.name}
              onChange={(e) => setCourseData({ ...courseData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Course Code</label>
            <input 
              type="text" 
              className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none"
              placeholder="e.g. JS-101"
              value={courseData.course_code}
              onChange={(e) => setCourseData({ ...courseData, course_code: e.target.value })}
            />
          </div>
        </div>

        {/* الإدارات المستهدفة (Target Departments) ديناميكياً من جدول departments */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Target Departments (الإدارات المستهدفة)
          </label>
          
          <div className="p-4 rounded-xl bg-[#14181d]/85 border border-white/10 space-y-3 max-h-48 overflow-y-auto">
            {departments.length === 0 ? (
              <p className="text-gray-400 text-sm">No departments found.</p>
            ) : (
              departments.map((dept) => (
                <label key={dept.id} className="flex items-center gap-3 cursor-pointer text-sm hover:text-white">
                  <input
                    type="checkbox"
                    checked={selectedDepts.includes(dept.id)}
                    onChange={() => handleCheckboxChange(dept.id)}
                    className="rounded border-white/20 bg-black text-rose-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span>{dept.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* الخيارات الإضافية */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input 
              type="checkbox" 
              checked={courseData.certificate_eligible}
              onChange={(e) => setCourseData({ ...courseData, certificate_eligible: e.target.checked })}
              className="rounded border-white/20 bg-black text-rose-600 focus:ring-0 w-4 h-4"
            />
            Certificate eligible
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input 
              type="checkbox" 
              checked={courseData.required}
              onChange={(e) => setCourseData({ ...courseData, required: e.target.checked })}
              className="rounded border-white/20 bg-black text-rose-600 focus:ring-0 w-4 h-4"
            />
            Required
          </label>
        </div>

        {/* زر الإنشاء */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={busy}
            className="px-6 py-2.5 rounded-lg bg-[#9E1B1B] hover:bg-rose-700 text-white font-medium transition-colors shadow-lg shadow-red-950/50"
          >
            {busy ? 'Creating...' : 'Create course'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/admin/courses')}
            className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
