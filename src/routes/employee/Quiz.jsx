import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { downloadCertificatePdf } from '../../lib/certificate'
import { Spinner, Badge } from '../../components/Ui'
import { supabase } from '../../lib/supabaseClient'
import { upsertCourseProgress } from '../../lib/api'

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const normalizeOptions = (raw) => {
  let opts = []
  try {
    if (typeof raw === 'string') opts = JSON.parse(raw)
    else if (Array.isArray(raw)) opts = raw
    else if (raw && typeof raw === 'object') opts = Object.values(raw)
  } catch {
    opts = []
  }
  return (Array.isArray(opts) ? opts : []).map((o) =>
    typeof o === 'string' ? o : o?.text || o?.answer_text || String(o ?? '')
  )
}

const ATTEMPT_COLUMNS = 'id, quiz_id, percentage, passed, submitted_at, attempt_number'

export default function Quiz() {
  const { courseId } = useParams()
  const { profile } = useAuth()

  const [course, setCourse] = useState(null)
  const [quizzes, setQuizzes] = useState([])
  const [questionsByQuiz, setQuestionsByQuiz] = useState({})
  const [attempts, setAttempts] = useState([])
  const [certificate, setCertificate] = useState(null)

  const [activeQuizId, setActiveQuizId] = useState(null)
  const [sheet, setSheet] = useState([])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      if (!courseId) {
        setError('معرف الكورس غير موجود في الرابط')
        return
      }

      const [courseRes, quizRes] = await Promise.all([
        supabase
          .from('courses')
          .select('id, name, passing_score, certificate_eligible, max_attempts')
          .eq('id', courseId)
          .maybeSingle(),
        supabase.from('quizzes').select('*').eq('course_id', courseId).order('created_at', { ascending: true }),
      ])
      if (quizRes.error) throw quizRes.error

      const quizList = quizRes.data || []
      setCourse(courseRes.data)
      setQuizzes(quizList)

      // الأسئلة تُقرأ من view آمنة لا تحتوي على الإجابات الصحيحة
      const quizIds = quizList.map((q) => q.id)
      const grouped = {}
      if (quizIds.length > 0) {
        const { data: qs, error: qErr } = await supabase
          .from('quiz_questions_safe')
          .select('*')
          .in('quiz_id', quizIds)
          .order('sort_order', { ascending: true })
        if (qErr) throw qErr
        ;(qs || []).forEach((q) => {
          if (!grouped[q.quiz_id]) grouped[q.quiz_id] = []
          grouped[q.quiz_id].push({
            id: q.id,
            text: q.question_text,
            options: normalizeOptions(q.options),
          })
        })
      }
      setQuestionsByQuiz(grouped)

      if (profile?.id) {
        const [attRes, certRes] = await Promise.all([
          quizIds.length > 0
            ? supabase
                .from('quiz_attempts')
                .select(ATTEMPT_COLUMNS)
                .eq('employee_id', profile.id)
                .in('quiz_id', quizIds)
                .not('submitted_at', 'is', null)
            : Promise.resolve({ data: [] }),
          supabase
            .from('certificates')
            .select('*')
            .eq('employee_id', profile.id)
            .eq('course_id', courseId)
            .maybeSingle(),
        ])
        setAttempts(attRes.data || [])
        setCertificate(certRes.data || null)
      }
    } catch (err) {
      setError(err?.message || 'حدث خطأ أثناء تحميل الاختبار')
    } finally {
      setLoading(false)
    }
  }, [courseId, profile?.id])

  useEffect(() => {
    load()
  }, [load])

  const quizStats = useMemo(() => {
    const stats = {}
    quizzes.forEach((q) => {
      const list = attempts.filter((a) => a.quiz_id === q.id)
      stats[q.id] = {
        used: list.length,
        passed: list.some((a) => a.passed),
        best: list.reduce((m, a) => Math.max(m, Number(a.percentage || 0)), 0),
      }
    })
    return stats
  }, [quizzes, attempts])

  const allPassed = quizzes.length > 0 && quizzes.every((q) => quizStats[q.id]?.passed)
  const answeredCount = sheet.filter((q) => answers[q.id] !== undefined).length

  const passingOf = (q) => Number(q?.passing_score ?? course?.passing_score ?? 70)
  const limitOf = (q) => {
    const own = Number(q?.max_attempts)
    if (own > 0) return own
    const fromCourse = Number(course?.max_attempts)
    return fromCourse > 0 ? fromCourse : null
  }

  const startQuiz = (quiz) => {
    const qs = questionsByQuiz[quiz.id] || []
    // ترتيب عشوائي للأسئلة والاختيارات، مع الاحتفاظ برقم الاختيار الأصلي للتصحيح
    const prepared = shuffle(qs).map((q) => ({
      ...q,
      choices: shuffle(q.options.map((text, index) => ({ text, index }))),
    }))
    setSheet(prepared)
    setAnswers({})
    setResult(null)
    setError('')
    setActiveQuizId(quiz.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const backToList = () => {
    setActiveQuizId(null)
    setResult(null)
    setSheet([])
    setAnswers({})
    setError('')
  }

  const cancelQuiz = () => {
    if (Object.keys(answers).length > 0 && !window.confirm('هل تريد الخروج من الاختبار؟ ستفقد إجاباتك الحالية.')) return
    backToList()
  }

  const issueCertificate = async () => {
    const { data, error: certErr } = await supabase.rpc('issue_certificate', { p_course_id: courseId })
    if (certErr) throw new Error(certErr.message)
    if (data?.success) {
      setCertificate({
        cert_number: data.cert_number,
        issued_date: data.issued_date,
        final_score: data.final_score,
        trainer_name: 'مدرب الكورس المعتمد',
      })
    }
  }

  const handleSubmit = async () => {
    const unanswered = sheet.length - answeredCount
    if (unanswered > 0) {
      setError(`يجب الإجابة على جميع الأسئلة قبل التسليم! يتبقى ${unanswered} سؤال لم تقم بالإجابة عليه.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setError('')
    try {
      // التصحيح يتم بالكامل على السيرفر
      const { data, error: rpcErr } = await supabase.rpc('submit_quiz', {
        p_quiz_id: activeQuizId,
        p_answers: answers,
      })
      if (rpcErr) throw new Error(rpcErr.message)

      const row = Array.isArray(data) ? data[0] : data
      if (!row) throw new Error('لم يتم استلام نتيجة من السيرفر')

      const res = {
        passed: !!row.r_passed,
        percentage: Number(row.r_percentage),
        score_points: row.r_score_points,
        total_points: row.r_total_points,
        passing_score: Number(row.r_passing_score),
      }
      setResult(res)

      const { data: fresh } = await supabase
        .from('quiz_attempts')
        .select(ATTEMPT_COLUMNS)
        .eq('employee_id', profile.id)
        .in('quiz_id', quizzes.map((q) => q.id))
        .not('submitted_at', 'is', null)
      const freshAttempts = fresh || attempts
      setAttempts(freshAttempts)

      if (res.passed) {
        const passedIds = new Set(freshAttempts.filter((a) => a.passed).map((a) => a.quiz_id))
        const everyPassed = quizzes.every((q) => passedIds.has(q.id))

        if (everyPassed && profile?.id) {
          await upsertCourseProgress(profile.id, courseId, 100)
          if (course?.certificate_eligible !== false) await issueCertificate()
        }
      }
    } catch (e) {
      setError(e?.message || 'حدث خطأ أثناء تسليم الاختبار')
    } finally {
      setSubmitting(false)
    }
  }

  const handleIssueCertificate = async () => {
    setIssuing(true)
    setError('')
    try {
      await issueCertificate()
    } catch (e) {
      setError(e?.message || 'تعذر إصدار الشهادة')
    } finally {
      setIssuing(false)
    }
  }

  const downloadCert = () =>
    downloadCertificatePdf({
      cert_number: certificate?.cert_number,
      employee_name: profile?.full_name || 'User',
      course_name: course?.name || 'Course',
      issued_date: certificate?.issued_date,
      trainer_name: certificate?.trainer_name,
      final_score: certificate?.final_score != null ? `${certificate.final_score}%` : undefined,
    })

  if (loading) return <div className="p-12 text-center text-white"><Spinner /></div>

  const activeQuiz = quizzes.find((q) => q.id === activeQuizId) || null
  const activeStats = activeQuiz ? quizStats[activeQuiz.id] : null
  const activeLimit = activeQuiz ? limitOf(activeQuiz) : null
  const canRetake = activeQuiz ? activeLimit === null || (activeStats?.used ?? 0) < activeLimit : false

  const certificateCard = certificate && (
    <div className="card bg-gray-900 border-2 border-teal-700 p-6 rounded-xl shadow-xl text-center space-y-4">
      <h2 className="text-2xl font-bold text-white">شهادة اجتياز الكورس</h2>
      <p className="text-sm text-gray-300">
        منحت للمتدرّب: <strong className="text-teal-300">{profile?.full_name || 'User'}</strong>
      </p>
      <button
        className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer shadow-lg transition-all"
        onClick={downloadCert}
      >
        📥 تحميل الشهادة (PDF)
      </button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 text-white">
      <Link to={`/courses/${courseId || ''}`} className="text-sm text-teal-400 hover:underline font-bold">← Back to course</Link>

      <h1 className="text-2xl font-bold text-white mb-4">
        {activeQuiz?.title || (course?.name ? `الاختبارات — ${course.name}` : 'الاختبارات')}
      </h1>

      {error && <div className="text-sm text-red-400 bg-red-950 border border-red-800 rounded p-3 font-semibold">{error}</div>}

      {quizzes.length === 0 ? (
        <div className="card p-6 bg-gray-900 border border-gray-800 shadow rounded-lg text-gray-300">
          لا يوجد اختبار لهذا الكورس.
        </div>
      ) : !activeQuiz ? (
        /* ---------- قائمة الاختبارات ---------- */
        <div className="space-y-4">
          <p className="text-gray-300 text-sm">
            الكورس: <strong className="text-white">{course?.name}</strong>
            {quizzes.length > 1 && ` — يجب اجتياز ${quizzes.length} اختبارات للحصول على الشهادة`}
          </p>

          {quizzes.map((q) => {
            const stats = quizStats[q.id] || { used: 0, passed: false, best: 0 }
            const limit = limitOf(q)
            const exhausted = limit !== null && stats.used >= limit && !stats.passed
            const qCount = questionsByQuiz[q.id]?.length || 0
            return (
              <div key={q.id} className="card p-5 bg-gray-900 border border-gray-800 shadow rounded-lg space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-lg text-white">{q.title}</p>
                  {stats.passed ? (
                    <Badge tone="success">Passed (اجتياز ناجح)</Badge>
                  ) : stats.used > 0 ? (
                    <Badge tone="danger">Not passed</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-gray-400">
                  {qCount} أسئلة · درجة النجاح {passingOf(q)}%
                  {limit !== null ? ` · المحاولات ${stats.used}/${limit}` : stats.used > 0 ? ` · المحاولات ${stats.used}` : ''}
                  {stats.used > 0 ? ` · أفضل نتيجة ${Math.round(stats.best)}%` : ''}
                </p>
                {exhausted && <p className="text-yellow-400 text-sm">استنفدت جميع المحاولات المسموحة لهذا الاختبار.</p>}
                {qCount === 0 ? (
                  <p className="text-red-400 text-sm font-semibold">لا توجد أسئلة في هذا الاختبار بعد.</p>
                ) : (
                  <button
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={exhausted}
                    onClick={() => startQuiz(q)}
                  >
                    {stats.used > 0 ? 'Retake quiz (إعادة المحاولة)' : 'Start quiz'}
                  </button>
                )}
              </div>
            )
          })}

          {allPassed && certificateCard}

          {allPassed && !certificate && course?.certificate_eligible !== false && (
            <button
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
              disabled={issuing}
              onClick={handleIssueCertificate}
            >
              {issuing ? 'جاري إصدار الشهادة...' : 'إصدار الشهادة'}
            </button>
          )}
        </div>
      ) : result ? (
        /* ---------- النتيجة ---------- */
        <div className="space-y-6">
          <div className="card p-6 text-center bg-gray-900 border border-gray-800 rounded-lg shadow">
            <Badge tone={result.passed ? 'success' : 'danger'}>
              {result.passed ? 'Passed (اجتياز ناجح)' : 'Not passed (لم تتخطى درجة النجاح)'}
            </Badge>
            <p className="text-4xl font-bold mt-3 text-teal-400">{Math.round(result.percentage)}%</p>
            <p className="text-gray-400 mt-1">
              الدرجة: {result.score_points} من أصل {result.total_points} · درجة النجاح {result.passing_score}%
            </p>
          </div>

          {result.passed && certificate && certificateCard}

          {result.passed && !allPassed && (
            <p className="text-sm text-gray-300 text-center">
              أحسنت! اجتزت هذا الاختبار. أكمل باقي اختبارات الكورس للحصول على الشهادة.
            </p>
          )}

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded font-bold" onClick={backToList}>
              العودة إلى الاختبارات
            </button>
            {!result.passed && canRetake && (
              <button className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold" onClick={() => startQuiz(activeQuiz)}>
                إعادة المحاولة
              </button>
            )}
            {!result.passed && !canRetake && (
              <p className="text-yellow-400 text-sm">استنفدت جميع المحاولات المسموحة.</p>
            )}
          </div>
        </div>
      ) : (
        /* ---------- أثناء الاختبار ---------- */
        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm text-gray-300">
            <span>تمت الإجابة على {answeredCount} من {sheet.length}</span>
            <button className="text-gray-400 hover:text-white underline" onClick={cancelQuiz}>إلغاء</button>
          </div>

          {sheet.map((q, i) => {
            const answered = answers[q.id] !== undefined
            return (
              <div key={q.id} className={`card p-5 bg-gray-900 border ${answered ? 'border-teal-800' : 'border-gray-800'} rounded-lg shadow`}>
                <div className="flex justify-between items-center mb-3 gap-3">
                  <p className="font-semibold text-gray-100 text-lg">{i + 1}. {q.text}</p>
                  {answered && <span className="text-xs bg-teal-900 text-teal-300 px-2 py-0.5 rounded shrink-0">تمت الإجابة</span>}
                </div>

                <div className="space-y-2 mt-4">
                  {q.choices.map((c) => {
                    const checked = answers[q.id] === c.index
                    return (
                      <label
                        key={c.index}
                        className={`flex items-center gap-3 p-3 rounded cursor-pointer border transition-all ${
                          checked
                            ? 'border-teal-600 bg-teal-950/40 text-teal-200'
                            : 'border-gray-800 bg-gray-900/50 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q_${q.id}`}
                          checked={checked}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: c.index }))}
                          className="accent-teal-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-base">{c.text}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <button
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer shadow-lg transition-all text-lg mt-6 disabled:opacity-50"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'جاري تقييم النتيجة...' : 'Submit quiz (تسليم الاختبار)'}
          </button>
        </div>
      )}
    </div>
  )
}
