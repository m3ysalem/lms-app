import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCourseWithStructure, addModule, addLesson, addQuiz, addQuestion, addAnswers, updateCourse } from '../../lib/api'
import { supabase } from '../../lib/supabaseClient'
import { Badge, Spinner } from '../../components/Ui'

const CONTENT_TYPES = ['text', 'video', 'external_video', 'external_url', 'pdf', 'pptx', 'docx', 'image']

export default function CourseBuilder() {
  const { courseId } = useParams()
  const [data, setData] = useState(null)
  const [departments, setDepartments] = useState([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [lessonForms, setLessonForms] = useState({})
  const [uploadingFile, setUploadingFile] = useState(false)
  const [questionForm, setQuestionForm] = useState({ 
    text: '', 
    type: 'multiple_choice', 
    points: 1, 
    correct_answer_text: '', 
    answers: [{ text: '', correct: true }, { text: '', correct: false }] 
  })
  const [busy, setBusy] = useState(false)

  // جلب الأقسام المتاحة من قاعدة البيانات
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const { data: deptData, error } = await supabase.from('departments').select('id, name')
        if (!error && deptData) {
          setDepartments(deptData)
        }
      } catch (err) {
        console.error('Error fetching departments:', err)
      }
    }
    fetchDepartments()
  }, [])

  const load = useCallback(() => {
    getCourseWithStructure(courseId).then((res) => {
      setData(res)
      if (res?.course?.department_id) {
        setSelectedDepartmentId(res.course.department_id)
      }
    }).catch((err) => {
      console.error('Error loading course structure:', err)
    })
  }, [courseId])

  useEffect(() => { load() }, [load])

  if (!data) return <Spinner />
  const { course, modules, quiz } = data

  const togglePublish = async () => {
    try {
      await updateCourse(course.id, {
        status: course.status === 'published' ? 'draft' : 'published',
        publish_date: course.status === 'published' ? course.publish_date : new Date().toISOString().slice(0, 10),
      })
      load()
    } catch (err) {
      alert('Error updating status: ' + err.message)
    }
  }

  // تحديث الإدارة المستهدفة للكورس مباشرة عند تغييرها
  const handleDepartmentChange = async (e) => {
    const newDeptId = e.target.value
    setSelectedDepartmentId(newDeptId)
    try {
      await updateCourse(course.id, {
        department_id: newDeptId || null
      })
    } catch (err) {
      alert('Failed to update course department: ' + err.message)
    }
  }

  const createModule = async (e) => {
    e.preventDefault()
    if (!newModuleTitle.trim()) return
    try {
      setBusy(true)
      await addModule(courseId, newModuleTitle.trim(), modules.length + 1)
      setNewModuleTitle('')
      load()
    } catch (err) {
      console.error('Error creating module:', err)
      alert('Failed to add module: ' + (err.message || JSON.stringify(err)))
    } finally {
      setBusy(false)
    }
  }

  const updateLessonForm = (moduleId, patch) => {
    setLessonForms((prev) => ({ ...prev, [moduleId]: { ...(prev[moduleId] || { title: '', content_type: 'text', body: '', video_url: '', duration_minutes: 10 }), ...patch } }))
  }

  // دالة رفع الملف (PDF, Word, Images) إلى Supabase Storage
  const handleFileUpload = async (moduleId, e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      setUploadingFile(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${courseId}/${fileName}`

      // رفع الملف إلى Bucket اسمها 'course-files' (تأكد من إنشائها في Supabase Storage كـ Public)
      const { error: uploadError } = await supabase.storage
        .from('course-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // الحصول على الرابط العام للملف المرفوع
      const { data: publicUrlData } = supabase.storage
        .from('course-files')
        .getPublicUrl(filePath)

      const fileUrl = publicUrlData.publicUrl

      // تحديث الـ form بالرابط المباشر للملف في خانة الـ body
      updateLessonForm(moduleId, { body: fileUrl })
      alert('File uploaded successfully!')
    } catch (err) {
      console.error('Error uploading file:', err)
      alert('Failed to upload file: ' + err.message)
    } finally {
      setUploadingFile(false)
    }
  }

  const createLesson = async (moduleId, sortOrder) => {
    const form = lessonForms[moduleId]
    if (!form?.title?.trim()) return
    try {
      setBusy(true)
      await addLesson(moduleId, {
        title: form.title.trim(),
        content_type: form.content_type,
        body: form.body,
        video_url: form.video_url,
        duration_minutes: Number(form.duration_minutes) || 0,
        sort_order: sortOrder,
      })
      setLessonForms((prev) => ({ ...prev, [moduleId]: undefined }))
      load()
    } catch (err) {
      alert('Failed to add lesson: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const createQuiz = async () => {
    try {
      await addQuiz(courseId, { title: `${course.name} — Final Quiz`, passing_score: course.passing_score, max_attempts: 3 })
      load()
    } catch (err) {
      alert('Failed to create quiz: ' + err.message)
    }
  }

  const createQuestion = async () => {
    const isText = questionForm.type === 'text' || questionForm.type === 'essay'
    if (!questionForm.text.trim()) return
    if (!isText && questionForm.answers.some((a) => !a.text.trim())) return
    if (isText && !questionForm.correct_answer_text.trim()) return

    try {
      setBusy(true)
      const q = await addQuestion(quiz.id, {
        question_text: questionForm.text,
        question_type: questionForm.type,
        points: Number(questionForm.points) || 1,
        correct_answer_text: isText ? questionForm.correct_answer_text : '',
        sort_order: 0,
      })
      
      if (!isText) {
        await addAnswers(q.id, questionForm.answers)
      }

      setQuestionForm({ 
        text: '', 
        type: 'multiple_choice', 
        points: 1, 
        correct_answer_text: '', 
        answers: [{ text: '', correct: true }, { text: '', correct: false }] 
      })
      load()
    } catch (err) {
      alert('Failed to add question: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl text-white">
      <div>
        <Link to="/admin/courses" className="text-sm text-rose-400 hover:underline">← All courses</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold">{course.name}</h1>
          <div className="flex items-center gap-2">
            <Badge tone={course.status === 'published' ? 'success' : 'default'}>{course.status}</Badge>
            <button className="px-3 py-1.5 rounded-lg bg-white/10 text-sm hover:bg-white/20 transition-colors" onClick={togglePublish}>
              {course.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
        <p className="text-gray-400 mt-1">{course.course_code} · Passing score {course.passing_score}%</p>
      </div>

      {/* خانة اختيار الإدارة المستهدفة للكورس */}
      <div className="p-4 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl space-y-2">
        <label className="block text-sm font-medium text-gray-300">Target Department (الإدارة المستهدفة للكورس)</label>
        <select
          className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none"
          value={selectedDepartmentId}
          onChange={handleDepartmentChange}
        >
          <option value="">All Departments (عام لكل الإدارات)</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id} className="bg-gray-900 text-white">
              {dept.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400">إذا حددت إدارة معينة، فلن يظهر هذا الكورس إلا للموظفين التابعين لنفس هذه الإدارة.</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-head font-semibold text-lg">Modules &amp; lessons</h2>
        {modules.map((m) => (
          <div key={m.id} className="p-4 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl space-y-3">
            <p className="font-medium text-white mb-2">{m.title}</p>
            <ul className="space-y-1 mb-3">
              {m.lessons.map((l) => (
                <li key={l.id} className="text-sm text-gray-300 flex items-center gap-2">
                  <span className="text-gray-500">•</span> {l.title} <Badge>{l.content_type}</Badge>
                </li>
              ))}
              {m.lessons.length === 0 && <li className="text-sm text-gray-400">No lessons yet.</li>}
            </ul>

            <details className="text-sm">
              <summary className="text-rose-400 cursor-pointer select-none font-medium">+ Add lesson</summary>
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <input className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" placeholder="Lesson title" value={lessonForms[m.id]?.title || ''} onChange={(e) => updateLessonForm(m.id, { title: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <select className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" value={lessonForms[m.id]?.content_type || 'text'} onChange={(e) => updateLessonForm(m.id, { content_type: e.target.value })}>
                    {CONTENT_TYPES.map((t) => <option key={t} value={t} className="bg-gray-900">{t.replace('_', ' ')}</option>)}
                  </select>
                  <input className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" type="number" placeholder="Minutes" value={lessonForms[m.id]?.duration_minutes || ''} onChange={(e) => updateLessonForm(m.id, { duration_minutes: e.target.value })} />
                </div>
                {(lessonForms[m.id]?.content_type === 'video' || lessonForms[m.id]?.content_type === 'external_video') ? (
                  <input className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" placeholder="Video URL (embed link)" value={lessonForms[m.id]?.video_url || ''} onChange={(e) => updateLessonForm(m.id, { video_url: e.target.value })} />
                ) : lessonForms[m.id]?.content_type === 'external_url' ? (
                  <input className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" placeholder="External URL" value={lessonForms[m.id]?.body || ''} onChange={(e) => updateLessonForm(m.id, { body: e.target.value })} />
                ) : lessonForms[m.id]?.content_type === 'text' ? (
                  <textarea className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" rows={3} placeholder="Lesson text content" value={lessonForms[m.id]?.body || ''} onChange={(e) => updateLessonForm(m.id, { body: e.target.value })} />
                ) : (
                  /* خانة رفع ملفات الـ PDF أو Word أو الصور */
                  <div className="space-y-2 p-3 rounded-xl bg-black/20 border border-white/10">
                    <label className="block text-xs font-medium text-gray-300">Upload File (PDF, Word, PPT, Image):</label>
                    <input 
                      type="file" 
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" 
                      className="w-full text-xs text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-rose-500/20 file:text-rose-300 hover:file:bg-rose-500/30 cursor-pointer"
                      onChange={(e) => handleFileUpload(m.id, e)} 
                    />
                    {uploadingFile && <p className="text-xs text-yellow-400 animate-pulse">Uploading file to storage...</p>}
                    {lessonForms[m.id]?.body && (
                      <p className="text-xs text-green-400 truncate">File ready: {lessonForms[m.id]?.body}</p>
                    )}
                  </div>
                )}
                <button type="button" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors" disabled={busy || uploadingFile} onClick={() => createLesson(m.id, m.lessons.length + 1)}>
                  Add lesson
                </button>
              </div>
            </details>
          </div>
        ))}

        <form onSubmit={createModule} className="flex gap-2">
          <input className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" placeholder="New module title" value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} />
          <button type="submit" className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 font-medium shrink-0 transition-colors" disabled={busy}>Add module</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-head font-semibold text-lg">Quiz</h2>
        {!quiz ? (
          <button className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-medium transition-colors" onClick={createQuiz}>Create final quiz</button>
        ) : (
          <div className="p-4 rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl space-y-4">
            <p className="text-sm text-gray-400">Passing score {quiz.passing_score}% · Max attempts {quiz.max_attempts}</p>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Question text</label>
              <input className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" value={questionForm.text} onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" value={questionForm.type} onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value })}>
                  <option value="multiple_choice" className="bg-gray-900">Multiple choice</option>
                  <option value="true_false" className="bg-gray-900">True / False</option>
                  <option value="multiple_answer" className="bg-gray-900">Multiple answer</option>
                  <option value="text" className="bg-gray-900">Text / Essay</option>
                </select>
                <input className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" type="number" min={1} value={questionForm.points} onChange={(e) => setQuestionForm({ ...questionForm, points: e.target.value })} />
              </div>

              {(questionForm.type === 'text' || questionForm.type === 'essay') ? (
                <div className="space-y-1 mt-2">
                  <label className="block text-sm font-medium text-gray-300">Correct Answer (Model Answer for evaluation)</label>
                  <textarea 
                    className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none" 
                    rows={2} 
                    placeholder="Type the correct model answer here..." 
                    value={questionForm.correct_answer_text} 
                    onChange={(e) => setQuestionForm({ ...questionForm, correct_answer_text: e.target.value })} 
                  />
                </div>
              ) : (
                <>
                  <p className="block text-sm font-medium text-gray-300">Answers (check the correct one(s))</p>
                  {questionForm.answers.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type={questionForm.type === 'multiple_answer' ? 'checkbox' : 'radio'}
                        checked={a.correct}
                        onChange={() => {
                          const answers = questionForm.answers.map((x, xi) =>
                            questionForm.type === 'multiple_answer'
                              ? (xi === i ? { ...x, correct: !x.correct } : x)
                              : { ...x, correct: xi === i }
                          )
                          setQuestionForm({ ...questionForm, answers })
                        }}
                      />
                      <input
                        className="w-full p-2.5 border rounded-lg bg-black/40 border-white/10 text-white focus:border-rose-500 focus:outline-none"
                        placeholder={`Answer ${i + 1}`}
                        value={a.text}
                        onChange={(e) => {
                          const answers = [...questionForm.answers]
                          answers[i] = { ...answers[i], text: e.target.value }
                          setQuestionForm({ ...questionForm, answers })
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-rose-400 text-sm hover:underline font-medium"
                    onClick={() => setQuestionForm({ ...questionForm, answers: [...questionForm.answers, { text: '', correct: false }] })}
                  >
                    + Add answer option
                  </button>
                </>
              )}

              <div className="pt-2">
                <button type="button" className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#9E1B1B] to-rose-700 text-white font-medium shadow-lg shadow-red-950/50" disabled={busy} onClick={createQuestion}>Add question</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
