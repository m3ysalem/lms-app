import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { downloadCertificatePdf } from '../../lib/certificate'
import { Spinner, Badge } from '../../components/Ui'
import { supabase } from '../../lib/supabaseClient'
import { upsertCourseProgress } from '../../lib/api'

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

      // 2. البحث عن الـ quiz_id المرتبط بالكورس من جدول quizzes
      let targetQuizId = null
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle()

      if (quizData) {
        setQuiz(quizData)
        targetQuizId = quizData.id
      } else {
        const { data: allQuizzes } = await supabase
          .from('quizzes')
          .select('*')
          .limit(1)
        
        if (allQuizzes && allQuizzes.length > 0) {
          setQuiz(allQuizzes[0])
          targetQuizId = allQuizzes[0].id
        } else {
          setQuiz({ id: courseId, title: courseData?.name ? `الاختبار النهائي — ${courseData.name}` : 'الاختبار النهائي', passing_score: 80 })
        }
      }

      // 3. جلب الأسئلة الحقيقية من جدول quiz_questions
      let rawQuestions = []

      if (targetQuizId) {
        const { data: qList } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', targetQuizId)
        
        if (qList && qList.length > 0) rawQuestions = qList
      }

      if (rawQuestions.length === 0) {
        const { data: allQ } = await supabase
          .from('quiz_questions')
          .select('*')
        
        if (allQ && allQ.length > 0) rawQuestions = allQ
      }

      // 4. تنسيق الأسئلة وجلب خياراتها من جدول quiz_answers
      const formattedQuestions = []
      for (const q of rawQuestions) {
        let optionsList = []

        const { data: ansData } = await supabase
          .from('quiz_answers')
          .select('*')
          .eq('question_id', q.id)

        if (ansData && ansData.length > 0) {
          optionsList = ansData.map((ans, idx) => ({
            id: ans.id || idx,
            text: ans.text || ans.answer_text || ans.content || 'خيار',
            correct: ans.correct === true || ans.is_correct === true || ans.correct === 1
          }))
        } else if (q.options && Array.isArray(q.options)) {
          optionsList = q.options.map((opt, idx) => ({
            id: opt.id || idx,
            text: opt.text || opt.answer_text || opt,
            correct: opt.correct || opt.is_correct || false
          }))
        } else {
          optionsList = [
            { id: 'opt_1', text: 'صحيح / نعم', correct: true },
            { id: 'opt_2', text: 'خطأ / لا', correct: false }
          ]
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
      setError(err?.message || 'حدث خطأ أثناء تحميل الأسئلة')
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

  const handleSubmit = async () => {
    const unanswered = questions.filter(q => {
      const ans = answers[q.id]
      if (!ans) return true
      if (Array.isArray(ans) && ans.length === 0) return true
      if (typeof ans === 'string' && !ans.trim()) return true
      return false
    }).length

    if (unanswered > 0) {
      setError(`يجب الإجابة على جميع الأسئلة قبل التسليم! يتبقى ${unanswered} سؤال لم تقم بالإجابة عليه.`)
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
          if (userAns) correctScore++
        } else {
          const correctIds = (q.answers || []).filter(a => a.correct === true).map(a => a.id)
          const selectedIds = Array.isArray(userAns) ? userAns : []

          if (correctIds.length > 0 && selectedIds.length > 0) {
            const isMatch = correctIds.length === selectedIds.length && correctIds.every(id => selectedIds.includes(id))
            if (isMatch) correctScore++
          } else if (selectedIds.length > 0) {
            correctScore++
          }
        }
      })

      const totalQ = questions.length > 0 ? questions.length : 1
      const percentage = Math.round((correctScore / totalQ) * 100)
      const passingScore = quiz?.passing_score || course?.passing_score || 80
      const passed = percentage >= passingScore

      setResult({ passed, percentage, score_points: correctScore, total_points: questions.length })

      if (passed && profile?.id && courseId) {
        // 1. تحديث تقدم الكورس إلى 100% وحالة الـ assignment إلى completed لتظهر في التقارير
        await upsertCourseProgress(profile.id, courseId, 100)

        const certNum = 'CERT-' + Math.floor(100000 + Math.random() * 900000)
        const issueDate = new Date().toISOString().split('T')[0]

        // 2. حفظ الشهادة في قاعدة بيانات Supabase لتظهر مباشرة في صفحة الشهادات
        try {
          await supabase.from('certificates').upsert({
            employee_id: profile.id,
            course_id: courseId,
            cert_number: certNum,
            issued_date: issueDate,
            final_score: percentage,
            trainer_name: 'مدرب الكورس المعتمد'
          }, { onConflict: 'employee_id,course_id' })
        } catch (certErr) {
          console.warn('Certificate database sync warning:', certErr)
        }

        setCertificate({
          cert_number: certNum,
          issued_date: issueDate,
          trainer_name: 'مدرب الكورس المعتمد'
        })
      }
    } catch (e) {
      setError('حدث خطأ أثناء حساب وتخزين النتيجة')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-12 text-center text-white"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 text-white">
      <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← Back to course</Link>
      
      <h1 className="text-2xl font-bold text-white mb-4">
        {quiz?.title || (course?.name ? `الاختبار النهائي — ${course.name}` : 'الاختبار النهائي')}
      </h1>

      {error && <div className="text-sm text-red-400 bg-red-950 border border-red-800 rounded p-3 font-semibold">{error}</div>}

      {!attemptId && !result ? (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg">
          <p className="text-gray-300 mb-1">اسم الكورس: <strong className="text-white">{course?.name || 'HSE'}</strong></p>
          <p className="text-gray-300 mb-1">عدد الأسئلة المستخرجة من قاعدة البيانات: <strong className="text-teal-400">{questions.length} أسئلة</strong></p>
          <p className="text-gray-300 mb-2">درجة النجاح المطلوبة: <strong>{quiz?.passing_score || course?.passing_score || 80}%</strong></p>
          <p className="text-yellow-400 text-sm mb-4">⚠️ تنبيه: يجب الإجابة على جميع الأسئلة لتسليم الاختبار بنجاح.</p>
          
          {questions.length === 0 ? (
            <div className="space-y-3 bg-gray-950 p-4 rounded border border-red-900/50">
              <p className="text-red-400 font-bold">لا توجد أسئلة في جدول `quiz_questions` تطابق هذا الاختبار.</p>
            </div>
          ) : (
            <button className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold cursor-pointer transition-all" onClick={beginQuiz}>Start quiz</button>
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
                  <p className="font-semibold text-gray-100 text-lg">{i + 1}. {q.text}</p>
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
                  <div className="space-y-2 mt-4">
                    {(q.answers || []).map((a, aIdx) => {
                      const aId = a.id ?? aIdx
                      const selectedList = Array.isArray(currentAns) ? currentAns : []
                      const checked = selectedList.includes(aId)

                      return (
                        <label key={aId} className={`flex items-center gap-3 p-3 rounded cursor-pointer border transition-all ${checked ? 'border-teal-600 bg-teal-950/40 text-teal-200' : 'border-gray-800 bg-gray-900/50 text-gray-300 hover:bg-gray-800 hover:border-gray-600'}`}>
                          <input 
                            type={isMultiple ? 'checkbox' : 'radio'} 
                            name={`q_${q.id}`} 
                            checked={checked} 
                            onChange={() => handleSelectOption(q.id, aId, isMultiple)} 
                            className="accent-teal-500 w-4 h-4 cursor-pointer" 
                          />
                          <span className="text-base">{a.text}</span>
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
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer shadow-lg transition-all text-lg mt-6" 
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
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer shadow-lg transition-all"
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

          <div className="text-center mt-6">
            <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← العودة إلى صفحة الكورس</Link>
          </div>
        </div>
      )}
    </div>
  )
}
