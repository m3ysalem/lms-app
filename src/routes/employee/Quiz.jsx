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

  const fetchAdminQuizData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (courseId) {
        const { data: cData } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle()
        setCourse(cData)
      }

      const { data: quizzesList } = await supabase.from('quizzes').select('*')
      let activeQuiz = quizzesList && quizzesList.length > 0 ? quizzesList[0] : { id: 'default', title: 'اختبار كورس HSE الشامل', passing_score: 50 }
      setQuiz(activeQuiz)

      const { data: qqData } = await supabase.from('quiz_questions').select('*')
      let loadedQuestions = []

      if (qqData && qqData.length > 0) {
        for (const q of qqData) {
          const { data: qaData } = await supabase
            .from('quiz_answers')
            .select('*')
            .eq('question_id', q.id)

          loadedQuestions.push({
            id: q.id,
            text: q.question_text || q.text || q.title || q.question || 'سؤال',
            answers: qaData && qaData.length > 0 ? qaData : [
              { id: '1', answer_text: 'الخيار الأول', is_correct: true },
              { id: '2', answer_text: 'الخيار الثاني', is_correct: false },
              { id: '3', answer_text: 'الخيار الثالث', is_correct: false },
              { id: '4', answer_text: 'الخيار الرابع', is_correct: false }
            ]
          })
        }
      }

      // 8 أسئلة بـ 4 اختيارات كاملة لكل سؤال
      if (loadedQuestions.length === 0) {
        loadedQuestions = [
          {
            id: 'q1',
            text: 'ما هي المسؤولية الأساسية لمسؤول السلامة والصحة المهنية (HSE)؟',
            answers: [
              { id: 'a1', answer_text: 'توفير بيئة عمل آمنة ومنع الحوادث وإصابات العمل', is_correct: true },
              { id: 'a2', answer_text: 'زيادة أرباح الشركة المالية فقط', is_correct: false },
              { id: 'a3', answer_text: 'تخفيض عدد ساعات العمل اليومية', is_correct: false },
              { id: 'a4', answer_text: 'الاهتمام بالشؤون التسويقية فقط', is_correct: false }
            ]
          },
          {
            id: 'q2',
            text: 'ماذا تعني علامة التحذير ذات اللون الأصفر في إرشادات السلامة؟',
            answers: [
              { id: 'b1', answer_text: 'تنبيه لوجود خطر محتمل يتطلب الحذر', is_correct: true },
              { id: 'b2', answer_text: 'منطقة استراحة مخصصة للعاملين', is_correct: false },
              { id: 'b3', answer_text: 'انتهاء الدوام الرسمي للموظفين', is_correct: false },
              { id: 'b4', answer_text: 'مكان مخصص لتناول الطعام', is_correct: false }
            ]
          },
          {
            id: 'q3',
            text: 'أي من الآتي يعتبر من معدات الوقاية الشخصية الأساسية (PPE)؟',
            answers: [
              { id: 'c1', answer_text: 'خوذة الرأس، نظارات الحماية، وأحذية السلامة', is_correct: true },
              { id: 'c2', answer_text: 'الملابس الكاجوال اليومية العادية', is_correct: false },
              { id: 'c3', answer_text: 'ساعات اليد الرقمية والإكسسوارات', is_correct: false },
              { id: 'c4', answer_text: 'الهواتف الذكية وس السماعات', is_correct: false }
            ]
          },
          {
            id: 'q4',
            text: 'ما هو الإجراء الفوري الواجب اتخاذه عند حدوث حريق صغير في مكان العمل؟',
            answers: [
              { id: 'd1', answer_text: 'استخدام طفاية الحريق المناسبة وإطلاق إنذار الطوارئ', is_correct: true },
              { id: 'd2', answer_text: 'تجاهل الحريق والانتظار حتى ينطفئ لوحده', is_correct: false },
              { id: 'd3', answer_text: 'تصوير الحريق ونشره على منصات التواصل', is_correct: false },
              { id: 'd4', answer_text: 'إغلاق النوافذ والذهاب للنوم', is_correct: false }
            ]
          },
          {
            id: 'q5',
            text: 'ما هي الطريقة الصحيحة لرفع الأجسام الثقيلة لتجنب إصابات الظهر؟',
            answers: [
              { id: 'e1', answer_text: 'ثني الركبتين والحفاظ على الظهر مستقيماً أثناء الرفع', is_correct: true },
              { id: 'e2', answer_text: 'ثني الظهر بسرعة ورفع الجسم باستخدام عضلات الظهر', is_correct: false },
              { id: 'e3', answer_text: 'محاولة رفع الجسم بيد واحدة وبشكل مفاجئ', is_correct: false },
              { id: 'e4', answer_text: 'حمل الوزن لأعلى دون أي تحضير مسبق', is_correct: false }
            ]
          },
          {
            id: 'q6',
            text: 'ما هو الهدف الأساسي من وجود مخارج الطوارئ في المنشآت؟',
            answers: [
              { id: 'f1', answer_text: 'ضمان إخلاء سريع وآمن للعاملين في حالات الخطر', is_correct: true },
              { id: 'f2', answer_text: 'استخدامها كمدخل رئيسي للموظفين صباحاً', is_correct: false },
              { id: 'f3', answer_text: 'تهوية المبنى وتخفيض درجات الحرارة', is_correct: false },
              { id: 'f4', answer_text: 'تخزين المعدات والأدوات الزائدة', is_correct: false }
            ]
          },
          {
            id: 'q7',
            text: 'متى يجب إجراء صيانة وفحص دوري لمعدات الحماية والأدوات؟',
            answers: [
              { id: 'g1', answer_text: 'بشكل دوري ومستمر وقبل كل استخدام', is_correct: true },
              { id: 'g2', answer_text: 'مرة واحدة كل عشر سنوات', is_correct: false },
              { id: 'g3', answer_text: 'فقط بعد وقوع حادث إصابة فعلي', is_correct: false },
              { id: 'g4', answer_text: 'لا داعي لفحصها أبداً', is_correct: false }
            ]
          },
          {
            id: 'q8',
            text: 'من هو المسؤول الأول عن الالتزام بقواعد السلامة والصحة المهنية؟',
            answers: [
              { id: 'h1', answer_text: 'جميع العاملين والإدارة بدون استثناء', is_correct: true },
              { id: 'h2', answer_text: 'عامل النظافة والخدمات فقط', is_correct: false },
              { id: 'h3', answer_text: 'الزوار الجدد المؤقتين للموقع', is_correct: false },
              { id: 'h4', answer_text: 'حراس الأمن على البوابات', is_correct: false }
            ]
          }
        ]
      }

      setQuestions(loadedQuestions)

    } catch (e) {
      setError(e?.message || 'حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchAdminQuizData()
  }, [fetchAdminQuizData])

  const begin = () => {
    setAttemptId('attempt-' + Date.now())
  }

  const toggleAnswer = (qId, aId) => {
    setAnswers(prev => ({ ...prev, [qId]: [aId] }))
  }

  const handleSubmit = () => {
    // التحقق من الإجابة على كل الأسئلة أولاً
    const unansweredCount = questions.filter(q => !answers[q.id] || answers[q.id].length === 0).length
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
        const userSelected = answers[q.id] || []
        const correctAnswers = (q.answers || []).filter(a => a.is_correct === true || a.is_correct === 1).map(a => a.id)
        
        if (correctAnswers.length > 0 && userSelected.length > 0 && userSelected.every(id => correctAnswers.includes(id))) {
          correct++
        } else if (userSelected.length > 0 && correctAnswers.length === 0) {
          correct++
        }
      })

      const percentage = Math.round((correct / (questions.length || 8)) * 100)
      const passed = percentage >= (quiz?.passing_score || 50)

      setResult({ passed, percentage, score_points: correct, total_points: questions.length })

      if (passed) {
        setCertificate({
          cert_number: 'CERT-' + Math.floor(100000 + Math.random() * 900000),
          issued_date: new Date().toISOString().split('T')[0],
          trainer_name: 'مدرب الحضانة/المنشأة'
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
      
      <h1 className="text-2xl font-bold text-white">{quiz?.title || 'اختبار كورس HSE الشامل'}</h1>

      {error && <div className="text-sm text-red-400 bg-red-950 border border-red-800 rounded px-3 py-3 font-semibold">{error}</div>}

      {!attemptId && !result && (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
          <p className="text-gray-300 mb-1">عدد أسئلة الاختبار: <strong>{questions.length} أسئلة (لكل سؤال 4 اختيارات)</strong></p>
          <p className="text-gray-300 mb-2">درجة النجاح المطلوبة: <strong>{quiz?.passing_score || 50}%</strong></p>
          <p className="text-yellow-400 text-sm mb-4">⚠️ تنبيه: لا يمكنك تسليم الاختبار إلا بعد الإجابة على جميع الأسئلة بالكامل.</p>
          <button className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer" onClick={begin}>Start quiz</button>
        </div>
      )}

      {attemptId && !result && (
        <div className="space-y-5">
          {questions.map((q, i) => {
            const isAnswered = answers[q.id] && answers[q.id].length > 0
            return (
              <div key={q.id || i} className={`card p-5 bg-gray-900 border ${isAnswered ? 'border-teal-800' : 'border-gray-800'} shadow rounded-lg text-white transition-all`}>
                <div className="flex justify-between items-center mb-3">
                  <p className="font-semibold text-gray-100">{i + 1}. {q.text}</p>
                  {isAnswered && <span className="text-xs bg-teal-900 text-teal-300 px-2 py-0.5 rounded">تمت الإجابة</span>}
                </div>
                <div className="space-y-2">
                  {(q.answers || []).map((a, aIdx) => {
                    const aId = a.id ?? aIdx
                    const aText = a.answer_text || a.text || 'إجابة'
                    const checked = (answers[q.id] || []).includes(aId)
                    return (
                      <label key={aId} className={`flex items-center gap-3 text-sm p-2 rounded cursor-pointer border ${checked ? 'border-teal-600 bg-teal-950/40 text-teal-200' : 'border-gray-800 bg-gray-900/50 text-gray-300 hover:bg-gray-800'}`}>
                        <input type="radio" name={q.id} checked={checked} onChange={() => toggleAnswer(q.id, aId)} className="accent-teal-500" />
                        <span>{aText}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
          
          <div className="pt-2">
            <button 
              className="w-full py-3 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold cursor-pointer transition-all shadow-lg" 
              disabled={submitting} 
              onClick={handleSubmit}
            >
              {submitting ? 'جاري تقييم الإجابات…' : 'Submit quiz (تسليم الاختبار)'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="card p-6 text-center bg-gray-900 border border-gray-800 shadow rounded-lg text-white">
            <Badge tone={result?.passed ? 'success' : 'danger'}>{result?.passed ? 'Passed (اجتياز ناجح)' : 'Not passed (لم تحقق النتيجة المطلوبة)'}</Badge>
            <p className="text-4xl font-head font-bold mt-3 text-teal-400">{result?.percentage}%</p>
            <p className="text-gray-400 mt-1">الدرجة النهائية: {result?.score_points} من أصل {result?.total_points} أسئلة صحيحة</p>
          </div>

          {/* فورم شهادة النجاح المنسقة والاحترافية */}
          {result?.passed && certificate && (
            <div className="card bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-teal-700/60 p-8 rounded-xl shadow-2xl text-white space-y-6 text-center relative overflow-hidden">
              {/* إطار جمالي للشهادة */}
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
                <p className="text-lg font-semibold text-white">{course?.name || quiz?.title || 'HSE Course'}</p>
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
                    course_name: course?.name || quiz?.title || 'HSE Course',
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
