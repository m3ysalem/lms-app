import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { Spinner } from '../../components/Ui'

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

  // جلب الأقسام الفريدة ديناميكياً من عمود department في جدول profiles
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const { data, error } = await supabase.from('profiles').select('department')
        if (!error && data) {
          const uniqueDepts = [...new Set(data.map(p => p.department).filter(Boolean))]
          setDepartments(uniqueDepts)
        }
      } catch (err) {
        console.error('Error fetching departments:', err)
      }
    }
    fetchDepartments()
  }, [])

  // دالة تحديد أو إلغاء تحديد القسم
  const handleCheckboxChange = (dept) => {
    setSelectedDepts(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
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
      // إرسال البيانات مع الأقسام المستهدفة (selectedDepts)
      const { error } = await supabase.from('courses').insert([{
        name: courseData.name,
        course_code: courseData.course_code,
        passing_score: Number(courseData.passing_score),
        certificate_eligible: courseData.certificate_eligible,
        required: courseData.required,
        target_departments: selectedDepts // حفظ الأقسام المختارة
      }])

      if (error) throw error

      alert('Course created successfully!')
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
        {/* بيانات الكورس الأساسية */}
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

        {/* الإدارات المستهدفة (Target Departments) ديناميكياً */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Target Departments (الإدارات المستهدفة)
          </label>
          
          <div className="p-4 rounded-xl bg-[#14181d]/85 border border-white/10 space-y-3 max-h-48 overflow-y-auto">
            {departments.length === 0 ? (
              <p className="text-gray-400 text-sm">No departments found in profiles.</p>
            ) : (
              departments.map((dept, index) => (
                <label key={index} className="flex items-center gap-3 cursor-pointer text-sm hover:text-white">
                  <input
                    type="checkbox"
                    checked={selectedDepts.includes(dept)}
                    onChange={() => handleCheckboxChange(dept)}
                    className="rounded border-white/20 bg-black text-rose-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span>{dept}</span>
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
