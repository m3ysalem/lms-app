import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function CreateCourse() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [courseData, setCourseData] = useState({
    name: '',
    course_code: '',
    description: '',
    passing_score: 70,
    status: 'published'
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!courseData.name.trim()) {
      alert('الرجاء إدخال اسم الكورس')
      return
    }

    try {
      setBusy(true)

      // إدخال الكورس بالبيانات الأساسية فقط لضمان ظهوره فوراً
      const { error } = await supabase
        .from('courses')
        .insert([{
          name: courseData.name,
          course_code: courseData.course_code || 'CRS-' + Math.floor(Math.random() * 10000),
          description: courseData.description,
          passing_score: Number(courseData.passing_score),
          status: 'published' // التأكد من أنه منشور ليظهر للموظفين
        }])

      if (error) throw error

      alert('تم إنشاء الكورس بنجاح!')
      navigate('/admin/courses')
    } catch (err) {
      alert('فشل إنشاء الكورس: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl text-white p-6 pb-24">
      <h1 className="text-3xl font-bold">إنشاء كورس جديد (الوضع الافتراضي)</h1>
      
      <form onSubmit={handleCreate} className="space-y-6 p-6 rounded-2xl bg-[#14181d]/85 border border-white/10">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">اسم الكورس</label>
          <input 
            type="text" 
            className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none"
            placeholder="مثال: أساسيات البرمجة"
            value={courseData.name}
            onChange={(e) => setCourseData({ ...courseData, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">كود الكورس</label>
          <input 
            type="text" 
            className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:outline-none"
            placeholder="مثال: CRS-1001"
            value={courseData.course_code}
            onChange={(e) => setCourseData({ ...courseData, course_code: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">وصف الكورس</label>
          <textarea 
            rows="3"
            className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:outline-none"
            placeholder="اكتب وصفاً موجزاً للكورس..."
            value={courseData.description}
            onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">درجة النجاح (%)</label>
          <input 
            type="number" 
            className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:outline-none"
            value={courseData.passing_score}
            onChange={(e) => setCourseData({ ...courseData, passing_score: e.target.value })}
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={busy}
            className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all"
          >
            {busy ? 'جاري الحفظ...' : 'حفظ ونشر الكورس'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/admin/courses')}
            className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  )
}
