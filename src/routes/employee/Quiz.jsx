import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getCourseWithStructure, startQuizAttempt, submitQuizAttempt, issueCertificate } from '../../lib/api'
import { downloadCertificatePdf } from '../../lib/certificate'
import { Spinner, Badge } from '../../components/Ui'
import { supabase } from '../../lib/supabaseClient'

export default function Quiz() {
  const { courseId } = useParams()
  const { profile } = useAuth()
  const [course, setCourse] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attemptId, setAttemptId] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [certificate, setCertificate] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadQuizData = useCallback(async () => {
    try {
      const courseData = await getCourseWithStructure(courseId)
      setCourse(courseData?.course || null)

      let foundQuiz = courseData?.quiz || null

      // إذا لم يرجعه الهيكل، نبحث عنه مباشرة في جدول quizzes
      if (!foundQuiz) {
        const { data: qData } = await supabase
          .from('quizzes')
          .select('*')
          .eq('course_id', courseId)
          .maybeSingle()
        foundQuiz = qData
      }

      setQuiz(foundQuiz)

      // جلب الأسئلة الحقيقية والإجابات الخاصة بها من قاعدة البيانات مباشرة لضمان ظهور أسئلة الأدمن
      if (foundQuiz?.id) {
        const { data: qList, err } = await supabase
          .from('questions')
          .select('*, answers(*)')
          .eq('quiz_id', foundQuiz.id)

        if (!err && qList && qList.length > 0) {
          setQuestions(qList)
        } else {
          // محاولة جلبها من جدول الـ quiz_questions إذا كان التصميم يعتمد جدول وسيط
          const { data: qqList } = await supabase
            .from('quiz_questions')
            .select('question:questions(*, answers(*))')
            .eq('quiz_id', foundQuiz.id)
          
          if (qqList && qqList.length > 0) {
            setQuestions(qqList.map(item => item.question).filter(Boolean))
          }
        }
      }
    } catch (e) {
      setError(e.message)
    }
  }, [courseId])

  useEffect(() => {
    loadQuizData()
  }, [loadQuizData])

  const begin = async () => {
    setError('')
    try {
      if (!quiz?.id || !profile?.id) return
      const attempt = await startQuizAttempt(profile.id, quiz.id)
      setAttemptId(attempt.id)
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

  const handleTextAnswer = (questionId, textValue) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: textValue
    }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const safeQuestions = Array.isArray(questions) ? questions : []
      const payload = safeQuestions.map((q) => {
        const isText = q.type === 'text' || q.type === 'essay'
        return {
          question_id: q.id,
          selected_answer_ids: isText ? [] : (answers[q.id] || []),
          text_answer: isText ? (answers[q.id] || '') : undefined
        }
      })
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

  if (!course && !quiz) return <Spinner />
  if (!quiz) return <p className="text-white p-4">This course has no quiz configured.</p>

  const safeQuestionsList = Array.isArray(questions) ? questions : []

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <Link to={`/courses/${courseId}`} className="text-sm text-teal-400 hover:underline font-bold">← Back to course</Link>
      <h1 className="text-2xl font-bold text-white">{quiz.title}</h1>

      {error && <div className="text-sm text-red-500 bg-red-100 border border-red-200 rounded px-3 py-2">{error}</div>}

      {!attemptId && !result && (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
          <p className="text-gray-300 mb-1">Passing score: <strong>{quiz.passing_score}%</strong></p>
          {quiz.time_limit_minutes && <p className="text-gray-300 mb-1">Time limit: {quiz.time_limit_minutes} minutes</p>}
          <p className="text-gray-300 mb-4">Maximum attempts: {quiz.max_attempts}</p>
          <button className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer" onClick={begin}>Start quiz</button>
        </div>
      )}

      {attemptId && !result && (
        <div className="space-y-5">
          {safeQuestionsList.length === 0 ? (
            <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg text-center text-white">
              <p className="mb-2 font-bold">No questions found for this quiz.</p>
              <p className="text-sm text-gray-400">Please make sure questions are added under this quiz in the admin dashboard.</p>
            </div>
          ) : (
            safeQuestionsList.map((q, i) => {
              const safeAnswers = Array.isArray(q.answers) ? q.answers : []
              const multi = q.type === 'multiple_answer'
              const isText = q.type === 'text' || q.type === 'essay'

              return (
                <div key={q.id || i} className="card p-5 bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
                  <p className="font-medium text-gray-100 mb-3">{i + 1}. {q.text}</p>
                  
                  {isText ? (
                    <textarea
                      className="w-full border border-gray-700 bg-gray-800 rounded p-2 text-sm text-white focus:outline-none focus:border-teal-400"
                      rows="3"
                      placeholder="Type your answer here..."
                      value={answers[q.id] || ''}
                      onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                    />
                  ) : (
                    <div className="space-y-2">
                      {safeAnswers.map((a) => {
                        const checked = (answers[q.id] || []).includes(a.id)
                        return (
                          <label key={a.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
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
                  )}
                </div>
              )
            })
          )}
          {safeQuestionsList.length > 0 && (
            <button className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting…' : 'Submit quiz'}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="card p-6 text-center bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
          <Badge tone={result.passed ? 'success' : 'danger'}>{result.passed ? 'Passed' : 'Not passed'}</Badge>
          <p className="text-3xl font-head font-bold mt-3">{result.percentage}%</p>
          <p className="text-gray-400 mt-1">{result.score_points} / {result.total_points} points</p>

          {result.passed && certificate && (
            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-gray-300 mb-3">Your certificate is ready.</p>
              <button
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold cursor-pointer"
                onClick={() => downloadCertificatePdf({
                  cert_number: certificate.cert_number,
                  employee_name: profile?.full_name,
                  course_name: course?.name,
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
            <p className="text-sm text-gray-400 mt-4">
              Review the course material and try again — you have {quiz.max_attempts} attempts in total.
            </p>
          )}
          <div className="mt-6">
            <Link to={`/courses/${courseId}`} className="text-sm text-teal-400 hover:underline font-bold">Back to course</Link>
          </div>
        </div>
      )}
    </div>
  )
}
