import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCourseWithStructure, addModule, addLesson, addQuiz, addQuestion, addAnswers, updateCourse } from '../../lib/api'
import { Badge, Spinner } from '../../components/Ui'

const CONTENT_TYPES = ['text', 'video', 'external_video', 'external_url', 'pdf', 'pptx', 'docx', 'image']

export default function CourseBuilder() {
  const { courseId } = useParams()
  const [data, setData] = useState(null)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [lessonForms, setLessonForms] = useState({}) // moduleId -> form state
  const [questionForm, setQuestionForm] = useState({ text: '', type: 'multiple_choice', points: 1, answers: [{ text: '', correct: true }, { text: '', correct: false }] })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    getCourseWithStructure(courseId).then(setData)
  }, [courseId])

  useEffect(() => { load() }, [load])

  if (!data) return <Spinner />
  const { course, modules, quiz } = data

  const togglePublish = async () => {
    await updateCourse(course.id, {
      status: course.status === 'published' ? 'draft' : 'published',
      publish_date: course.status === 'published' ? course.publish_date : new Date().toISOString().slice(0, 10),
    })
    load()
  }

  const createModule = async (e) => {
    e.preventDefault()
    if (!newModuleTitle.trim()) return
    await addModule(courseId, newModuleTitle.trim(), modules.length + 1)
    setNewModuleTitle('')
    load()
  }

  const updateLessonForm = (moduleId, patch) => {
    setLessonForms((prev) => ({ ...prev, [moduleId]: { ...(prev[moduleId] || { title: '', content_type: 'text', body: '', video_url: '', duration_minutes: 10 }), ...patch } }))
  }

  const createLesson = async (moduleId, sortOrder) => {
    const form = lessonForms[moduleId]
    if (!form?.title?.trim()) return
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
    setBusy(false)
    load()
  }

  const createQuiz = async () => {
    await addQuiz(courseId, { title: `${course.name} — Final Quiz`, passing_score: course.passing_score, max_attempts: 3 })
    load()
  }

  const createQuestion = async () => {
    if (!questionForm.text.trim() || questionForm.answers.some((a) => !a.text.trim())) return
    setBusy(true)
    const q = await addQuestion(quiz.id, {
      question_text: questionForm.text,
      question_type: questionForm.type,
      points: Number(questionForm.points) || 1,
      sort_order: 0,
    })
    await addAnswers(q.id, questionForm.answers)
    setQuestionForm({ text: '', type: 'multiple_choice', points: 1, answers: [{ text: '', correct: true }, { text: '', correct: false }] })
    setBusy(false)
    load()
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link to="/admin/courses" className="text-sm text-teal hover:underline">← All courses</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold">{course.name}</h1>
          <div className="flex items-center gap-2">
            <Badge tone={course.status === 'published' ? 'success' : 'default'}>{course.status}</Badge>
            <button className="btn-secondary text-sm" onClick={togglePublish}>
              {course.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
        <p className="text-muted mt-1">{course.course_code} · Passing score {course.passing_score}%</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-head font-semibold text-lg">Modules &amp; lessons</h2>
        {modules.map((m) => (
          <div key={m.id} className="card p-4">
            <p className="font-medium text-ink-800 mb-2">{m.title}</p>
            <ul className="space-y-1 mb-3">
              {m.lessons.map((l) => (
                <li key={l.id} className="text-sm text-ink-700 flex items-center gap-2">
                  <span className="text-muted">•</span> {l.title} <Badge>{l.content_type}</Badge>
                </li>
              ))}
              {m.lessons.length === 0 && <li className="text-sm text-muted">No lessons yet.</li>}
            </ul>

            <details className="text-sm">
              <summary className="text-teal cursor-pointer select-none">+ Add lesson</summary>
              <div className="mt-3 space-y-2 border-t border-surface-border pt-3">
                <input className="input" placeholder="Lesson title" value={lessonForms[m.id]?.title || ''} onChange={(e) => updateLessonForm(m.id, { title: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <select className="input" value={lessonForms[m.id]?.content_type || 'text'} onChange={(e) => updateLessonForm(m.id, { content_type: e.target.value })}>
                    {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                  <input className="input" type="number" placeholder="Minutes" value={lessonForms[m.id]?.duration_minutes || ''} onChange={(e) => updateLessonForm(m.id, { duration_minutes: e.target.value })} />
                </div>
                {(lessonForms[m.id]?.content_type === 'video' || lessonForms[m.id]?.content_type === 'external_video') ? (
                  <input className="input" placeholder="Video URL (embed link)" value={lessonForms[m.id]?.video_url || ''} onChange={(e) => updateLessonForm(m.id, { video_url: e.target.value })} />
                ) : lessonForms[m.id]?.content_type === 'external_url' ? (
                  <input className="input" placeholder="External URL" value={lessonForms[m.id]?.body || ''} onChange={(e) => updateLessonForm(m.id, { body: e.target.value })} />
                ) : lessonForms[m.id]?.content_type === 'text' ? (
                  <textarea className="input" rows={3} placeholder="Lesson text content" value={lessonForms[m.id]?.body || ''} onChange={(e) => updateLessonForm(m.id, { body: e.target.value })} />
                ) : (
                  <p className="text-xs text-muted">File upload for this content type goes through Supabase Storage — see README "Storage buckets".</p>
                )}
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => createLesson(m.id, m.lessons.length + 1)}>
                  Add lesson
                </button>
              </div>
            </details>
          </div>
        ))}

        <form onSubmit={createModule} className="flex gap-2">
          <input className="input" placeholder="New module title" value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} />
          <button className="btn-secondary shrink-0">Add module</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-head font-semibold text-lg">Quiz</h2>
        {!quiz ? (
          <button className="btn-secondary" onClick={createQuiz}>Create final quiz</button>
        ) : (
          <div className="card p-4 space-y-4">
            <p className="text-sm text-muted">Passing score {quiz.passing_score}% · Max attempts {quiz.max_attempts}</p>

            <div className="space-y-2">
              <label className="label">Question text</label>
              <input className="input" value={questionForm.text} onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={questionForm.type} onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value })}>
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="true_false">True / False</option>
                  <option value="multiple_answer">Multiple answer</option>
                </select>
                <input className="input" type="number" min={1} value={questionForm.points} onChange={(e) => setQuestionForm({ ...questionForm, points: e.target.value })} />
              </div>
              <p className="label">Answers (check the correct one(s))</p>
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
                    className="input"
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
                className="text-teal text-sm hover:underline"
                onClick={() => setQuestionForm({ ...questionForm, answers: [...questionForm.answers, { text: '', correct: false }] })}
              >
                + Add answer option
              </button>
              <div>
                <button className="btn-primary" disabled={busy} onClick={createQuestion}>Add question</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
