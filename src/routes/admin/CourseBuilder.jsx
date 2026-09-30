import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function CreateCourse() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('list') // 'list' أو 'form'
  const [courses, setCourses] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDepts, setSelectedDepts] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [activeMenu, setActiveMenu] = useState(null)

  const menuRef = useRef(null)

  const [courseData, setCourseData] = useState({
    name: '',
    course_code: '',
    passing_score: 70,
    certificate_eligible: true,
    required: false,
    status: 'published'
  })

  const [modules, setModules] = useState([
    {
      title: 'Module 1',
      lessons: [
        { 
          title: '', 
          content_type: 'video', 
          video_url: '', 
          pdf_url: '', 
          text_content: '', 
          duration: 15 
        }
      ],
      quiz: {
        title: '',
        questions: [
          { question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 10 }
        ]
      }
    }
  ])

  useEffect(() => {
    fetchInitialData()
    
    // إغلاق القائمة المنسدلة عند الضغط في أي مكان خارجها
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchInitialData() {
    try {
      const { data: deptData } = await supabase.from('departments').select('id, name')
      if (deptData) setDepartments(deptData)

      const { data: courseList, error } = await supabase
        .from('courses')
        .select('*, course_departments(department_id)')
        .order('created_at', { ascending: false })

      if (!error && courseList) {
        setCourses(courseList)
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }

  const handleOpenCreate = async () => {
    setEditingCourseId(null)
    setSelectedDepts([])
    setCourseData({
      name: '',
      course_code: '',
      passing_score: 70,
      certificate_eligible: true,
      required: false,
      status: 'published'
    })
    setModules([
      {
        title: 'Module 1',
        lessons: [{ title: '', content_type: 'video', video_url: '', pdf_url: '', text_content: '', duration: 15 }],
        quiz: { title: '', questions: [{ question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 10 }] }
      }
    ])

    // توليد كود تلقائي
    const { count } = await supabase.from('courses').select('*', { count: 'exact', head: true })
    const nextNum = (count || 0) + 1
    setCourseData(prev => ({ ...prev, course_code: `CRS-${String(nextNum).padStart(4, '0')}` }))
    setViewMode('form')
  }

  const handleOpenEdit = async (course) => {
    setEditingCourseId(course.id)
    setCourseData({
      name: course.name || '',
      course_code: course.course_code || '',
      passing_score: course.passing_score || 70,
      certificate_eligible: course.certificate_eligible ?? true,
      required: course.required ?? false,
      status: course.status || 'published'
    })

    const deptIds = course.course_departments?.map(d => d.department_id) || (course.department_id ? [course.department_id] : [])
    setSelectedDepts(deptIds)

    try {
      // جلب المديولات والدروس والاختبارات الخاصة بالكورس للتعديل
      const { data: modData } = await supabase
        .from('modules')
        .select('*, lessons(*), quizzes(*, quiz_questions(*))')
        .eq('course_id', course.id)
        .order('sort_order', { ascending: true })

      if (modData && modData.length > 0) {
        const formattedModules = modData.map(m => ({
          id: m.id,
          title: m.title,
          lessons: m.lessons?.length > 0 ? m.lessons.map(l => ({
            id: l.id,
            title: l.title,
            content_type: l.content_type || 'video',
            video_url: l.video_url || '',
            pdf_url: l.pdf_url || '',
            text_content: l.text_content || l.body || '',
            duration: l.duration || 15
          })) : [{ title: '', content_type: 'video', video_url: '', pdf_url: '', text_content: '', duration: 15 }],
          quiz: m.quizzes?.[0] ? {
            id: m.quizzes[0].id,
            title: m.quizzes[0].title,
            questions: m.quizzes[0].quiz_questions?.length > 0 ? m.quizzes[0].quiz_questions.map(q => ({
              id: q.id,
              question_text: q.question_text,
              options: q.options || ['', '', '', ''],
              correct_answer: q.correct_answer || 0,
              points: q.points || 10
            })) : [{ question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 10 }]
          } : { title: '', questions: [{ question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 10 }] }
        }))
        setModules(formattedModules)
      } else {
        setModules([{
          title: 'Module 1',
          lessons: [{ title: '', content_type: 'video', video_url: '', pdf_url: '', text_content: '', duration: 15 }],
          quiz: { title: '', questions: [{ question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 10 }] }
        }])
      }
    } catch (err) {
      console.error('Error loading course details for edit:', err)
    }

    setViewMode('form')
    setActiveMenu(null)
  }

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكورس نهائياً؟')) return
    try {
      const { error } = await supabase.from('courses').delete().eq('id', courseId)
      if (error) throw error
      setCourses(prev => prev.filter(c => c.id !== courseId))
      alert('تم حذف الكورس بنجاح')
    } catch (err) {
      alert('فشل الحذف: ' + err.message)
    }
    setActiveMenu(null)
  }

  const handleToggleStatus = async (course) => {
    const newStatus = course.status === 'published' ? 'draft' : 'published'
    try {
      const { error } = await supabase.from('courses').update({ status: newStatus }).eq('id', course.id)
      if (error) throw error
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, status: newStatus } : c))
    } catch (err) {
      alert('فشل تغيير الحالة: ' + err.message)
    }
    setActiveMenu(null)
  }

  const handleCheckboxChange = (deptId) => {
    setSelectedDepts(prev => 
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    )
  }

  const addModule = () => {
    setModules(prev => [
      ...prev,
      {
        title: `Module ${prev.length + 1}`,
        lessons: [{ title: '', content_type: 'video', video_url: '', pdf_url: '', text_content: '', duration: 15 }],
        quiz: { title: '', questions: [{ question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 10 }] }
      }
    ])
  }

  const removeModule = (mIdx) => {
    setModules(prev => prev.filter((_, idx) => idx !== mIdx))
  }

  const addLesson = (mIdx) => {
    setModules(prev => {
      const updated = [...prev]
      updated[mIdx].lessons.push({ title: '', content_type: 'video', video_url: '', pdf_url: '', text_content: '', duration: 15 })
      return updated
    })
  }

  const removeLesson = (mIdx, lIdx) => {
    setModules(prev => {
      const updated = [...prev]
      updated[mIdx].lessons = updated[mIdx].lessons.filter((_, idx) => idx !== lIdx)
      return updated
    })
  }

  const handleFileUpload = async (e, mIdx, lIdx) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      setUploadingFile(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `course_files/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('course-files') 
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('course-files')
        .getPublicUrl(filePath)

      const updated = [...modules]
      updated[mIdx].lessons[lIdx].pdf_url = publicUrl
      setModules(updated)
      alert('تم رفع الملف بنجاح!')
    } catch (err) {
      alert('فشل رفع الملف: ' + err.message)
    } finally {
      setUploadingFile(false)
    }
  }

  const addQuestion = (mIdx) => {
    setModules(prev => {
      const updated = [...prev]
      updated[mIdx].quiz.questions.push({ question_text: '', options: ['', '', '', ''], correct_answer: 0, points: 10 })
      return updated
    })
  }

  const removeQuestion = (mIdx, qIdx) => {
    setModules(prev => {
      const updated = [...prev]
      updated[mIdx].quiz.questions = updated[mIdx].quiz.questions.filter((_, idx) => idx !== qIdx)
      return updated
    })
  }

  const handleSaveCourse = async (e) => {
    e.preventDefault()
    if (!courseData.name.trim()) {
      alert('الرجاء إدخال اسم الكورس')
      return
    }

    try {
      setBusy(true)

      let totalCourseDurationMins = 0
      modules.forEach(m => {
        m.lessons.forEach(l => {
          totalCourseDurationMins += Number(l.duration || 0)
        })
      })

      const primaryDeptId = selectedDepts.length > 0 ? selectedDepts[0] : null

      let courseId = editingCourseId

      if (editingCourseId) {
        // تحديث الكورس الحالي
        const { error: updateErr } = await supabase
          .from('courses')
          .update({
            name: courseData.name,
            course_code: courseData.course_code,
            passing_score: Number(courseData.passing_score),
            certificate_eligible: courseData.certificate_eligible,
            required: courseData.required,
            duration: totalCourseDurationMins,
            status: courseData.status,
            department_id: primaryDeptId
          })
          .eq('id', editingCourseId)

        if (updateErr) throw updateErr

        // تحديث الأقسام المرتبطة
        await supabase.from('course_departments').delete().eq('course_id', editingCourseId)
        if (selectedDepts.length > 0) {
          const relations = selectedDepts.map(deptId => ({ course_id: editingCourseId, department_id: deptId }))
          await supabase.from('course_departments').insert(relations)
        }

        // حذف المديولات القديمة وإعادة إضافتها لضمان المزامنة السليمة
        await supabase.from('modules').delete().eq('course_id', editingCourseId)

      } else {
        // إنشاء كورس جديد
        const { data: newCourse, error: courseError } = await supabase
          .from('courses')
          .insert([{
            name: courseData.name,
            course_code: courseData.course_code,
            passing_score: Number(courseData.passing_score),
            certificate_eligible: courseData.certificate_eligible,
            required: courseData.required,
            duration: totalCourseDurationMins,
            status: courseData.status,
            department_id: primaryDeptId
          }])
          .select()
          .single()

        if (courseError) throw courseError
        courseId = newCourse.id

        if (selectedDepts.length > 0) {
          const relations = selectedDepts.map(deptId => ({ course_id: courseId, department_id: deptId }))
          await supabase.from('course_departments').insert(relations)
        }
      }

      // إضافة المديولات والدروس والاختبارات
      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i]
        const { data: newModule, error: modErr } = await supabase
          .from('modules')
          .insert([{ course_id: courseId, title: mod.title, sort_order: i + 1 }])
          .select()
          .single()

        if (modErr || !newModule) continue

        if (mod.lessons.length > 0) {
          const lessonsToInsert = mod.lessons.map((l, lIdx) => ({
            module_id: newModule.id,
            title: l.title || `Lesson ${lIdx + 1}`,
            content_type: l.content_type,
            video_url: l.content_type === 'video' ? l.video_url : '',
            pdf_url: l.content_type === 'pdf' ? l.pdf_url : '',
            text_content: l.content_type === 'text' ? l.text_content : '',
            body: l.content_type === 'text' ? l.text_content : (l.content_type === 'video' ? l.video_url : l.pdf_url),
            duration: Number(l.duration || 15),
            sort_order: lIdx + 1
          }))
          await supabase.from('lessons').insert(lessonsToInsert)
        }

        if (mod.quiz && mod.quiz.questions.length > 0 && mod.quiz.title) {
          const { data: newQuiz, error: quizErr } = await supabase
            .from('quizzes')
            .insert([{ course_id: courseId, module_id: newModule.id, title: mod.quiz.title, passing_score: Number(courseData.passing_score) }])
            .select()
            .single()

          if (!quizErr && newQuiz) {
            const questionsToInsert = mod.quiz.questions.map((q, qIdx) => ({
              quiz_id: newQuiz.id,
              question_text: q.question_text,
              options: q.options,
              correct_answer: q.correct_answer,
              points: Number(q.points || 10),
              sort_order: qIdx + 1
            }))
            await supabase.from('quiz_questions').insert(questionsToInsert)
          }
        }
      }

      alert('تم حفظ الكورس ونشره بنجاح!')
      setViewMode('list')
      fetchInitialData()
    } catch (err) {
      alert('فشل حفظ الكورس: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl text-white p-6 pb-24 mx-auto">
      {viewMode === 'list' ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">إدارة الكورسات</h1>
              <p className="text-gray-400 text-sm mt-1">عرض وتعديل ونشر الكورسات الخاصة بالموظفين والأقسام</p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-all shadow-lg flex items-center gap-2"
            >
              <span>+ إضافة كورس جديد</span>
            </button>
          </div>

          <div className="bg-[#14181d]/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-black/40 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="p-4">كود الكورس</th>
                    <th className="p-4">اسم الكورس</th>
                    <th className="p-4">درجة النجاح</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-400">لا توجد كورسات مضافة حتى الآن.</td>
                    </tr>
                  ) : (
                    courses.map((course) => (
                      <tr key={course.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono text-rose-400">{course.course_code}</td>
                        <td className="p-4 font-semibold text-white">{course.name}</td>
                        <td className="p-4 text-gray-300">{course.passing_score}%</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${course.status === 'published' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                            {course.status === 'published' ? 'منشور' : 'مسودة (Draft)'}
                          </span>
                        </td>
                        <td className="p-4 text-center relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === course.id ? null : course.id)}
                            className="p-2 hover:bg-white/10 rounded-lg text-gray-300 transition-colors"
                          >
                            ⋮
                          </button>

                          {activeMenu === course.id && (
                            <div ref={menuRef} className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#1e232a] border border-white/10 rounded-xl shadow-2xl z-50 py-2 text-right">
                              <button
                                onClick={() => handleOpenEdit(course)}
                                className="w-full px-4 py-2 text-sm text-gray-200 hover:bg-rose-600 hover:text-white transition-colors text-right flex items-center justify-between"
                              >
                                <span>تعديل التفاصيل</span>
                                <span>✏️</span>
                              </button>
                              <button
                                onClick={() => handleToggleStatus(course)}
                                className="w-full px-4 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors text-right flex items-center justify-between"
                              >
                                <span>{course.status === 'published' ? 'تحويل إلى درافت' : 'نشر الكورس'}</span>
                                <span>{course.status === 'published' ? '🔒' : '🌐'}</span>
                              </button>
                              <div className="border-t border-white/10 my-1"></div>
                              <button
                                onClick={() => handleDeleteCourse(course.id)}
                                className="w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors text-right flex items-center justify-between"
                              >
                                <span>حذف الكورس</span>
                                <span>🗑️</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <form onSubmit={handleSaveCourse} className="space-y-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h1 className="text-3xl font-bold">{editingCourseId ? 'تعديل الكورس' : 'إنشاء كورس جديد'}</h1>
              <p className="text-gray-400 text-sm mt-1">قم بتعديل كافة تفاصيل المديولات، الدروس، والاختبارات</p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm transition-colors"
            >
              ← العودة للقائمة
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-[#14181d]/85 border border-white/10 space-y-4">
            <h2 className="text-xl font-semibold text-rose-500">1. المعلومات الأساسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">اسم الكورس</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none"
                  placeholder="مثال: مهارات القيادة الحديثة"
                  value={courseData.name}
                  onChange={(e) => setCourseData({ ...courseData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">كود الكورس</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-gray-400 focus:outline-none cursor-not-allowed"
                  value={courseData.course_code}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">درجة النجاح (%)</label>
                <input 
                  type="number" 
                  className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none"
                  value={courseData.passing_score}
                  onChange={(e) => setCourseData({ ...courseData, passing_score: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#14181d]/85 border border-white/10 space-y-3">
            <h2 className="text-xl font-semibold text-rose-500">2. الأقسام المستهدفة</h2>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {departments.length === 0 ? (
                <p className="text-gray-400 text-sm">لا توجد أقسام مسجلة.</p>
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

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-rose-500">3. المديولات، الدروس، والاختبارات</h2>
              <button
                type="button"
                onClick={addModule}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                + إضافة مديول جديد
              </button>
            </div>

            {modules.map((mod, mIdx) => (
              <div key={mIdx} className="p-6 rounded-2xl bg-[#14181d]/90 border border-white/10 space-y-6 relative">
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    value={mod.title}
                    onChange={(e) => {
                      const updated = [...modules]
                      updated[mIdx].title = e.target.value
                      setModules(updated)
                    }}
                    className="bg-black/50 border border-white/20 rounded-lg p-2 font-bold text-lg text-white w-full max-w-sm"
                    placeholder="عنوان المديول"
                  />
                  {modules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeModule(mIdx)}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      حذف المديول
                    </button>
                  )}
                </div>

                <div className="space-y-4 pl-4 border-l-2 border-rose-500/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">الدروس والمحتوى</h3>
                    <button
                      type="button"
                      onClick={() => addLesson(mIdx)}
                      className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors"
                    >
                      + إضافة درس
                    </button>
                  </div>

                  {mod.lessons.map((lesson, lIdx) => (
                    <div key={lIdx} className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-5">
                          <input
                            type="text"
                            placeholder="عنوان الدرس"
                            value={lesson.title}
                            onChange={(e) => {
                              const updated = [...modules]
                              updated[mIdx].lessons[lIdx].title = e.target.value
                              setModules(updated)
                            }}
                            className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <select
                            value={lesson.content_type}
                            onChange={(e) => {
                              const updated = [...modules]
                              updated[mIdx].lessons[lIdx].content_type = e.target.value
                              setModules(updated)
                            }}
                            className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white"
                          >
                            <option value="video">فيديو خارجي (يوتيوب/رابط)</option>
                            <option value="pdf">ملف PDF</option>
                            <option value="text">محتوى نصي وملاحظات</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <input
                            type="number"
                            placeholder="دقائق"
                            value={lesson.duration}
                            onChange={(e) => {
                              const updated = [...modules]
                              updated[mIdx].lessons[lIdx].duration = e.target.value
                              setModules(updated)
                            }}
                            className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white"
                          />
                        </div>
                        <div className="md:col-span-1 text-center">
                          {mod.lessons.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLesson(mIdx, lIdx)}
                              className="text-red-400 hover:text-red-300 text-xs font-bold"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {lesson.content_type === 'video' && (
                        <input
                          type="text"
                          placeholder="ضع رابط الفيديو هنا..."
                          value={lesson.video_url}
                          onChange={(e) => {
                            const updated = [...modules]
                            updated[mIdx].lessons[lIdx].video_url = e.target.value
                            setModules(updated)
                          }}
                          className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white"
                        />
                      )}

                      {lesson.content_type === 'pdf' && (
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => handleFileUpload(e, mIdx, lIdx)}
                            className="text-xs text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-rose-600 file:text-white"
                          />
                          {uploadingFile && <span className="text-xs text-amber-400">جاري الرفع...</span>}
                          {lesson.pdf_url && <span className="text-xs text-green-400">تم رفع الملف بنجاح</span>}
                        </div>
                      )}

                      {lesson.content_type === 'text' && (
                        <textarea
                          rows="3"
                          placeholder="اكتب ملاحظات أو محتوى الدرس النصي هنا..."
                          value={lesson.text_content}
                          onChange={(e) => {
                            const updated = [...modules]
                            updated[mIdx].lessons[lIdx].text_content = e.target.value
                            setModules(updated)
                          }}
                          className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pl-4 border-l-2 border-teal-500/30 pt-2">
                  <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">اختبار المديول (Quiz)</h3>
                  <input
                    type="text"
                    placeholder="عنوان الاختبار (مثال: تقييم مديول 1)"
                    value={mod.quiz.title}
                    onChange={(e) => {
                      const updated = [...modules]
                      updated[mIdx].quiz.title = e.target.value
                      setModules(updated)
                    }}
                    className="w-full max-w-sm p-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white"
                  />

                  <div className="space-y-3">
                    {mod.quiz.questions.map((q, qIdx) => (
                      <div key={qIdx} className="bg-black/40 p-4 rounded-xl border border-white/10 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">السؤال {qIdx + 1}</span>
                          {mod.quiz.questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(mIdx, qIdx)}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              حذف السؤال
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="نص السؤال..."
                          value={q.question_text}
                          onChange={(e) => {
                            const updated = [...modules]
                            updated[mIdx].quiz.questions[qIdx].question_text = e.target.value
                            setModules(updated)
                          }}
                          className="w-full p-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct_${mIdx}_${qIdx}`}
                                checked={q.correct_answer === oIdx}
                                onChange={() => {
                                  const updated = [...modules]
                                  updated[mIdx].quiz.questions[qIdx].correct_answer = oIdx
                                  setModules(updated)
                                }}
                                className="text-rose-600 focus:ring-0"
                              />
                              <input
                                type="text"
                                placeholder={`الخيار ${oIdx + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...modules]
                                  updated[mIdx].quiz.questions[qIdx].options[oIdx] = e.target.value
                                  setModules(updated)
                                }}
                                className="w-full p-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addQuestion(mIdx)}
                      className="text-xs bg-teal-600/20 text-teal-300 hover:bg-teal-600/30 px-3 py-1.5 rounded-md transition-colors"
                    >
                      + إضافة سؤال
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-6 border-t border-white/10">
            <button
              type="submit"
              disabled={busy}
              className="px-8 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-lg"
            >
              {busy ? 'جاري الحفظ...' : 'حفظ ونشر التعديلات'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
