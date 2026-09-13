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

  const fetchQuizData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (!courseId) {
        setError('معرف الكورس غير موجود في الرابط')
        setLoading(false)
        return
      }

      // 1. جلب تفاصيل الكورس
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle()
      
      setCourse(courseData)

      // 2. البحث عن الاختبار الخاص بالكورس
      let currentQuiz = null
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle()

      if (quizData) {
        currentQuiz = quizData
      } else {
        currentQuiz = {
          id: 'quiz-' + courseId,
          title: courseData?.name ? `الاختبار النهائي — ${courseData.name}` : 'الاختبار النهائي',
          passing_score: courseData?.passing_score || 80
        }
      }
      setQuiz(currentQuiz)

      // 3. البحث الشامل عن الأسئلة في قاعدة البيانات لضمان ظهورها لأي يوزر
      let rawQuestions = []

      // محاولة أ: البحث بربط الـ quiz_id
      if (quizData && quizData.id) {
        const { data: q1 } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', quizData.id)
        if (q1 && q1.length > 0) rawQuestions = q1
      }

      // محاولة ب: البحث المباشر بربط الـ course_id في جدول الأسئلة
      if (rawQuestions.length === 0) {
        const { data: q2 } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('course_id', courseId)
        if (q2 && q2.length > 0) rawQuestions = q2
      }

      // محاولة ج: جلب كافة الأسئلة في الجدول كاحتياطي أخير لو الـ IDs مش متطابقة تماماً
      if (rawQuestions.length === 0) {
        const { data: q3 } = await supabase
          .from('quiz_questions')
          .select('*')
        if (q3 && q3.length > 0) rawQuestions = q3
      }

      // 4. تنسيق الأسئلة وخياراتها الإجبارية
      const formattedQuestions = []
      for (const q of rawQuestions) {
        let optionsList = []
        
        // جلب الخيارات من جدول الإجابات المرفق
        const { data: ansData } = await supabase
          .from('quiz_answers')
          .select('*')
          .eq('question_id', q.id)

        if (ansData && ansData.length > 0) {
          optionsList = ansData.map((ans, idx) => ({
            id: ans.id || idx,
            text: ans.text || ans.answer_text || ans.content || 'خيار',
            correct: ans.correct || ans.is_correct || false
          }))
        } else if (q.options && Array.isArray(q.options)) {
          optionsList = q.options.map((opt, idx) => ({
            id: opt.id || idx,
            text: opt.text || opt.answer_text || opt,
            correct: opt.correct || opt.is_correct || false
          }))
        }

        formattedQuestions.push({
          id: q.id,
          text: q.question_text || q.text || q.title || 'سؤال',
          type: q.question_type || q.type || 'multiple_choice',
          correct_answer_text: q.correct_answer_text,
          answers: optionsList
        })
      }

      setQuestions(formattedQuestions)

    } catch (err) {
      setError(err?.message || 'حدث خطأ أثناء تحميل الاختبار')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchQuizData()
  }, [fetchQuizData])

  const beginQuiz = () => setAttemptId('active-' + Date.now())

  const handleSelectOption = (qId, aId, isMultiple) => {
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

  const handleTextChange = (qId, text) => {
    setAnswers(prev => ({ ...prev, [qId]: text }))
  }

  const handleSubmit = () => {
    const unanswered = questions.filter(q => {
      const ans = answers[q.id]
      if (!ans) return true
      if (Array.isArray(ans) && ans.length === 0) return true
      if (typeof ans === 'string' && !ans.trim()) return true
      return false
    }).length

    if (unanswered > 0) {
      setError(`يجب الإجابة على جميع الأسئلة قبل التسليم! يتبقى ${unanswered} سؤال.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setError('')
    try {
      let correctScore = 0
      questions.forEach(q => {
        const userAns = answers[q.id]
        if (q.type === 'text' || q.type === 'essay') {
          if (userAns && q.correct_answer_text && userAns.trim().toLowerCase() === q.correct_answer_text.trim().toLowerCase()) {
            correctScore++
          } else if (userAns && !q.correct_answer_text) {
            correctScore++
          }
        } else {
          const correctIds = (q.answers || []).filter(a => a.correct === true || a.correct === 1 || a.is_correct === true).map(a => a.id)
          const selectedIds = Array.isArray(userAns) ? userAns : []

          if (correctIds.length > 0 && selectedIds.length > 0) {
            const isMatch = correctIds.length === selectedIds.length && correctIds.every(id => selectedIds.includes(id))
            if (isMatch) correctScore++
          } else if (selectedIds.length > 0 && correctIds.length === 0) {
            correctScore++
          }
        }
      })

      const totalQ = questions.length > 0 ? questions.length : 1
      const percentage = Math.round((correctScore / totalQ) * 100)
      const passingScore = quiz?.passing_score ?? course?.passing_score ?? 80
      const passed = percentage >= passingScore

      setResult({ passed, percentage, score_points: correctScore, total_points: questions.length })

      if (passed) {
        setCertificate({
          cert_number: 'CERT-' + Math.floor(100000 + Math.random() * 900000),
          issued_date: new Date().toISOString().split('T')[0],
          trainer_name: 'مدرب الكورس المعتمد'
        })
      }
    } catch (e) {
      setError('حدث خطأ أثناء حساب النتيجة')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-12 text-center text-white"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 text-white">
      <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← Back to course</Link>
      
      <h1 className="text-2xl font-bold">{quiz?.title || (course?.name ? `الاختبار النهائي — ${course.name}` : 'الاختبار النهائي')}</h1>

      {error && <div className="text-sm text-red-400 bg-red-950 border border-red-800 rounded p-3 font-semibold">{error}</div>}

      {!attemptId && !result ? (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg">
          <p className="text-gray-300 mb-1">اسم الكورس: <strong className="text-white">{course?.name || 'HSE'}</strong></p>
          <p className="text-gray-300 mb-1">عدد أسئلة الاختبار المتاحة: <strong className="text-teal-400">{questions.length} أسئلة</strong></p>
          <p className="text-gray-300 mb-2">درجة النجاح المطلوبة: <strong>{quiz?.passing_score || course?.passing_score || 80}%</strong></p>
          <p className="text-yellow-400 text-sm mb-4">⚠️ تنبيه: يجب الإجابة على جميع الأسئلة لتسليم الاختبار بنجاح.</p>
          
          {questions.length === 0 ? (
            <div className="space-y-3 bg-gray-950 p-4 rounded border border-red-900/50">
              <p className="text-red-400 font-bold">لم يتم العثور على أسئلة مرتبطة بهذا الكورس في الداتا بيز.</p>
              <p className="text-xs text-gray-400">تأكد أن الآدمن أضاف الأسئلة في لوحة التحكم وحفظها بشكل صحيح تحت هذا الكورس.</p>
            </div>
          ) : (
            <button className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer transition-all" onClick={beginQuiz}>Start quiz</button>
          )}
        </div>
      ) : attemptId && !result ? (
        <div className="space-y-5">
          {questions.map((q, i) => {
            const isMultiple = q.type === 'multiple_answer'
            const isText = q.type === 'text' || q.type === 'essay'
            const currentAns = answers[q.id]
            const answered = isText ? (currentAns && currentAns.trim().length > 0) : (currentAns && currentAns.length > 0)

            return (
              <div key={q.id || i} className={`card p-5 bg-gray-900 border ${answered ? 'border-teal-800' : 'border-gray-800'} rounded-lg shadow`}>
                <div className="flex justify-between items-center mb-3">
                  <p className="font-semibold text-gray-100">{i + 1}. {q.text}</p>
                  {answered && <span className="text-xs bg-teal-900 text-teal-300 px-2 py-0.5 rounded">تمت الإجابة</span>}
                </div>

                {isText ? (
                  <textarea 
                    className="w-full bg-gray-950 border border-gray-800 rounded p-3 text-sm text-white focus:border-teal-500 outline-none"
                    rows={3}
                    placeholder="اكتب إجابتك هنا..."
                    value={currentAns || ''}
                    onChange={(e) => handleTextChange(q.id, e.target.value)}
                  />
                ) : (
                  <div className="space-y-2">
                    {(q.answers || []).map((a, aIdx) => {
                      const aId = a.id ?? aIdx
                      const selectedList = Array.isArray(currentAns) ? currentAns : []
                      const checked = selectedList.includes(aId)

                      return (
                        <label key={aId} className={`flex items-center gap-3 text-sm p-2.5 rounded cursor-pointer border ${checked ? 'border-teal-600 bg-teal-950/40 text-teal-200' : 'border-gray-800 bg-gray-900/50 text-gray-300 hover:bg-gray-800'}`}>
                          <input 
                            type={isMultiple ? 'checkbox' : 'radio'} 
                            name={`q_${q.id}`} 
                            checked={checked} 
                            onChange={() => handleSelectOption(q.id, aId, isMultiple)} 
                            className="accent-teal-500" 
                          />
                          <span>{a.text}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          
          {questions.length > 0 && (
            <button 
              className="w-full py-3.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold cursor-pointer shadow-lg transition-all" 
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
            <p className="text-gray-400 mt-1">الدرجة: {result?.score_points} من أصل {result?.total_points} أسئلة</p>
          </div>

          {result?.passed && certificate && (
            <div className="card bg-gray-900 border-2 border-teal-700 p-6 rounded-xl shadow-xl text-center space-y-4">
              <h2 className="text-2xl font-bold text-white">شهادة اجتياز الكورس</h2>
              <p className="text-sm text-gray-300">منحت للمتدرّب: <strong className="text-teal-300">{profile?.full_name || 'User'}</strong></p>
              <button
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer shadow"
                onClick={() => downloadCertificatePdf({
                  cert_number: certificate?.cert_number,
                  employee_name: profile?.full_name || 'User',
                  course_name: course?.name || 'Course',
                  issued_date: certificate?.issued_date,
                  trainer_name: certificate?.trainer_name,
                  final_score: `${result?.percentage}%`,
                })}
              >
                📥 تحميل الشهادة (PDF)
              </button>
            </div>
          )}

          <div className="text-center">
            <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← العودة إلى صفحة الكورس</Link>
          </div>
        </div>
      )}
    </div>
  )
}
