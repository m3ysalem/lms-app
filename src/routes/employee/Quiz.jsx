import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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

  const fetchQuizAndQuestions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (!courseId) {
        setError('رقم الكورس غير متوفر في الرابط')
        setLoading(false)
        return
      }

      // 1. جلب بيانات الكورس
      const { data: cData } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle()
      setCourse(cData)

      // 2. جلب الاختبار المرتبط بهذا الكورس تحديثاً من جدول quizzes
      const { data: qData, error: qErr } = await supabase.from('quizzes').select('*').eq('course_id', courseId).maybeSingle()
      
      if (qErr || !qData) {
        setLoading(false)
        return
      }
      setQuiz(qData)

      // 3. جلب الأسئلة المرتبطة بـ quiz_id الخاص بهذا الاختبار
      const { data: questionsData, error: qqErr } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', qData.id)

      if (qqErr) {
        console.error('Error fetching questions:', qqErr.message)
      }

      let loadedQuestions = []
      const rawQuestions = questionsData || []

      for (const q of rawQuestions) {
        // جلب الإجابات لكل سؤال من جدول quiz_answers
        const { data: answersData } = await supabase
          .from('quiz_answers')
          .select('*')
          .eq('question_id', q.id)

        loadedQuestions.push({
          id: q.id,
          text: q.question_text || q.text,
          type: q.question_type || 'multiple_choice',
          correct_answer_text: q.correct_answer_text,
          answers: answersData || []
        })
      }

      setQuestions(loadedQuestions)

    } catch (e) {
      setError(e?.message || 'حدث خطأ أثناء جلب بيانات الاختبار')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchQuizAndQuestions()
  }, [fetchQuizAndQuestions])

  const begin = () => {
    setAttemptId('attempt-' + Date.now())
  }

  const toggleAnswer = (qId, aId, isMultiple) => {
    setAnswers(prev => {
      const current = prev[qId] || []
      if (isMultiple) {
        if (current.includes(aId)) {
          return { ...prev, [qId]: current.filter(id => id !== aId) }
        } else {
          return { ...prev, [qId]: [...current, aId] }
        }
      } else {
        return { ...prev, [qId]: [aId] }
      }
    })
  }

  const handleTextAnswer = (qId, text) => {
    setAnswers(prev => ({ ...prev, [qId]: text }))
  }

  const handleSubmit = () => {
    const unansweredCount = questions.filter(q => {
      const ans = answers[q.id]
      if (!ans) return true
      if (Array.isArray(ans) && ans.length === 0) return true
      if (typeof ans === 'string' && !ans.trim()) return true
      return false
    }).length

    if (unansweredCount > 0) {
      setError(`يجب الإجابة على جميع الأسئلة قبل الإرسال! يتبقى ${unansweredCount} سؤال لم تقم بالإجابة عليه.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setError('')
    try {
      let correct = 0
      questions.forEach(q => {
        const userAns = answers[q.id]
        if (q.type === 'text' || q.type === 'essay') {
          // تصحيح مبدئي مقالي أو مطابقة النص
          if (userAns && q.correct_answer_text && userAns.trim().toLowerCase() === q.correct_answer_text.trim().toLowerCase()) {
            correct++
          }
        } else {
          const correctAnswersIds = (q.answers || []).filter(a => a.correct === true || a.correct === 1 || a.is_correct === true).map(a => a.id)
          const userSelected = Array.isArray(userAns) ? userAns : []

          if (correctAnswersIds.length > 0 && userSelected.length > 0) {
            const isMatch = correctAnswersIds.length === userSelected.length && correctAnswersIds.every(id => userSelected.includes(id))
            if (isMatch) correct++
          }
        }
      })

      const totalQ = questions.length > 0 ? questions.length : 1
      const percentage = Math.round((correct / totalQ) * 100)
      const passingScore = quiz?.passing_score ?? course?.passing_score ?? 50
      const passed = percentage >= passingScore

      setResult({ passed, percentage, score_points: correct, total_points: questions.length })

      if (passed) {
        setCertificate({
          cert_number: 'CERT-' + Math.floor(100000 + Math.random() * 900000),
          issued_date: new Date().toISOString().split('T')[0],
          trainer_name: 'مدرب الكورس المعمد'
        })
      }
    } catch (e) {
      setError('حدث خطأ أثناء تقييم الاختبار')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-8 text-center"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← Back to course</Link>
      
      <h1 className="text-2xl font-bold text-white">{quiz?.title || course?.name || 'اختبار الكورس'}</h1>

      {error && <div className="text-sm text-red-400 bg-red-950 border border-red-800 rounded px-3 py-3 font-semibold">{error}</div>}

      {!quiz ? (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg text-white text-center">
          <p className="text-red-400 font-bold">لم يتم إنشاء اختبار لهذا الكورس بعد من لوحة الأدمن.</p>
        </div>
      ) : !attemptId && !result ? (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
          <p className="text-gray-300 mb-1">عدد أسئلة الاختبار: <strong>{questions.length} أسئلة</strong></p>
          <p className="text-gray-300 mb-2">درجة النجاح المطلوبة: <strong>{quiz?.passing_score || course?.passing_score || 50}%</strong></p>
          <p className="text-yellow-400 text-sm mb-4">⚠️ تنبيه: لا يمكن تسليم الاختبار إلا بعد الإجابة على كافة الأسئلة.</p>
          {questions.length === 0 ? (
            <p className="text-red-400 font-bold">تم إنشاء الاختبار، ولكن لم يتم إضافة أي أسئلة له بعد في لوحة التحكم (Course Builder).</p>
          ) : (
            <button className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer" onClick={begin}>Start quiz</button>
          )}
        </div>
      ) : attemptId && !result ? (
        <div className="space-y-5">
          {questions.map((q, i) => {
            const isMultiple = q.type === 'multiple_answer'
            const isTextType = q.type === 'text' || q.type === 'essay'
            const currentAns = answers[q.id]
            const isAnswered = isTextType ? (currentAns && currentAns.trim().length > 0) : (currentAns && currentAns.length > 0)

            return (
              <div key={q.id || i} className={`card p-5 bg-gray-900 border ${isAnswered ? 'border-teal-800' : 'border-gray-800'} shadow rounded-lg text-white transition-all`}>
                <div className="flex justify-between items-center mb-3">
                  <p className="font-semibold text-gray-100">{i + 1}. {q.text}</p>
                  {isAnswered && <span className="text-xs bg-teal-900 text-teal-300 px-2 py-0.5 rounded">تمت الإجابة</span>}
                </div>

                {isTextType ? (
                  <textarea 
                    className="w-full bg-gray-950 border border-gray-800 rounded p-3 text-sm text-white focus:border-teal-500 outline-none"
                    rows={3}
                    placeholder="اكتب إجابتك هنا..."
                    value={currentAns || ''}
                    onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                  />
                ) : (
                  <div className="space-y-2">
                    {(q.answers || []).map((a, aIdx) => {
                      const aId = a.id ?? aIdx
                      const aText = a.text || a.answer_text || 'إجابة'
                      const selectedList = Array.isArray(currentAns) ? currentAns : []
                      const checked = selectedList.includes(aId)

                      return (
                        <label key={aId} className={`flex items-center gap-3 text-sm p-2 rounded cursor-pointer border ${checked ? 'border-teal-600 bg-teal-950/40 text-teal-200' : 'border-gray-800 bg-gray-900/50 text-gray-300 hover:bg-gray-800'}`}>
                          <input 
                            type={isMultiple ? 'checkbox' : 'radio'} 
                            name={`question_${q.id}`} 
                            checked={checked} 
                            onChange={() => toggleAnswer(q.id, aId, isMultiple)} 
                            className="accent-teal-500" 
                          />
                          <span>{aText}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          
          {questions.length > 0 && (
            <div className="pt-2">
              <button 
                className="w-full py-3 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold cursor-pointer transition-all shadow-lg" 
                disabled={submitting} 
                onClick={handleSubmit}
              >
                {submitting ? 'جاري تقييم الإجابات…' : 'Submit quiz (تسليم الاختبار)'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card p-6 text-center bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
            <Badge tone={result?.passed ? 'success' : 'danger'}>{result?.passed ? 'Passed (اجتياز ناجح)' : 'Not passed (لم تحقق النتيجة المطلوبة)'}</Badge>
            <p className="text-4xl font-head font-bold mt-3 text-teal-400">{result?.percentage}%</p>
            <p className="text-gray-400 mt-1">الدرجة النهائية: {result?.score_points} من أصل {result?.total_points} أسئلة صحيحة</p>
          </div>

          {result?.passed && certificate && (
            <div className="card bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-teal-700/60 p-8 rounded-xl shadow-2xl text-white space-y-6 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500"></div>
              
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-widest text-teal-400 font-semibold">شهادة إتمام واجتياز معتمدة</span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white">شهادة تقدير وإنجاز</h2>
                <p className="text-xs text-gray-400">تمنح هذه الشهادة تقديراً للجهد المتميز والاجتياز الناجح</p>
              </div>

              <div className="py-4 border-y border-gray-800/80 my-4 space-y-2">
                <p className="text-sm text-gray-400">تشهد إدارة المنصة بأن المتدرب:</p>
                <p className="text-2xl font-bold text-teal-300 underline decoration-teal-500/50 underline-offset-8">{profile?.full_name || 'اسم المتدرب'}</p>
                <p className="text-sm text-gray-300 pt-2">قد أتم بنجاح اختبار كورس:</p>
                <p className="text-lg font-semibold text-white">{course?.name || quiz?.title || 'Course'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-gray-400 bg-gray-900/80 p-4 rounded-lg border border-gray-800">
                <div>
                  <span className="block text-gray-500">رقم الشهادة:</span>
                  <span className="font-mono text-teal-400 font-bold">{certificate?.cert_number}</span>
                </div>
                <div>
                  <span className="block text-gray-500">تاريخ الإصدار:</span>
                  <span className="font-mono text-white font-bold">{certificate?.issued_date}</span>
                </div>
                <div>
                  <span className="block text-gray-500">النتيجة النهائية:</span>
                  <span className="font-mono text-emerald-400 font-bold">{result?.percentage}%</span>
                </div>
                <div>
                  <span className="block text-gray-500">حالة الاعتماد:</span>
                  <span className="text-teal-400 font-bold">معتمدة ✓</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  className="w-full sm:w-auto px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer transition-all shadow-lg flex items-center justify-center gap-2 mx-auto"
                  onClick={() => downloadCertificatePdf({
                    cert_number: certificate?.cert_number,
                    employee_name: profile?.full_name || 'User',
                    course_name: course?.name || quiz?.title || 'Course',
                    issued_date: certificate?.issued_date,
                    trainer_name: certificate?.trainer_name || 'Trainer',
                    final_score: `${result?.percentage}%`,
                  })}
                >
                  📥 تحميل الشهادة الرسمية (PDF)
                </button>
              </div>
            </div>
          )}

          <div className="text-center pt-2">
            <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← العودة إلى صفحة الكورس</Link>
          </div>
        </div>
      )}
    </div>
  )
}
