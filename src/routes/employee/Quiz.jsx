import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getCourseWithStructure, startQuizAttempt, getQuizQuestions, submitQuizAttempt, issueCertificate } from '../../lib/api'
import { downloadCertificatePdf } from '../../lib/certificate'
import { Spinner, Badge } from '../../components/Ui'

export default function Quiz() {
  const { courseId } = useParams()
  const { profile } = useAuth()
  const [course, setCourse] = useState(null)
  const [quiz, setQuiz] + useState(null)
  const [quizState, setQuizState] = useState(null) // بديل لتجنب تضارب الأسماء
  const [questions, setQuestions] = useState([])   // تأمين القيمة بمصفوفة فارغة ابتدائياً
  const [attemptId, setAttemptId] = useState(null)
  const [answers, setAnswers] = useState({}) // question_id -> [answer_id,...]
  const [result, setResult] = useState(null)
  const [certificate, setCertificate] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCourseWithStructure(courseId)
      .then((res) => {
        setCourse(res?.course || null)
        setQuiz(res?.quiz || null)
      })
      .catch((e) => setError(e.message))
  }, [courseId])

  const begin = async () => {
    setError('')
    try {
      if (!quiz?.id || !profile?.id) return
      const attempt = await startQuizAttempt(profile.id, quiz.id)
      setAttemptId(attempt.id)
      
      const qs = await getQuizQuestions(quiz.id)
      // تأمين الأسئلة لضمان أنها مصفوفة دائماً مهما كانت الاستجابة
      setQuestions(Array.isArray(qs) ? qs : [])
    } catch (e) {
      setError(e.message)
    }
  }

  const toggleAnswer = (questionId, answerId, multi) => {
    setAnswers((prev) => {
      const current = prev[questionId] || []
      if (multi) {
        return { ...prev, [questionId]: current.includes(answerId) ? current.filter((a) => a !== answerId) : [...current, answerId] }
      }
      return { ...prev, [questionId]: [answerId] }
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const safeQuestions = Array.isArray(questions) ? questions : []
      const payload = safeQuestions.map((q) => ({ question_id: q.id, selected_answer_ids: answers[q.id] || [] }))
      const res = await submitQuizAttempt(attemptId, payload)
      setResult(res)
      if (res?.passed && course?.certificate_eligible) {
        const cert = await issueCertificate(courseId)
        setCertificate(cert)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!course) return <Spinner />
  if (!quiz) return <p className="text-muted">This course has no quiz configured.</p>

  const safeQuestionsList = Array.isArray(questions) ? questions : []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to={`/courses/${courseId}`} className="text-sm text-teal hover:underline">← Back to course</Link>
      <h1 className="text-2xl font-bold">{quiz.title}</h1>

      {error && <div className="text-sm text-danger bg-danger-light border border-danger-light rounded px-3 py-2">{error}</div>}

      {!attemptId && !result && (
        <div className="card p-6">
          <p className="text-ink-700 mb-1">Passing score: <strong>{quiz.passing_score}%</strong></p>
          {quiz.time_limit_minutes && <p className="text-ink-700 mb-1">Time limit: {quiz.time_limit_minutes} minutes</p>}
          <p className="text-ink-700 mb-4">Maximum attempts: {quiz.max_attempts}</p>
          <button className="btn-primary" onClick={begin}>Start quiz</button>
        </div>
      )}

      {attemptId && !result && (
        <div className="space-y-5">
          {safeQuestionsList.map((q, i) => {
            const safeAnswers = Array.isArray(q.answers) ? q.answers : []
            const multi = q.type === 'multiple_answer'
            return (
              <div key={q.id || i} className="card p-5">
                <p className="font-medium text-ink-800 mb-3">{i + 1}. {q.text}</p>
                <div className="space-y-2">
                  {safeAnswers.map((a) => {
                    const checked = (answers[q.id] || []).includes(a.id)
                    return (
                      <label key={a.id} className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                        <input
                          type={multi ? 'checkbox' : 'radio'}
                          name={q.id}
                          checked={checked}
                          onChange={() => toggleAnswer(q.id, a.id, multi)}
                        />
                        {a.text}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Submitting…' : 'Submit quiz'}
          </button>
        </div>
      )}

      {result && (
        <div className="card p-6 text-center">
          <Badge tone={result.passed ? 'success' : 'danger'}>{result.passed ? 'Passed' : 'Not passed'}</Badge>
          <p className="text-3xl font-head font-bold mt-3">{result.percentage}%</p>
          <p className="text-muted mt-1">{result.score_points} / {result.total_points} points</p>

          {result.passed && certificate && (
            <div className="mt-6 pt-6 border-t border-surface-border">
              <p className="text-ink-700 mb-3">Your certificate is ready.</p>
              <button
                className="btn-primary"
                onClick={() => downloadCertificatePdf({
                  cert_number: certificate.cert_number,
                  employee_name: profile.full_name,
                  course_name: course.name,
                  issued_date: certificate.issued_date,
                  trainer_name: certificate.trainer_name,
                  final_score: certificate.final_score,
                })}
              >
                Download certificate (PDF)
              </button>
            </div>
          )}
          {!result.passed && (
            <p className="text-sm text-muted mt-4">
              Review the course material and try again — you have {quiz.max_attempts} attempts in total.
            </p>
          )}
          <div className="mt-6">
            <Link to={`/courses/${courseId}`} className="text-sm text-teal hover:underline">Back to course</Link>
          </div>
        </div>
      )}
    </div>
  )
}
