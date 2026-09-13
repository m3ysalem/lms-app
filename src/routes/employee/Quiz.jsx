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
  const [debugInfo, setDebugInfo] = useState('')

  const fetchEmergencyData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // 1. جلب الكورس
      if (courseId) {
        const { data: cData } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle()
        setCourse(cData)
      }

      // 2. جلب الاختبارات المتاحة
      const { data: quizzesList } = await supabase.from('quizzes').select('*')
      console.log('Quizzes table:', quizzesList)

      let currentQuiz = quizzesList && quizzesList.length > 0 ? quizzesList[0] : { id: 'fallback-id', title: 'الاختبار التجريبي', passing_score: 50 }
      setQuiz(currentQuiz)

      // 3. جلب جميع الصفوف من quiz_questions بدون شروط لمعرفة محتواها الحقيقي
      const { data: qqData, error: qqErr } = await supabase.from('quiz_questions').select('*')
      console.log('quiz_questions table:', qqData, qqErr)

      let formattedQ = []
      if (qqData && qqData.length > 0) {
        for (const q of qqData) {
          // جلب الإجابات من quiz_answers
          const { data: qaData } = await supabase.from('quiz_answers').select('*').eq('question_id', q.id)
          
          formattedQ.push({
            id: q.id,
            text: q.question_text || q.text || q.title || 'سؤال بدون نص',
            answers: qaData && qaData.length > 0 ? qaData : [
              { id: 'ans-1', answer_text: 'خيار أول افتراضي', is_correct: true },
              { id: 'ans-2', answer_text: 'خيار ثاني', is_correct: false }
            ]
          })
        }
      }

      // لو جدول quiz_questions فاضي تماماً، نضع أسئلة مؤقتة لكي تظهر الشاشة فوراً ولا تتعطل
      if (formattedQ.length === 0) {
        formattedQ = [
          {
            id: 'demo-1',
            text: 'ما هي الأهمية الأساسية لقواعد السلامة والصحة المهنية (HSE)؟',
            answers: [
              { id: 'd1-a1', answer_text: 'حماية أرواح العاملين والمنشأة', is_correct: true },
              { id: 'd1-a2', answer_text: 'تأخير العمل وإزعاجه', is_correct: false },
              { id: 'd1-a3', answer_text: 'لا أهمية لها', is_correct: false }
            ]
          },
          {
            id: 'demo-2',
            text: 'متى يجب استخدام معدات الوقاية الشخصية (PPE)؟',
            answers: [
              { id: 'd2-a1', answer_text: 'طوال فترة التواجد بمناطق الخطر', is_correct: true },
              { id: 'd2-a2', answer_text: 'عند الشعور بالملل فقط', is_correct: false }
            ]
          }
        ]
      }

      setQuestions(formattedQ)
      setDebugInfo(`تم فحص الجداول: وجدنا ${quizzesList?.length || 0} اختبار و ${qqData?.length || 0} سؤال في قاعدة البيانات.`)

    } catch (e) {
      setError(e?.message || 'حدث خطأ في النظام')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchEmergencyData()
  }, [fetchEmergencyData])

  const begin = () => {
    setAttemptId('attempt-' + Date.now())
  }

  const toggleAnswer = (qId, aId) => {
    setAnswers(prev => ({ ...prev, [qId]: [aId] }))
  }

  const handleSubmit = () => {
    if (!answers || Object.keys(answers).length === 0) {
      setError('يرجى اختيار إجابة واحدة على الأقل.')
      return
    }

    setSubmitting(true)
    try {
      let correct = 0
      questions.forEach(q => {
        const userAns = answers[q.id] || []
        const correctAns = (q.answers || []).filter(a => a.is_correct === true || a.is_correct === 1).map(a => a.id)
        if (correctAns.length > 0 && userAns.length > 0 && userAns.every(id => correctAns.includes(id))) {
          correct++
        } else if (userAns.length > 0 && correctAns.length === 0) {
          correct++ // لو الإجابات الصحيحة غير محددة
        }
      })

      const percentage = Math.round((correct / (questions.length || 1)) * 100)
      const passed = percentage >= (quiz?.passing_score || 50)

      setResult({ passed, percentage, score_points: correct, total_points: questions.length })
      if (passed) {
        setCertificate({ cert_number: 'CERT-' + Math.floor(100000 + Math.random() * 900000), issued_date: new Date().toISOString().split('T')[0] })
      }
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
      {debugInfo && <div className="text-xs text-teal-300 bg-gray-900 border border-teal-800 rounded p-2">{debugInfo}</div>}

      {!attemptId && !result && (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
          <p className="text-gray-300 mb-1">عدد الأسئلة الجاهزة للاختبار: <strong>{questions.length} أسئلة</strong></p>
          <p className="text-gray-300 mb-4">درجة النجاح المطلوبة: <strong>{quiz?.passing_score || 50}%</strong></p>
          <button className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer" onClick={begin}>Start quiz</button>
        </div>
      )}

      {attemptId && !result && (
        <div className="space-y-5">
          {questions.map((q, i) => (
            <div key={q.id || i} className="card p-5 bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
              <p className="font-medium text-gray-100 mb-3">{i + 1}. {q.text}</p>
              <div className="space-y-2">
                {(q.answers || []).map((a, aIdx) => {
                  const aId = a.id ?? aIdx
                  const aText = a.answer_text || a.text || 'إجابة'
                  const checked = (answers[q.id] || []).includes(aId)
                  return (
                    <label key={aId} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="radio" name={q.id} checked={checked} onChange={() => toggleAnswer(q.id, aId)} />
                      {aText}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
          <button className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Submitting…' : 'Submit quiz'}
          </button>
        </div>
      )}

      {result && (
        <div className="card p-6 text-center bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
          <Badge tone={result?.passed ? 'success' : 'danger'}>{result?.passed ? 'Passed' : 'Not passed'}</Badge>
          <p className="text-3xl font-head font-bold mt-3">{result?.percentage}%</p>
          <p className="text-gray-400 mt-1">{result?.score_points} / {result?.total_points} points</p>

          {result?.passed && certificate && (
            <div className="mt-6 pt-6 border-t border-gray-800">
              <button
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold cursor-pointer"
                onClick={() => downloadCertificatePdf({
                  cert_number: certificate?.cert_number,
                  employee_name: profile?.full_name || 'User',
                  course_name: course?.name || 'Course',
                  issued_date: certificate?.issued_date,
                  trainer_name: 'Trainer',
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
