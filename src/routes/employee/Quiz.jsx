import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { downloadCertificatePdf } from '../../lib/certificate'
import { Spinner, Badge } from '../../components/Ui'
import { supabase } from '../../lib/supabaseClient'

export default function Quiz() {
  const { courseId } = useParams()
  const { profile } = useAuth()
  const [quizData, setQuizData] = useState(null)
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [certificate, setCertificate] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // الأسئلة بتيجي من السيرفر بدون الإجابات الصحيحة، والتصحيح بيتم على السيرفر
  const fetchQuizData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (!courseId) {
        setError('معرف الكورس غير موجود في الرابط')
        return
      }
      const { data, error: rpcError } = await supabase.rpc('get_course_quiz', { p_course_id: courseId })
      if (rpcError) throw new Error(rpcError.message)
      setQuizData(data)
    } catch (err) {
      setError(err?.message || 'حدث خطأ أثناء تحميل الأسئلة')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchQuizData()
  }, [fetchQuizData])

  const questions = quizData?.questions || []
  const passingScore = quizData?.passing_score ?? 70
  const courseName = quizData?.course_name || ''

  const beginQuiz = () => setStarted(true)

  const handleSelectOption = (qId, optionIndex) => {
    setAnswers((prev) => ({ ...prev, [qId]: optionIndex }))
  }

  const retryQuiz = () => {
    setAnswers({})
    setResult(null)
    setCertificate(null)
    setError('')
    setStarted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    const unanswered = questions.filter((q) => answers[q.id] === undefined).length

    if (unanswered > 0) {
      setError(`يجب الإجابة على جميع الأسئلة قبل التسليم! يتبقى ${unanswered} سؤال لم تقم بالإجابة عليه.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('submit_course_quiz', {
        p_course_id: courseId,
        p_answers: answers,
      })
      if (rpcError) throw new Error(rpcError.message)

      setResult({
        passed: data.passed,
        percentage: data.percentage,
        score_points: data.score_points,
        total_points: data.total_points,
      })
      setCertificate(data.certificate || null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e?.message || 'حدث خطأ أثناء حساب وتخزين النتيجة')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-12 text-center text-white"><Spinner /></div>

  const pageTitle = courseName ? `الاختبار النهائي — ${courseName}` : 'الاختبار النهائي'

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 text-white">
      <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← Back to course</Link>

      <h1 className="text-2xl font-bold text-white mb-4">{pageTitle}</h1>

      {error && <div className="text-sm text-red-400 bg-red-950 border border-red-800 rounded p-3 font-semibold">{error}</div>}

      {!started && !result ? (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg">
          <p className="text-gray-300 mb-1">اسم الكورس: <strong className="text-white">{courseName || '—'}</strong></p>
          <p className="text-gray-300 mb-1">عدد الأسئلة: <strong className="text-teal-400">{questions.length} أسئلة</strong></p>
          <p className="text-gray-300 mb-2">درجة النجاح المطلوبة: <strong>{passingScore}%</strong></p>
          <p className="text-yellow-400 text-sm mb-4">⚠️ تنبيه: يجب الإجابة على جميع الأسئلة لتسليم الاختبار بنجاح.</p>

          {questions.length === 0 ? (
            <div className="space-y-3 bg-gray-950 p-4 rounded border border-red-900/50">
              <p className="text-red-400 font-bold">لا توجد أسئلة لهذا الكورس حالياً.</p>
            </div>
          ) : (
            <button className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold cursor-pointer transition-all" onClick={beginQuiz}>Start quiz</button>
          )}
        </div>
      ) : started && !result ? (
        <div className="space-y-5">
          {questions.map((q, i) => {
            const currentAns = answers[q.id]
            const answered = currentAns !== undefined

            return (
              <div key={q.id || i} className={`card p-5 bg-gray-900 border ${answered ? 'border-teal-800' : 'border-gray-800'} rounded-lg shadow`}>
                <div className="flex justify-between items-center mb-3">
                  <p className="font-semibold text-gray-100 text-lg">{i + 1}. {q.text}</p>
                  {answered && <span className="text-xs bg-teal-900 text-teal-300 px-2 py-0.5 rounded">تمت الإجابة</span>}
                </div>

                <div className="space-y-2 mt-4">
                  {(q.options || []).map((optText, optIdx) => {
                    const checked = currentAns === optIdx

                    return (
                      <label key={optIdx} className={`flex items-center gap-3 p-3 rounded cursor-pointer border transition-all ${checked ? 'border-teal-600 bg-teal-950/40 text-teal-200' : 'border-gray-800 bg-gray-900/50 text-gray-300 hover:bg-gray-800 hover:border-gray-600'}`}>
                        <input
                          type="radio"
                          name={`q_${q.id}`}
                          checked={checked}
                          onChange={() => handleSelectOption(q.id, optIdx)}
                          className="accent-teal-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-base">{optText}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {questions.length > 0 && (
            <button
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer shadow-lg transition-all text-lg mt-6 disabled:opacity-60"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'جاري تقييم النتيجة...' : 'Submit quiz (تسليم الاختبار)'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card p-6 text-center bg-gray-900 border border-gray-800 rounded-lg shadow">
            <Badge tone={result?.passed ? 'success' : 'danger'}>{result?.passed ? 'Passed (اجتياز ناجح)' : 'Not passed (لم تتخطى درجة النجاح)'}</Badge>
            <p className="text-4xl font-bold mt-3 text-teal-400">{result?.percentage}%</p>
            <p className="text-gray-400 mt-1">الدرجة: {result?.score_points} من أصل {result?.total_points} نقطة</p>
            {!result?.passed && (
              <button
                className="mt-4 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold cursor-pointer transition-all"
                onClick={retryQuiz}
              >
                إعادة المحاولة
              </button>
            )}
          </div>

          {result?.passed && certificate && (
            <div className="card bg-gray-900 border-2 border-teal-700 p-6 rounded-xl shadow-xl text-center space-y-4">
              <h2 className="text-2xl font-bold text-white">شهادة اجتياز الكورس</h2>
              <p className="text-sm text-gray-300">منحت للمتدرّب: <strong className="text-teal-300">{profile?.full_name || 'User'}</strong></p>
              <button
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer shadow-lg transition-all"
                onClick={() => downloadCertificatePdf({
                  cert_number: certificate?.cert_number,
                  employee_name: profile?.full_name || 'User',
                  course_name: courseName || 'Course',
                  issued_date: certificate?.issued_date,
                  trainer_name: certificate?.trainer_name,
                  final_score: `${result?.percentage}%`,
                })}
              >
                📥 تحميل الشهادة (PDF)
              </button>
            </div>
          )}

          <div className="text-center mt-6">
            <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← العودة إلى صفحة الكورس</Link>
          </div>
        </div>
      )}
    </div>
  )
}
