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
    if (!profile?.id) return
    Promise.all([
      getCourseWithStructure(courseId),
      getLessonProgress(profile.id, courseId),
      getMyCertificates(profile.id),
    ])
      .then(([d, lp, certs]) => {
        setData(d)
        setLessonProgress(lp || {})
        setCertificate(certs?.find((c) => c.course?.id === courseId) || null)
        const allL = d.modules?.flatMap((m) => m.lessons) || []
        const firstIncomplete = allL.find((l) => lp?.[l.id]?.status !== 'completed')
        setActiveLessonId(firstIncomplete?.id ?? allL[0]?.id ?? null)
      })
      .catch((e) => setError(e.message))
  }, [courseId, profile?.id])

  useEffect(() => { load() }, [load])

  const allLessons = useMemo(() => data?.modules ? data.modules.flatMap((m) => m.lessons) : [], [data])
  const activeLesson = allLessons.find((l) => l.id === activeLessonId)
  const completedCount = allLessons.filter((l) => lessonProgress[l.id]?.status === 'completed').length
  const percent = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0

  const goTo = (id) => setActiveLessonId(id)

  const completeAndAdvance = async () => {
    if (!activeLesson) return
    await markLessonComplete(profile.id, activeLesson.id)
    const newLp = { ...lessonProgress, [activeLesson.id]: { status: 'completed' } }
    setLessonProgress(newLp)
    const newCompleted = allLessons.filter((l) => newLp[l.id]?.status === 'completed').length
    const newPercent = Math.round((newCompleted / allLessons.length) * 100)
    await upsertCourseProgress(profile.id, courseId, newPercent)

    const idx = allLessons.findIndex((l) => l.id === activeLesson.id)
    const next = allLessons[idx + 1]
    if (next) setActiveLessonId(next.id)
  }

  if (error) return <div className="text-danger p-4">{error}</div>
  if (!data) return <Spinner />

  const { course } = data

  return (
    <div className="space-y-6">
      <div>
        <Link to="/courses" className="text-sm text-teal hover:underline">← Back to catalog</Link>
        <h1 className="text-2xl font-bold mt-2 text-white">{course?.name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-48"><ProgressBar percent={percent} /></div>
          <span className="text-sm text-muted">{percent}% complete</span>
          {certificate && <Badge tone="success">Certificate issued</Badge>}
        </div>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        {/* Lesson navigator */}
        <aside className="card p-3 h-fit">
          {data.modules?.map((m) => (
            <div key={m.id} className="mb-3 last:mb-0">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide px-2 mb-1">{m.title}</p>
              {m.lessons?.map((l) => {
                const status = lessonProgress[l.id]?.status
                const isActive = l.id === activeLessonId
                return (
                  <button
                    key={l.id}
                    onClick={() => goTo(l.id)}
                    className={`w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 ${isActive ? 'bg-teal-light text-teal-dark font-medium' : 'hover:bg-surface text-ink-700'}`}
                  >
                    <span className="w-4 shrink-0">
                      {status === 'completed' ? '✓' : isActive ? '▶' : '○'}
                    </span>
                    {l.title}
                  </button>
                )
              })}
            </div>
          ))}
          
          {/* زر الاختبار بتصميم متناسق مع الدارك مود */}
          <Link
            to={`/courses/${courseId}/quiz`}
            style={{ backgroundColor: '#0d9488', display: 'block', marginTop: '16px', padding: '10px 12px', borderRadius: '8px', textAlign: 'center', textDecoration: 'none' }}
          >
            <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>📝 Take Course Quiz →</span>
          </Link>
        </aside>

        {/* Lesson content */}
        <div className="card p-6">
          {!activeLesson ? (
            <p className="text-muted">This course has no lessons yet.</p>
          ) : (
            <>
              <h2 className="font-head text-xl font-semibold mb-4 text-white">{activeLesson.title}</h2>

              {activeLesson.content_type === 'text' && (
                <p className="text-ink-300 leading-relaxed whitespace-pre-line">{activeLesson.body}</p>
              )}
              {(activeLesson.content_type === 'video' || activeLesson.content_type === 'external_video') && activeLesson.video_url && (
                <div className="aspect-video bg-ink-900 rounded overflow-hidden mb-4">
                  <iframe 
                    title={activeLesson.title} 
                    src={getEmbedUrl(activeLesson.video_url)} 
                    className="w-full h-full" 
                    allowFullScreen 
                  />
                </div>
              )}
              {activeLesson.content_type === 'external_url' && activeLesson.body && (
                <a href={activeLesson.body} target="_blank" rel="noreferrer" className="text-teal hover:underline">
                  Open external resource →
                </a>
              )}
              {['pdf', 'pptx', 'docx', 'image'].includes(activeLesson.content_type) && (
                <div className="space-y-4">
                  <p className="text-sm text-muted">
                    Attached material ({activeLesson.content_type.toUpperCase()}):
                  </p>
                  {activeLesson.body ? (
                    <a
                      href={activeLesson.body}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal text-white font-medium hover:opacity-90 transition-opacity text-sm"
                    >
                      📥 Download / View File →
                    </a>
                  ) : (
                    <p className="text-sm text-red-400">No file attached to this lesson.</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-8 pt-4 border-t border-surface-border">
                {/* زر السابق بتصميم مريح للعين في الدارك مود */}
                <button
                  style={{ backgroundColor: '#374151', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                  disabled={allLessons.findIndex((l) => l.id === activeLesson.id) === 0}
                  onClick={() => {
                    const idx = allLessons.findIndex((l) => l.id === activeLesson.id)
                    if (idx > 0) setActiveLessonId(allLessons[idx - 1].id)
                  }}
                >
                  <span style={{ color: '#ffffff', fontWeight: 'bold' }}>← Previous</span>
                </button>
                <button className="btn-primary" onClick={completeAndAdvance}>
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
