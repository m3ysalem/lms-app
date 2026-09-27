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

  // حالات نافذة تعديل بيانات الكورس الأساسية
  const [editingCourse, setEditingCourse] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // حالات نافذة إدارة المحتوى (المديولات، الدروس، والاختبارات)
  const [managingContentCourse, setManagingContentCourse] = useState(null)
  const [courseModules, setCourseModules] = useState([])
  const [loadingModules, setLoadingModules] = useState(false)
  const [savingContent, setSavingContent] = useState(false)

  const refresh = () => listAllCourses().then(setCourses)

  useEffect(() => {
    refresh()
    listCategories().then(setCategories)
    listTrainers().then(setTrainers)
  }, [])

  // جلب المديولات والدروس والاختبارات الخاصة بالكورس عند فتح محرر المحتوى
  const openContentManager = async (course) => {
    setManagingContentCourse(course)
    setLoadingModules(true)
    try {
      const { data: mods, error } = await supabase
        .from('modules')
        .select(`
          *,
          lessons (*),
          quizzes (
            *,
            questions (*)
          )
        `)
        .eq('course_id', course.id)
        .order('order_index', { ascending: true })

      if (error) throw error
      
      // تنظيم هيكل الاختبارات داخل المديولات لسهولة التعديل
      const formattedMods = (mods || []).map(m => ({
        ...m,
        quizTitle: m.quizzes?.[0]?.title || '',
        questions: m.quizzes?.[0]?.questions || []
      }))

      setCourseModules(formattedMods)
    } catch (err) {
      console.error(err)
      setCourseModules([])
    } finally {
      setLoadingModules(false)
    }
  }

  // إضافة مديول جديد للكورس الحالي
  const addModuleLocally = () => {
    setCourseModules(prev => [
      ...prev,
      {
        title: `Module ${prev.length + 1}`,
        order_index: prev.length + 1,
        lessons: [],
        quizTitle: '',
        questions: []
      }
    ])
  }

  // إضافة درس جديد لمديول معين
  const addLessonLocally = (mIdx) => {
    setCourseModules(prev => {
      const updated = [...prev]
      if (!updated[mIdx].lessons) updated[mIdx].lessons = []
      updated[mIdx].lessons.push({
        title: '',
        content_type: 'video',
        video_url: '',
        duration: 15
      })
      return updated
    })
  }

  // إضافة سؤال جديد لاختبار المديول
  const addQuestionLocally = (mIdx) => {
    setCourseModules(prev => {
      const updated = [...prev]
      if (!updated[mIdx].questions) updated[mIdx].questions = []
      updated[mIdx].questions.push({
        question_text: '',
        options: ['', '', '', ''],
        correct_answer: 0,
        points: 10
      })
      return updated
    })
  }

  // حفظ جميع التعديلات والمحتوى (المديولات، الدروس، والاختبارات) في قاعدة البيانات
  const saveAllContentChanges = async () => {
    if (!managingContentCourse) return
    try {
      setSavingContent(true)

      // 1. حذف المديولات القديمة لإعادة إدراجها بشكل نظيف ومحدث
      await supabase.from('modules').delete().eq('course_id', managingContentCourse.id)

      // 2. إعادة إدخال المديولات والدروس والاختبارات المحدثة
      for (let i = 0; i < courseModules.length; i++) {
        const mod = courseModules[i]
        const { data: newMod, error: modErr } = await supabase
          .from('modules')
          .insert([{
            course_id: managingContentCourse.id,
            title: mod.title,
            order_index: i + 1
          }])
          .select()
          .single()

        if (modErr || !newMod) continue

        // حفظ الدروس
        if (mod.lessons && mod.lessons.length > 0) {
          const lessonsToInsert = mod.lessons.map((l, lIdx) => ({
            module_id: newMod.id,
            course_id: managingContentCourse.id,
            title: l.title || `Lesson ${lIdx + 1}`,
            content_type: l.content_type || 'video',
            video_url: l.video_url || '',
            duration: Number(l.duration || 15),
            order_index: lIdx + 1
          }))
          await supabase.from('lessons').insert(lessonsToInsert)
        }

        // حفظ الاختبار (Quiz) والأسئلة المرتبطة به
        if (mod.quizTitle && mod.questions && mod.questions.length > 0) {
          const { data: newQuiz, error: qErr } = await supabase
            .from('quizzes')
            .insert([{
              module_id: newMod.id,
              course_id: managingContentCourse.id,
              title: mod.quizTitle
            }])
            .select()
            .single()

          if (!qErr && newQuiz) {
            const questionsToInsert = mod.questions.map((q, qIdx) => ({
              quiz_id: newQuiz.id,
              question_text: q.question_text,
              options: q.options || ['', '', '', ''],
              correct_answer: Number(q.correct_answer || 0),
              points: Number(q.points || 10),
              order_index: qIdx + 1
            }))
            await supabase.from('questions').insert(questionsToInsert)
          }
        }
      }

      alert('Curriculum, lessons and quizzes updated successfully!')
      setManagingContentCourse(null)
      refresh()
    } catch (err) {
      alert('Failed to save content: ' + err.message)
    } finally {
      setSavingContent(false)
    }
  }

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
    <div className="space-y-6 text-white relative">
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

              {/* زر إدارة المنهج (المديولات والدروس والاختبارات) */}
              <button
                type="button"
                onClick={() => openContentManager(c)}
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

      {/* نافذة تعديل المعلومات الأساسية (بـ z-index مرتفع لتكون فوق القائمة الجانبية تماماً) */}
      {editingCourse && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#1b222c] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl ml-auto mr-auto">
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

      {/* نافذة إدارة المنهج (Curriculum) والمديولات والدروس والاختبارات (بـ z-index مرتفع ومسافة أمان صحيحة) */}
      {managingContentCourse && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-[#14181d] border border-white/15 rounded-2xl max-w-4xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-teal-400">Manage Curriculum: {managingContentCourse.name}</h3>
                <p className="text-xs text-gray-400">Add or modify modules, lessons, and quizzes.</p>
              </div>
              <button onClick={() => setManagingContentCourse(null)} className="text-gray-400 hover:text-white text-lg font-bold">✕</button>
            </div>

            {loadingModules ? (
              <div className="py-12 flex justify-center"><Spinner /></div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold uppercase text-gray-300">Modules & Content</h4>
                  <button
                    type="button"
                    onClick={addModuleLocally}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg"
                  >
                    + Add New Module
                  </button>
                </div>

                {courseModules.map((mod, mIdx) => (
                  <div key={mIdx} className="bg-black/50 border border-white/10 p-5 rounded-xl space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <input
                        type="text"
                        value={mod.title}
                        onChange={(e) => {
                          const updated = [...courseModules]
                          updated[mIdx].title = e.target.value
                          setCourseModules(updated)
                        }}
                        className="bg-black/60 border border-white/20 rounded-lg p-2 font-bold text-sm text-white w-full max-w-sm"
                        placeholder="Module Title"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCourseModules(prev => prev.filter((_, idx) => idx !== mIdx))
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete Module
                      </button>
                    </div>

                    {/* الدروس */}
                    <div className="space-y-3 pl-4 border-l-2 border-rose-500/40">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-300">Lessons</span>
                        <button
                          type="button"
                          onClick={() => addLessonLocally(mIdx)}
                          className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
                        >
                          + Add Lesson
                        </button>
                      </div>

                      {mod.lessons?.map((lesson, lIdx) => (
                        <div key={lIdx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-black/40 p-2.5 rounded-lg border border-white/5">
                          <input
                            type="text"
                            placeholder="Lesson Title"
                            value={lesson.title}
                            onChange={(e) => {
                              const updated = [...courseModules]
                              updated[mIdx].lessons[lIdx].title = e.target.value
                              setCourseModules(updated)
                            }}
                            className="md:col-span-5 p-1.5 bg-black/40 border border-white/10 rounded text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Video/File URL"
                            value={lesson.video_url}
                            onChange={(e) => {
                              const updated = [...courseModules]
                              updated[mIdx].lessons[lIdx].video_url = e.target.value
                              setCourseModules(updated)
                            }}
                            className="md:col-span-5 p-1.5 bg-black/40 border border-white/10 rounded text-xs text-white"
                          />
                          <input
                            type="number"
                            placeholder="Mins"
                            value={lesson.duration}
                            onChange={(e) => {
                              const updated = [...courseModules]
                              updated[mIdx].lessons[lIdx].duration = e.target.value
                              setCourseModules(updated)
                            }}
                            className="md:col-span-1 p-1.5 bg-black/40 border border-white/10 rounded text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...courseModules]
                              updated[mIdx].lessons = updated[mIdx].lessons.filter((_, idx) => idx !== lIdx)
                              setCourseModules(updated)
                            }}
                            className="md:col-span-1 text-center text-red-400 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* اختبار المديول (Quiz) */}
                    <div className="space-y-3 pl-4 border-l-2 border-teal-500/40 pt-2">
                      <span className="text-xs font-semibold text-teal-400">Module Assessment (Quiz)</span>
                      <input
                        type="text"
                        placeholder="Quiz Title (e.g. Module Assessment)"
                        value={mod.quizTitle || ''}
                        onChange={(e) => {
                          const updated = [...courseModules]
                          updated[mIdx].quizTitle = e.target.value
                          setCourseModules(updated)
                        }}
                        className="w-full max-w-sm p-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                      />

                      <div className="space-y-2">
                        {mod.questions?.map((q, qIdx) => (
                          <div key={qIdx} className="bg-black/30 p-3 rounded-lg border border-white/10 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-400">Question {qIdx + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...courseModules]
                                  updated[mIdx].questions = updated[mIdx].questions.filter((_, idx) => idx !== qIdx)
                                  setCourseModules(updated)
                                }}
                                className="text-red-400 text-xs"
                              >
                                Delete
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder="Question Text..."
                              value={q.question_text}
                              onChange={(e) => {
                                const updated = [...courseModules]
                                updated[mIdx].questions[qIdx].question_text = e.target.value
                                setCourseModules(updated)
                              }}
                              className="w-full p-1.5 bg-black/40 border border-white/10 rounded text-xs text-white"
                            />
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addQuestionLocally(mIdx)}
                          className="text-xs bg-teal-600/20 text-teal-300 hover:bg-teal-600/30 px-3 py-1.5 rounded"
                        >
                          + Add Question
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setManagingContentCourse(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingContent}
                onClick={saveAllContentChanges}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium"
              >
                {savingContent ? 'Saving Curriculum...' : 'Save Curriculum Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
