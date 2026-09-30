import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getCourseWithStructure, getLessonProgress, markLessonComplete, upsertCourseProgress,
  getMyCertificates,
} from '../../lib/api'
import { Badge, ProgressBar, Spinner } from '../../components/Ui'

function getEmbedUrl(url) {
  if (!url) return ''
  if (url.includes('embed/')) return url

  let videoId = ''
  if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0]
  } else if (url.includes('watch?v=')) {
    videoId = url.split('watch?v=')[1]?.split('&')[0]
  }

  return videoId ? `https://www.youtube.com/embed/${videoId}` : url
}

export default function CoursePlayer() {
  const { courseId } = useParams()
  const { profile } = useAuth()
  const [data, setData] = useState(null)
  const [lessonProgress, setLessonProgress] = useState({})
  const [activeLessonId, setActiveLessonId] = useState(null)
  const [certificate, setCertificate] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    const employeeId = profile?.id || 'guest'

    Promise.all([
      getCourseWithStructure(courseId),
      profile?.id ? getLessonProgress(profile.id, courseId) : Promise.resolve({}),
      profile?.id ? getMyCertificates(profile.id) : Promise.resolve([]),
    ])
      .then(([d, lp, certs]) => {
        setData(d)
        setLessonProgress(lp || {})
        setCertificate(certs?.find((c) => c.course?.id === courseId || c.course_id === courseId) || null)
        
        const modulesList = d?.modules || []
        const allL = modulesList.flatMap((m) => m.lessons || m.items || [])
        const firstIncomplete = allL.find((l) => lp?.[l.id]?.status !== 'completed')
        setActiveLessonId(firstIncomplete?.id ?? allL[0]?.id ?? null)
      })
      .catch((e) => setError(e.message))
  }, [courseId, profile?.id])

  useEffect(() => { 
    load() 
  }, [load])

  const allLessons = useMemo(() => {
    if (!data?.modules) return []
    return data.modules.flatMap((m) => m.lessons || m.items || [])
  }, [data])

  const activeLesson = allLessons.find((l) => l.id === activeLessonId)
  const completedCount = allLessons.filter((l) => lessonProgress[l.id]?.status === 'completed').length
  const percent = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0

  const goTo = (id) => setActiveLessonId(id)

  const completeAndAdvance = async () => {
    if (!activeLesson || !profile?.id) return
    try {
      await markLessonComplete(profile.id, activeLesson.id)
      const newLp = { ...lessonProgress, [activeLesson.id]: { status: 'completed' } }
      setLessonProgress(newLp)
      
      const newCompleted = allLessons.filter((l) => newLp[l.id]?.status === 'completed').length
      const newPercent = allLessons.length ? Math.round((newCompleted / allLessons.length) * 100) : 0
      
      // هذا السطر يضمن تحديث التقارير وحالة الكورس فوراً في جدول course_progress و course_assignments
      await upsertCourseProgress(profile.id, courseId, newPercent)

      const idx = allLessons.findIndex((l) => l.id === activeLesson.id)
      const next = allLessons[idx + 1]
      if (next) setActiveLessonId(next.id)
    } catch (err) {
      console.error('Failed to update progress:', err)
    }
  }

  if (error) return <div className="text-red-400 p-4">Error: {error}</div>
  if (!data) return <div className="flex justify-center p-12"><Spinner /></div>

  const { course, quizzes } = data

  return (
    <div className="space-y-6 text-white">
      <div>
        <Link to="/courses" className="text-sm text-teal-400 hover:underline">← Back to catalog</Link>
        <h1 className="text-2xl font-bold mt-2 text-white">{course?.name || course?.title || 'Course Details'}</h1>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-48"><ProgressBar percent={percent} /></div>
          <span className="text-sm text-gray-400">{percent}% complete</span>
          {certificate && <Badge tone="success">Certificate issued</Badge>}
        </div>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        {/* Lesson navigator */}
        <aside className="p-4 rounded-xl bg-[#14181d]/85 border border-white/10 h-fit space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2">Course Modules</h3>
          
          {(!data.modules || data.modules.length === 0) ? (
            <p className="text-sm text-gray-500 px-2">No modules found for this course.</p>
          ) : (
            data.modules.map((m) => {
              const moduleLessons = m.lessons || m.items || []
              return (
                <div key={m.id || m.title} className="mb-3 last:mb-0">
                  <p className="text-xs font-bold text-gray-300 px-2 mb-1">{m.title}</p>
                  {moduleLessons.length === 0 ? (
                    <p className="text-xs text-gray-500 px-2 italic">No lessons in this module</p>
                  ) : (
                    moduleLessons.map((l) => {
                      const status = lessonProgress[l.id]?.status
                      const isActive = l.id === activeLessonId
                      return (
                        <button
                          key={l.id}
                          onClick={() => goTo(l.id)}
                          className={`w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 transition-all ${
                            isActive 
                              ? 'bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30' 
                              : 'hover:bg-white/5 text-gray-300'
                          }`}
                        >
                          <span className="w-4 shrink-0">
                            {status === 'completed' ? '✓' : isActive ? '▶' : '○'}
                          </span>
                          <span className="truncate">{l.title}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              )
            })
          )}
          
          {/* زر الاختبار - يتم ربطه بالكورس مباشرة */}
          <Link
            to={`/courses/${courseId}/quiz`}
            className="block mt-4 p-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-center text-white font-bold text-sm transition-colors shadow-lg"
          >
            📝 Take Course Quiz ({quizzes?.length || 0}) →
          </Link>
        </aside>

        {/* Lesson content */}
        <div className="p-6 rounded-xl bg-[#14181d]/85 border border-white/10">
          {!activeLesson ? (
            <p className="text-gray-400">Please select a lesson from the sidebar or this course has no lessons yet.</p>
          ) : (
            <>
              <h2 className="font-head text-xl font-semibold mb-4 text-white">{activeLesson.title}</h2>

              {activeLesson.content_type === 'text' && (
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">{activeLesson.body || activeLesson.text_content}</p>
              )}
              {(activeLesson.content_type === 'video' || activeLesson.content_type === 'external_video') && (activeLesson.video_url || activeLesson.body) && (
                <div className="aspect-video bg-black rounded overflow-hidden mb-4">
                  <iframe 
                    title={activeLesson.title} 
                    src={getEmbedUrl(activeLesson.video_url || activeLesson.body)} 
                    className="w-full h-full" 
                    allowFullScreen 
                  />
                </div>
              )}
              {activeLesson.content_type === 'external_url' && activeLesson.body && (
                <a href={activeLesson.body} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
                  Open external resource →
                </a>
              )}
              {['pdf', 'pptx', 'docx', 'image'].includes(activeLesson.content_type) && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Attached material ({activeLesson.content_type.toUpperCase()}):
                  </p>
                  {(activeLesson.pdf_url || activeLesson.body) ? (
                    <a
                      href={activeLesson.pdf_url || activeLesson.body}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-500 transition-colors text-sm"
                    >
                      📥 Download / View File →
                    </a>
                  ) : (
                    <p className="text-sm text-red-400">No file attached to this lesson.</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/10">
                <button
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm disabled:opacity-50"
                  disabled={allLessons.findIndex((l) => l.id === activeLesson.id) === 0}
                  onClick={() => {
                    const idx = allLessons.findIndex((l) => l.id === activeLesson.id)
                    if (idx > 0) setActiveLessonId(allLessons[idx - 1].id)
                  }}
                >
                  ← Previous
                </button>
                <button className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-colors" onClick={completeAndAdvance}>
                  {lessonProgress[activeLesson.id]?.status === 'completed' ? 'Next lesson →' : 'Mark complete & continue'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
