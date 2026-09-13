import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { startQuizAttempt, submitQuizAttempt, issueCertificate } from '../../lib/api'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchCorrectSchema = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // 1. جلب الكورس إن وجد
      if (courseId) {
        const { data: cData } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle()
        setCourse(cData)
      }

      // 2. جلب الاختبار من جدول quizzes
      let quizData = null
      if (courseId) {
        const { data: qData } = await supabase.from('quizzes').select('*').eq('course_id', courseId).maybeSingle()
        if (qData) quizData = qData
      }

      if (!quizData) {
        const { data: allQ } = await supabase.from('quizzes').select('*').order('id', { ascending: false }).limit(1)
        if (allQ && allQ.length > 0) quizData = allQ[0]
      }

      if (!quizData) {
        quizData = { id: 'default-quiz', title: 'اختبار الكورس', passing_score: 50 }
      }
      setQuiz(quizData)

      // 3. جلب الأسئلة من جدول quiz_questions الصحيح مع إجاباتها من quiz_answers
      const { data: qList, error: qErr } = await supabase
        .from('quiz_questions')
        .select('*')

      if (qErr) {
        console.error('Error fetching quiz_questions:', qErr.message)
      }

      let formattedQuestions = []
      if (qList && qList.length > 0) {
        for (const q of qList) {
          // جلب الإجابات لكل سؤال من جدول quiz_answers
          const { data: ansData } = await supabase
            .from('quiz_answers')
            .select('*')
            .eq('question_id', q.id)

          formattedQuestions.push({
            ...q,
            text: q.question_text || q.text || q.title || 'سؤال',
            answers: ansData || []
          })
        }
      }

      setQuestions(formattedQuestions)

    } catch (e) {
      setError(e?.message || 'حدث خطأ أثناء جلب البيانات')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchCorrectSchema()
  }, [fetchCorrectSchema])

  const begin = () => {
    setAttemptId('attempt-' + Date.now())
  }

  const toggleAnswer = (questionId, answerId) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: [answerId] // اختيار إجابة واحدة لكل سؤال
    }))
  }

  const handleSubmit = () => {
    if (!answers || Object.keys(answers).length === 0) {
      setError('يرجى الإجابة على الأسئلة قبل إرسال الاختبار.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const safeQuestions = Array.isArray(questions) ? questions : []
      let correctCount = 0
      let totalQuestions = safeQuestions.length

      // تصحيح النتيجة بناءً على الحقول الصحيحة في جدول quiz_answers (is_correct)
      safeQuestions.forEach((q) => {
        const userSelected = answers[q.id] || []
        const safeAnswers = Array.isArray(q.answers) ? q.answers : []
        
        const correctAnswers = safeAnswers
          .filter(a => a.is_correct === true || a.is_correct === 1 || a.isCorrect === true)
          .map(a => a.id)

        if (correctAnswers.length > 0) {
          const isMatch = correctAnswers.length === userSelected.length && correctAnswers.every(id => userSelected.includes(id))
          if (isMatch) correctCount++
        } else {
          // لو لم تحدد الإجابة الصحيحة في قاعدة البيانات، نحتسبه صح طالما اختار إجابة
          if (userSelected.length > 0) correctCount++
        }
      })

      const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
      const passed = percentage >= (quiz?.passing_score || 50)

      const res = {
        passed: passed,
        percentage: percentage,
        score_points: correctCount,
        total_points: totalQuestions
      }

      setResult(res)

      if (res?.passed) {
        setCertificate({
          cert_number: 'CERT-' + Math.floor(100000 + Math.random() * 900000),
          issued_date: new Date().toISOString().split('T')[0],
          trainer_name: 'مدرب الكورس',
          final_score: `${res.percentage}%`
        })
      }
    } catch (e) {
      setError('حدث خطأ أثناء احتساب النتيجة')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-8 text-center"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← Back to course</Link>
      
      <h1 className="text-2xl font-bold text-white">{quiz?.title || course?.name || 'اختبار الكورس'}</h1>

      {error && <div className="text-sm text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{error}</div>}

      {!attemptId && !result && (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
          <p className="text-gray-300 mb-1">عدد الأسئلة: <strong>{questions.length} أسئلة</strong></p>
          <p className="text-gray-300 mb-4">نسبة النجاح: <strong>{quiz?.passing_score || 50}%</strong></p>
          <button className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer" onClick={begin}>Start quiz</button>
        </div>
      )}

      {attemptId && !result && (
        <div className="space-y-5">
          {questions.length === 0 ? (
            <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg text-center text-white">
              <p className="font-bold text-yellow-400">لا توجد أسئلة مضافة في جدول `quiz_questions`.</p>
            </div>
          ) : (
            questions.map((q, i) => {
              const safeAnswers = Array.isArray(q.answers) ? q.answers : []

              return (
                <div key={q.id || i} className="card p-5 bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
                  <p className="font-medium text-gray-100 mb-3">{i + 1}. {q.text}</p>
                  <div className="space-y-2">
                    {safeAnswers.map((a, aIdx) => {
                      const aId = a.id ?? aIdx
                      const aText = a.answer_text || a.text || 'إجابة'
                      const checked = (answers[q.id] || []).includes(aId)
                      return (
                        <label key={aId} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input
                            type="radio"
                            name={q.id}
                            checked={checked}
                            onChange={() => toggleAnswer(q.id, aId)}
                          />
                          {aText}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
          {questions.length > 0 && (
            <button className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting…' : 'Submit quiz'}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="card p-6 text-center bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
          <Badge tone={result?.passed ? 'success' : 'danger'}>{result?.passed ? 'Passed' : 'Not passed'}</Badge>
          <p className="text-3xl font-head font-bold mt-3">{result?.percentage}%</p>
          <p className="text-gray-400 mt-1">{result?.score_points} / {result?.total_points} points</p>

          {result?.passed && certificate && (
            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-gray-300 mb-3">Your certificate is ready.</p>
              <button
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold cursor-pointer"
                onClick={() => downloadCertificatePdf({
                  cert_number: certificate?.cert_number || 'CERT-123456',
                  employee_name: profile?.full_name || 'User',
                  course_name: course?.name || 'Course',
                  issued_date: certificate?.issued_date || new Date().toISOString().split('T')[0],
                  trainer_name: certificate?.trainer_name || 'Trainer',
                  final_score: `${result?.percentage}%`,
                })}
              >
                Download certificate (PDF)
              </button>
            </div>
          )}
          <div className="mt-6">
            <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">Back to course</Link>
          </div>
        </div>
      )}
    </div>
  )
}
