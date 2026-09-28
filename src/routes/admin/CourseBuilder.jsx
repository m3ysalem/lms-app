import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function CreateCourse() {
  const navigate = useNavigate()
  const [departments, setDepartments] = useState([])
  const [selectedDepts, setSelectedDepts] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  // بيانات الكورس الأساسية
  const [courseData, setCourseData] = useState({
    name: '',
    course_code: '',
    passing_score: 70,
    certificate_eligible: true,
    required: false
  })

  // هيكل الوحدات والدروس والاختبارات داخل الكورس (يدعم الأنواع: video, pdf, text)
  const [modules, setModules] = useState([
    {
      title: 'Module 1',
      lessons: [
        { 
          title: '', 
          content_type: 'video', // video, pdf, text
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

  // جلب الأقسام وتوليد كود الكورس أوتوماتيكياً عند تحميل الشاشة
  useEffect(() => {
    async function initData() {
      try {
        // 1. جلب الأقسام
        const { data: deptData, error: deptError } = await supabase.from('departments').select('id, name')
        if (!deptError && deptData) {
          setDepartments(deptData)
        }

        // 2. توليد كود الكورس أوتوماتيكياً (CRS-000X)
        const { count, error: countError } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true })
        
        if (!countError) {
          const nextNum = (count || 0) + 1
          const autoCode = `CRS-${String(nextNum).padStart(4, '0')}`
          setCourseData(prev => ({ ...prev, course_code: autoCode }))
        }
      } catch (err) {
        console.error('Error initializing course data:', err)
      }
    }
    initData()
  }, [])

  const handleCheckboxChange = (deptId) => {
    setSelectedDepts(prev => 
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    )
  }

  // دوال التحكم في الوحدات والدروس والاختبارات
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

  // رفع ملف PDF إلى Supabase Storage
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
      alert('PDF uploaded successfully!')
    } catch (err) {
      alert('Failed to upload file: ' + err.message)
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

  // حفظ الكورس بالكامل
  const handleCreate = async (e) => {
    e.preventDefault()
    if (!courseData.name.trim()) {
      alert('Please enter course name')
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

      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert([{
          name: courseData.name,
          course_code: courseData.course_code,
          passing_score: Number(courseData.passing_score),
          certificate_eligible: courseData.certificate_eligible,
          required: courseData.required,
          duration: totalCourseDurationMins
        }])
        .select()
        .single()

      if (courseError) throw courseError

      if (selectedDepts.length > 0 && newCourse) {
        const relations = selectedDepts.map(deptId => ({
          course_id: newCourse.id,
          department_id: deptId
        }))
        const { error: relationError } = await supabase.from('course_departments').insert(relations)
        if (relationError) throw relationError
      }

      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i]
        
        const { data: newModule, error: modErr } = await supabase
          .from('modules')
          .insert([{
            course_id: newCourse.id,
            title: mod.title,
            order_index: i + 1
          }])
          .select()
          .single()

        if (modErr) {
          console.warn('Modules table error or skipped:', modErr.message)
          continue
        }

        if (newModule && mod.lessons.length > 0) {
          const lessonsToInsert = mod.lessons.map((l, lIdx) => ({
            module_id: newModule.id,
            course_id: newCourse.id,
            title: l.title || `Lesson ${lIdx + 1}`,
            content_type: l.content_type,
            video_url: l.content_type === 'video' ? l.video_url : '',
            pdf_url: l.content_type === 'pdf' ? l.pdf_url : '',
            text_content: l.content_type === 'text' ? l.text_content : '',
            duration: Number(l.duration || 15),
            order_index: lIdx + 1
          }))
          await supabase.from('lessons').insert(lessonsToInsert)
        }

        if (newModule && mod.quiz && mod.quiz.questions.length > 0 && mod.quiz.title) {
          const { data: newQuiz, error: quizErr } = await supabase
            .from('quizzes')
            .insert([{
              module_id: newModule.id,
              course_id: newCourse.id,
              title: mod.quiz.title
            }])
            .select()
            .single()

          if (!quizErr && newQuiz) {
            const questionsToInsert = mod.quiz.questions.map((q, qIdx) => ({
              quiz_id: newQuiz.id,
              question_text: q.question_text,
              options: q.options,
              correct_answer: q.correct_answer,
              points: Number(q.points || 10),
              order_index: qIdx + 1
            }))
            await supabase.from('questions').insert(questionsToInsert)
          }
        }
      }

      alert('Course, modules, lessons, and quizzes created successfully!')
      navigate('/admin/courses')
    } catch (err) {
      alert('Failed to create course: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl text-white p-6 pb-24">
      <h1 className="text-3xl font-bold">Create New Course & Curriculum</h1>
      
      <form onSubmit={handleCreate} className="space-y-8">
        {/* معلومات الكورس الأساسية */}
        <div className="p-6 rounded-2xl bg-[#14181d]/85 border border-white/10 space-y-4">
          <h2 className="text-xl font-semibold text-rose-500">1. Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Course Name</label>
              <input 
                type="text" 
                className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none"
                placeholder="e.g. Advanced JavaScript"
                value={courseData.name}
                onChange={(e) => setCourseData({ ...courseData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Course Code (Auto Generated)</label>
              <input 
                type="text" 
                className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-gray-400 focus:outline-none cursor-not-allowed"
                value={courseData.course_code}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Passing Score (%)</label>
              <input 
                type="number" 
                className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none"
                value={courseData.passing_score}
                onChange={(e) => setCourseData({ ...courseData, passing_score: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
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
        </div>

        {/* الأقسام المستهدفة */}
        <div className="p-6 rounded-2xl bg-[#14181d]/85 border border-white/10 space-y-3">
          <h2 className="text-xl font-semibold text-rose-500">2. Target Departments</h2>
          <div className="space-y-2 max-h-40 overflow-y-auto">
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

        {/* الموديلات والدروس والاختبارات */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-rose-500">3. Course Modules, Lessons & Quizzes</h2>
            <button
              type="button"
              onClick={addModule}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + Add Module
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
                  placeholder="Module Title"
                />
                {modules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeModule(mIdx)}
                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                  >
                    Delete Module
                  </button>
                )}
              </div>

              {/* الدروس وتنوع المحتوى */}
              <div className="space-y-4 pl-4 border-l-2 border-rose-500/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Lessons & Content</h3>
                  <button
                    type="button"
                    onClick={() => addLesson(mIdx)}
                    className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors"
                  >
                    + Add Lesson
                  </button>
                </div>

                {mod.lessons.map((lesson, lIdx) => (
                  <div key={lIdx} className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-5">
                        <input
                          type="text"
                          placeholder="Lesson Title"
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
                          <option value="video">External Video (YouTube/URL)</option>
                          <option value="pdf">Upload PDF Document</option>
                          <option value="text">Manual Text Notes</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="number"
                          placeholder="Mins"
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

                    {/* حقول محتوى الدرس حسب النوع المختار */}
                    {lesson.content_type === 'video' && (
                      <input
                        type="text"
                        placeholder="Paste External Video URL (YouTube, MP4, etc.)"
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
                          className="text-xs text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-rose-600 file:text-white hover:file:bg-rose-700"
                        />
                        {uploadingFile && <span className="text-xs text-amber-400">Uploading file...</span>}
                        {lesson.pdf_url && <span className="text-xs text-green-400 truncate max-w-xs">PDF Ready: {lesson.pdf_url}</span>}
                      </div>
                    )}

                    {lesson.content_type === 'text' && (
                      <textarea
                        rows="3"
                        placeholder="Write or paste manual lesson notes/text content here..."
                        value={lesson.text_content}
                        onChange={(e) => {
                          const updated = [...modules]
                          updated[mIdx].lessons[lIdx].text_content = e.target.value
                          setModules(updated)
                        }}
                        className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* اختبار الموديل (Quiz) */}
              <div className="space-y-4 pl-4 border-l-2 border-teal-500/30 pt-2">
                <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">Module Assessment (Quiz)</h3>
                <input
                  type="text"
                  placeholder="Quiz Title (e.g. Module 1 Assessment)"
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
                        <span className="text-xs text-gray-400">Question {qIdx + 1}</span>
                        {mod.quiz.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestion(mIdx, qIdx)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Delete Question
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Enter Question Text..."
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
                              placeholder={`Option ${oIdx + 1}`}
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
                    + Add Question
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* أزرار الحفظ */}
        <div className="flex gap-4 pt-6 border-t border-white/10">
          <button
            type="submit"
            disabled={busy}
            className="px-8 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-lg shadow-red-950/50"
          >
            {busy ? 'Creating Course & Curriculum...' : 'Save & Publish Course'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/admin/courses')}
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
