import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../../components/Ui'

// ---------- ثوابت ----------
const DRAFT_KEY = 'course_builder_draft_v2'
const LEGACY_KEYS = ['course_view_mode', 'course_editing_id', 'course_form_data', 'course_modules_data']
const LIVE_TABLES = ['courses', 'course_departments', 'departments', 'profiles', 'modules', 'lessons']
const MAX_PDF_MB = 25
const MAX_OPTIONS = 6

const CONTENT_TYPES = [
  { id: 'video', label: 'Video link (YouTube / URL)' },
  { id: 'pdf', label: 'PDF file' },
  { id: 'text', label: 'Text & notes' },
]

const cardCls = 'rounded-2xl bg-[#14181d]/85 border border-white/10 backdrop-blur-xl shadow-xl'
const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 text-sm text-white placeholder-gray-500 focus:border-rose-500 focus:outline-none transition-colors'
const labelCls = 'block mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400'
const primaryBtn =
  'px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-950/40'
const secondaryBtn =
  'px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const iconBtn =
  'w-7 h-7 flex items-center justify-center rounded-md text-xs text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed'

// ---------- أدوات عامة ----------
let uidCounter = 0
const uid = () => `u${Date.now().toString(36)}${(uidCounter++).toString(36)}`

const must = (res, context) => {
  if (res?.error) throw new Error(`${context}: ${res.error.message}`)
  return res?.data ?? null
}

const isPublished = (status) => String(status || '').toLowerCase() === 'published'

const isValidUrl = (value) => {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const moveBy = (arr, index, dir) => {
  const target = index + dir
  if (target < 0 || target >= arr.length) return arr
  const copy = [...arr]
  ;[copy[index], copy[target]] = [copy[target], copy[index]]
  return copy
}

const fileNameFromUrl = (url) => {
  try {
    return decodeURIComponent(String(url).split('/').pop().split('?')[0]) || 'file.pdf'
  } catch {
    return 'file.pdf'
  }
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
  opts = (Array.isArray(opts) ? opts : []).map((o) =>
    typeof o === 'string' ? o : o?.text || o?.answer_text || String(o ?? '')
  )
  while (opts.length < 2) opts.push('')
  return opts
}

// ---------- مصانع الكائنات ----------
const emptyCourse = {
  name: '',
  description: '',
  course_code: '',
  passing_score: 70,
  certificate_eligible: true,
  required: false,
  status: 'draft',
}

const newLesson = () => ({
  uid: uid(),
  id: null,
  title: '',
  content_type: 'video',
  video_url: '',
  pdf_url: '',
  pdf_name: '',
  text_content: '',
  duration: 15,
})

const newQuestion = () => ({
  uid: uid(),
  id: null,
  question_text: '',
  options: ['', '', '', ''],
  correct_answer: 0,
  points: 10,
})

const newQuiz = (title = '') => ({ id: null, title, questions: [newQuestion()] })

const newModule = (n) => ({
  uid: uid(),
  id: null,
  title: `Module ${n}`,
  collapsed: false,
  lessons: [newLesson()],
  quiz: null,
})

const readDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ---------- مكونات صغيرة ----------
function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 text-left"
    >
      <span
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-rose-600' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
    </button>
  )
}

function StatCard({ label, value }) {
  return (
    <div className={`${cardCls} p-4`}>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1 text-white">{value}</p>
    </div>
  )
}

function StatusPill({ status }) {
  const published = isPublished(status)
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
        published
          ? 'bg-green-500/15 text-green-400 border-green-500/30'
          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      }`}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

function SectionHeader({ step, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-full bg-rose-600/20 border border-rose-500/40 text-rose-300 text-sm font-bold flex items-center justify-center shrink-0">
          {step}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export default function CourseBuilder() {
  const { profile } = useAuth()

  // ----- بيانات النظام -----
  const [view, setView] = useState('list') // list | form
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [courses, setCourses] = useState([])
  const [departments, setDepartments] = useState([])
  const [people, setPeople] = useState([])
  const [contentCounts, setContentCounts] = useState({})

  // ----- فلاتر القائمة -----
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  // ----- الفورم -----
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [courseData, setCourseData] = useState(emptyCourse)
  const [deptMode, setDeptMode] = useState('all') // all | specific
  const [selectedDepts, setSelectedDepts] = useState([])
  const [deptSearch, setDeptSearch] = useState('')
  const [modules, setModules] = useState([newModule(1)])
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState({})
  const [openingId, setOpeningId] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [notice, setNotice] = useState(null)

  const notify = useCallback((type, text) => setNotice({ type, text }), [])

  // ---------- تحميل البيانات ----------
  const loadAll = useCallback(async () => {
    try {
      const [deptRes, courseRes, modRes, lessonRes, peopleRes] = await Promise.all([
        supabase.from('departments').select('id, name').order('name', { ascending: true }),
        supabase
          .from('courses')
          .select('*, course_departments(department_id)')
          .order('created_at', { ascending: false }),
        supabase.from('modules').select('id, course_id'),
        supabase.from('lessons').select('id, module_id'),
        supabase.from('profiles').select('id, role, is_active, department, department_id'),
      ])

      let courseRows = courseRes.data
      if (courseRes.error) {
        // احتياطي: لو علاقة course_departments غير متاحة نجلب الكورسات بدونها
        const fallback = await supabase.from('courses').select('*').order('created_at', { ascending: false })
        if (fallback.error) throw fallback.error
        courseRows = fallback.data
      }

      const moduleToCourse = {}
      const counts = {}
      ;(modRes.data || []).forEach((m) => {
        moduleToCourse[m.id] = m.course_id
        counts[m.course_id] = counts[m.course_id] || { modules: 0, lessons: 0 }
        counts[m.course_id].modules += 1
      })
      ;(lessonRes.data || []).forEach((l) => {
        const cid = moduleToCourse[l.module_id]
        if (!cid) return
        counts[cid] = counts[cid] || { modules: 0, lessons: 0 }
        counts[cid].lessons += 1
      })

      setDepartments(deptRes.data || [])
      setCourses(courseRows || [])
      setPeople(peopleRes.data || [])
      setContentCounts(counts)
      setLoadError('')
    } catch (err) {
      console.error('CourseBuilder load error:', err)
      setLoadError(err.message || 'Failed to load courses.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
    loadAll()

    // تحديث تلقائي للقائمة عند أي تغيير (كورس / إدارة / موظف)
    let timer = null
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(loadAll, 800)
    }
    const channel = supabase.channel('course-builder-live')
    LIVE_TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
    })
    channel.subscribe()

    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [loadAll])

  // إخفاء الإشعارات تلقائياً
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  // حفظ مسودة محلية تلقائياً للكورس الجديد فقط
  useEffect(() => {
    if (view !== 'form' || editingCourseId) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ courseData, modules, deptMode, selectedDepts }))
      } catch {
        /* التخزين المحلي ممتلئ أو غير متاح */
      }
    }, 600)
    return () => clearTimeout(t)
  }, [view, editingCourseId, courseData, modules, deptMode, selectedDepts])

  // ---------- بيانات مشتقة ----------
  const deptNameById = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d.name])),
    [departments]
  )

  const eligiblePeople = useMemo(
    () => people.filter((p) => p.role === 'employee' && p.is_active !== false),
    [people]
  )

  const deptEmployeeCount = useMemo(() => {
    const result = {}
    departments.forEach((d) => {
      result[d.id] = eligiblePeople.filter(
        (p) => p.department_id === d.id || (p.department && p.department === d.name)
      ).length
    })
    return result
  }, [departments, eligiblePeople])

  const visibleEmployees = useMemo(() => {
    if (deptMode === 'all') return eligiblePeople.length
    const ids = new Set(selectedDepts)
    const names = new Set(selectedDepts.map((id) => deptNameById[id]).filter(Boolean))
    return eligiblePeople.filter(
      (p) => ids.has(p.department_id) || (p.department && names.has(p.department))
    ).length
  }, [deptMode, selectedDepts, eligiblePeople, deptNameById])

  const courseDeptIds = useCallback((course) => {
    const ids = (course.course_departments || []).map((d) => d.department_id).filter(Boolean)
    if (ids.length === 0 && course.department_id) return [course.department_id]
    return ids
  }, [])

  const stats = useMemo(
    () => ({
      total: courses.length,
      published: courses.filter((c) => isPublished(c.status)).length,
      drafts: courses.filter((c) => !isPublished(c.status)).length,
      lessons: Object.values(contentCounts).reduce((acc, c) => acc + c.lessons, 0),
    }),
    [courses, contentCounts]
  )

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase()
    return courses.filter((c) => {
      if (statusFilter === 'published' && !isPublished(c.status)) return false
      if (statusFilter === 'draft' && isPublished(c.status)) return false
      if (deptFilter) {
        const ids = courseDeptIds(c)
        if (deptFilter === '__all__') {
          if (ids.length > 0) return false
        } else if (!ids.includes(deptFilter)) {
          return false
        }
      }
      if (!q) return true
      return [c.name, c.course_code].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [courses, search, statusFilter, deptFilter, courseDeptIds])

  const filteredDepartments = useMemo(() => {
    const q = deptSearch.trim().toLowerCase()
    return departments.filter((d) => !q || String(d.name).toLowerCase().includes(q))
  }, [departments, deptSearch])

  const summary = useMemo(() => {
    let lessons = 0
    let questions = 0
    let minutes = 0
    modules.forEach((m) => {
      lessons += m.lessons.length
      m.lessons.forEach((l) => {
        minutes += Number(l.duration || 0)
      })
      questions += m.quiz ? m.quiz.questions.length : 0
    })
    return { modules: modules.length, lessons, questions, minutes }
  }, [modules])

  // ---------- أدوات الفورم ----------
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const nextCourseCode = async () => {
    const { data } = await supabase.from('courses').select('course_code')
    const max = (data || []).reduce((acc, row) => {
      const match = String(row.course_code || '').match(/(\d+)\s*$/)
      return match ? Math.max(acc, parseInt(match[1], 10)) : acc
    }, 0)
    return `CRS-${String(max + 1).padStart(4, '0')}`
  }

  const resetForm = (code) => {
    setEditingCourseId(null)
    setCourseData({ ...emptyCourse, course_code: code })
    setDeptMode('all')
    setSelectedDepts([])
    setDeptSearch('')
    setModules([newModule(1)])
    setErrors([])
  }

  const openCreate = async () => {
    const code = await nextCourseCode()
    const draft = readDraft()
    if (draft) {
      setEditingCourseId(null)
      setCourseData({ ...emptyCourse, ...draft.courseData, course_code: code, status: 'draft' })
      setDeptMode(draft.deptMode || 'all')
      setSelectedDepts(draft.selectedDepts || [])
      setModules(draft.modules?.length ? draft.modules : [newModule(1)])
      setDeptSearch('')
      setErrors([])
      setDraftRestored(true)
    } else {
      resetForm(code)
      setDraftRestored(false)
    }
    setView('form')
    scrollTop()
  }

  const discardDraft = async () => {
    localStorage.removeItem(DRAFT_KEY)
    resetForm(await nextCourseCode())
    setDraftRestored(false)
    notify('success', 'Draft discarded.')
  }

  // تحميل محتوى كورس كامل (مديولات + دروس + اختبارات) وتحويله لحالة الفورم
  const loadCourseContent = async (courseId, stripIds) => {
    const [modRes, quizRes] = await Promise.all([
      supabase.from('modules').select('*').eq('course_id', courseId).order('sort_order', { ascending: true }),
      supabase.from('quizzes').select('*').eq('course_id', courseId),
    ])
    const mods = must(modRes, 'Loading modules') || []
    const quizzes = must(quizRes, 'Loading quizzes') || []

    const lessonsRes = mods.length
      ? await supabase
          .from('lessons')
          .select('*')
          .in('module_id', mods.map((m) => m.id))
          .order('sort_order', { ascending: true })
      : { data: [] }
    const questionsRes = quizzes.length
      ? await supabase
          .from('quiz_questions')
          .select('*')
          .in('quiz_id', quizzes.map((q) => q.id))
          .order('sort_order', { ascending: true })
      : { data: [] }

    const lessons = must(lessonsRes, 'Loading lessons') || []
    const questions = must(questionsRes, 'Loading questions') || []
    const keepId = (id) => (stripIds ? null : id)

    return mods.map((m) => {
      const moduleLessons = lessons
        .filter((l) => l.module_id === m.id)
        .map((l) => {
          const rawType = String(l.content_type || 'video')
          let type = 'video'
          if (rawType === 'text') type = 'text'
          else if (['pdf', 'pptx', 'docx', 'image'].includes(rawType)) type = 'pdf'
          const pdfUrl = l.pdf_url || (type === 'pdf' ? l.body : '') || ''
          return {
            uid: uid(),
            id: keepId(l.id),
            title: l.title || '',
            content_type: type,
            video_url: l.video_url || (type === 'video' ? l.body : '') || '',
            pdf_url: pdfUrl,
            pdf_name: pdfUrl ? fileNameFromUrl(pdfUrl) : '',
            text_content: l.text_content || (type === 'text' ? l.body : '') || '',
            duration: Number(l.duration ?? l.duration_minutes ?? 15),
          }
        })

      const quiz = quizzes.find((q) => q.module_id === m.id)
      const quizQuestions = quiz ? questions.filter((q) => q.quiz_id === quiz.id) : []

      return {
        uid: uid(),
        id: keepId(m.id),
        title: m.title || '',
        collapsed: false,
        lessons: moduleLessons.length ? moduleLessons : [newLesson()],
        quiz: quiz
          ? {
              id: keepId(quiz.id),
              title: quiz.title || '',
              questions: quizQuestions.length
                ? quizQuestions.map((q) => ({
                    uid: uid(),
                    id: keepId(q.id),
                    question_text: q.question_text || '',
                    options: normalizeOptions(q.options),
                    correct_answer: Number.isInteger(q.correct_answer) ? q.correct_answer : 0,
                    points: Number(q.points || 10),
                  }))
                : [newQuestion()],
            }
          : null,
      }
    })
  }

  const openEdit = async (course, { asCopy = false } = {}) => {
    setOpeningId(course.id)
    try {
      const mods = await loadCourseContent(course.id, asCopy)
      const deptIds = courseDeptIds(course)
      const code = asCopy ? await nextCourseCode() : course.course_code || ''

      setEditingCourseId(asCopy ? null : course.id)
      setCourseData({
        name: asCopy ? `${course.name || ''} (Copy)` : course.name || '',
        description: course.description || '',
        course_code: code,
        passing_score: course.passing_score ?? course.passing_percentage ?? 70,
        certificate_eligible: course.certificate_eligible ?? true,
        required: course.required ?? course.is_required ?? false,
        status: asCopy ? 'draft' : course.status || 'draft',
      })
      setDeptMode(deptIds.length > 0 ? 'specific' : 'all')
      setSelectedDepts(deptIds)
      setDeptSearch('')
      setModules(mods.length ? mods : [newModule(1)])
      setErrors([])
      setDraftRestored(false)
      setView('form')
      scrollTop()
    } catch (err) {
      console.error('Open course error:', err)
      notify('error', err.message || 'Failed to open the course.')
    } finally {
      setOpeningId(null)
    }
  }

  // ---------- أفعال القائمة ----------
  const handleToggleStatus = async (course) => {
    const newStatus = isPublished(course.status) ? 'draft' : 'published'
    try {
      must(await supabase.from('courses').update({ status: newStatus }).eq('id', course.id), 'Updating status')
      setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, status: newStatus } : c)))
      notify('success', newStatus === 'published' ? 'Course published.' : 'Course moved to drafts.')
    } catch (err) {
      notify('error', err.message)
    }
  }

  const handleDeleteCourse = async (course) => {
    if (!window.confirm(`Delete "${course.name}" permanently? Employee progress for this course will be affected.`)) return
    try {
      must(await supabase.from('courses').delete().eq('id', course.id), 'Deleting course')
      setCourses((prev) => prev.filter((c) => c.id !== course.id))
      notify('success', 'Course deleted.')
    } catch (err) {
      notify('error', `${err.message}. If employees already have progress, move the course to drafts instead.`)
    }
  }

  // ---------- تعديلات حالة المديولات ----------
  const patchModule = (mUid, patch) =>
    setModules((prev) => prev.map((m) => (m.uid === mUid ? { ...m, ...patch } : m)))

  const patchLesson = (mUid, lUid, patch) =>
    setModules((prev) =>
      prev.map((m) =>
        m.uid !== mUid
          ? m
          : { ...m, lessons: m.lessons.map((l) => (l.uid === lUid ? { ...l, ...patch } : l)) }
      )
    )

  const patchQuiz = (mUid, patch) =>
    setModules((prev) =>
      prev.map((m) => (m.uid !== mUid || !m.quiz ? m : { ...m, quiz: { ...m.quiz, ...patch } }))
    )

  const patchQuestion = (mUid, qUid, patch) =>
    setModules((prev) =>
      prev.map((m) =>
        m.uid !== mUid || !m.quiz
          ? m
          : {
              ...m,
              quiz: {
                ...m.quiz,
                questions: m.quiz.questions.map((q) => (q.uid === qUid ? { ...q, ...patch } : q)),
              },
            }
      )
    )

  const addModule = () => setModules((prev) => [...prev, newModule(prev.length + 1)])

  const removeModule = (mod) => {
    const hasContent = mod.lessons.some((l) => l.title.trim()) || mod.quiz
    if (hasContent && !window.confirm(`Delete "${mod.title || 'this module'}" with all its lessons and quiz?`)) return
    setModules((prev) => prev.filter((m) => m.uid !== mod.uid))
  }

  const addLesson = (mUid) =>
    setModules((prev) => prev.map((m) => (m.uid === mUid ? { ...m, lessons: [...m.lessons, newLesson()] } : m)))

  const removeLesson = (mUid, lUid) =>
    setModules((prev) =>
      prev.map((m) => (m.uid === mUid ? { ...m, lessons: m.lessons.filter((l) => l.uid !== lUid) } : m))
    )

  const moveLesson = (mUid, index, dir) =>
    setModules((prev) =>
      prev.map((m) => (m.uid === mUid ? { ...m, lessons: moveBy(m.lessons, index, dir) } : m))
    )

  const addQuiz = (mod) => patchModule(mod.uid, { quiz: newQuiz(`${mod.title || 'Module'} Quiz`) })

  const removeQuiz = (mUid) => {
    if (!window.confirm('Remove this quiz and all its questions?')) return
    patchModule(mUid, { quiz: null })
  }

  const addQuestion = (mUid) =>
    setModules((prev) =>
      prev.map((m) =>
        m.uid !== mUid || !m.quiz ? m : { ...m, quiz: { ...m.quiz, questions: [...m.quiz.questions, newQuestion()] } }
      )
    )

  const removeQuestion = (mUid, qUid) =>
    setModules((prev) =>
      prev.map((m) =>
        m.uid !== mUid || !m.quiz
          ? m
          : { ...m, quiz: { ...m.quiz, questions: m.quiz.questions.filter((q) => q.uid !== qUid) } }
      )
    )

  const moveQuestion = (mUid, index, dir) =>
    setModules((prev) =>
      prev.map((m) =>
        m.uid !== mUid || !m.quiz
          ? m
          : { ...m, quiz: { ...m.quiz, questions: moveBy(m.quiz.questions, index, dir) } }
      )
    )

  const setOption = (mUid, q, oIdx, value) =>
    patchQuestion(mUid, q.uid, { options: q.options.map((o, i) => (i === oIdx ? value : o)) })

  const addOption = (mUid, q) => {
    if (q.options.length >= MAX_OPTIONS) return
    patchQuestion(mUid, q.uid, { options: [...q.options, ''] })
  }

  const removeOption = (mUid, q, oIdx) => {
    if (q.options.length <= 2) return
    let correct = q.correct_answer
    if (oIdx === correct) correct = 0
    else if (oIdx < correct) correct -= 1
    patchQuestion(mUid, q.uid, { options: q.options.filter((_, i) => i !== oIdx), correct_answer: correct })
  }

  const toggleDept = (id) =>
    setSelectedDepts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // ---------- رفع ملفات PDF ----------
  const handleFileUpload = async (e, mUid, lUid) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.type !== 'application/pdf') {
      notify('error', 'Only PDF files are supported.')
      return
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      notify('error', `The file is too large. Maximum size is ${MAX_PDF_MB} MB.`)
      return
    }

    setUploading((prev) => ({ ...prev, [lUid]: true }))
    try {
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`
      const filePath = `course_files/${fileName}`

      const { error: uploadError } = await supabase.storage.from('course-files').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('course-files').getPublicUrl(filePath)
      patchLesson(mUid, lUid, { pdf_url: data.publicUrl, pdf_name: file.name })
      notify('success', 'File uploaded successfully.')
    } catch (err) {
      notify('error', `Upload failed: ${err.message}`)
    } finally {
      setUploading((prev) => ({ ...prev, [lUid]: false }))
    }
  }

  // ---------- التحقق من صحة البيانات ----------
  const validateForm = () => {
    const errs = []
    if (!courseData.name.trim()) errs.push('Course name is required.')

    const passing = Number(courseData.passing_score)
    if (!(passing >= 1 && passing <= 100)) errs.push('Passing score must be between 1 and 100.')

    if (deptMode === 'specific' && selectedDepts.length === 0) {
      errs.push('Select at least one department, or choose "All departments".')
    }

    if (modules.length === 0) errs.push('Add at least one module.')

    modules.forEach((m, mi) => {
      const mLabel = `Module ${mi + 1}`
      if (!m.title.trim()) errs.push(`${mLabel}: title is required.`)
      if (m.lessons.length === 0) errs.push(`${mLabel}: add at least one lesson.`)

      m.lessons.forEach((l, li) => {
        const label = `${mLabel} › Lesson ${li + 1}`
        if (!l.title.trim()) errs.push(`${label}: title is required.`)
        if (!(Number(l.duration) > 0)) errs.push(`${label}: duration must be greater than 0.`)
        if (l.content_type === 'video') {
          if (!l.video_url.trim()) errs.push(`${label}: video link is required.`)
          else if (!isValidUrl(l.video_url.trim())) errs.push(`${label}: video link must start with http:// or https://.`)
        }
        if (l.content_type === 'pdf' && !l.pdf_url) errs.push(`${label}: upload a PDF file.`)
        if (l.content_type === 'text' && !l.text_content.trim()) errs.push(`${label}: lesson text is required.`)
      })

      if (m.quiz) {
        const qLabelBase = `${mLabel} › Quiz`
        if (!m.quiz.title.trim()) errs.push(`${qLabelBase}: title is required.`)
        if (m.quiz.questions.length === 0) errs.push(`${qLabelBase}: add at least one question (or remove the quiz).`)
        m.quiz.questions.forEach((q, qi) => {
          const label = `${qLabelBase} › Question ${qi + 1}`
          if (!q.question_text.trim()) errs.push(`${label}: question text is required.`)
          if (q.options.some((o) => !o.trim())) errs.push(`${label}: fill in or remove empty options.`)
          if (!(Number(q.points) > 0)) errs.push(`${label}: points must be greater than 0.`)
        })
      }
    })

    return errs
  }

  // ---------- الحفظ (مزامنة آمنة بدون مسح تقدم الموظفين) ----------
  const syncCourseDepartments = async (courseId, ids) => {
    const existing = must(
      await supabase.from('course_departments').select('department_id').eq('course_id', courseId),
      'Loading course departments'
    ) || []
    const existingIds = existing.map((r) => r.department_id)

    const toRemove = existingIds.filter((id) => !ids.includes(id))
    const toAdd = ids.filter((id) => !existingIds.includes(id))

    if (toRemove.length) {
      must(
        await supabase.from('course_departments').delete().eq('course_id', courseId).in('department_id', toRemove),
        'Removing departments'
      )
    }
    if (toAdd.length) {
      must(
        await supabase
          .from('course_departments')
          .insert(toAdd.map((department_id) => ({ course_id: courseId, department_id }))),
        'Linking departments'
      )
    }
  }

  const buildLessonPayload = (l, moduleId, idx) => {
    const url = l.video_url.trim()
    return {
      module_id: moduleId,
      title: l.title.trim() || `Lesson ${idx + 1}`,
      content_type: l.content_type,
      video_url: l.content_type === 'video' ? url : '',
      pdf_url: l.content_type === 'pdf' ? l.pdf_url : '',
      text_content: l.content_type === 'text' ? l.text_content : '',
      body: l.content_type === 'text' ? l.text_content : l.content_type === 'video' ? url : l.pdf_url,
      duration: Number(l.duration || 15),
      duration_minutes: Number(l.duration || 15),
      sort_order: idx + 1,
      order_index: idx + 1,
    }
  }

  const buildQuestionPayload = (q, quizId, idx) => {
    const options = q.options.map((o) => o.trim())
    return {
      quiz_id: quizId,
      question_text: q.question_text.trim(),
      options,
      correct_answer: q.correct_answer,
      correct_answer_text: options[q.correct_answer] || '',
      points: Number(q.points || 10),
      sort_order: idx + 1,
    }
  }

  const deleteQuizzes = async (quizIds) => {
    if (!quizIds.length) return
    must(await supabase.from('quiz_questions').delete().in('quiz_id', quizIds), 'Removing questions')
    must(await supabase.from('quizzes').delete().in('id', quizIds), 'Removing quizzes')
  }

  const syncContent = async (courseId, mods, passingScore) => {
    const existingMods = must(await supabase.from('modules').select('id').eq('course_id', courseId), 'Loading modules') || []
    const existingModIds = existingMods.map((m) => m.id)

    const existingLessons = existingModIds.length
      ? must(await supabase.from('lessons').select('id, module_id').in('module_id', existingModIds), 'Loading lessons') || []
      : []
    const existingQuizzes =
      must(await supabase.from('quizzes').select('id, module_id').eq('course_id', courseId), 'Loading quizzes') || []
    const existingQuizIds = existingQuizzes.map((q) => q.id)
    const existingQuestions = existingQuizIds.length
      ? must(await supabase.from('quiz_questions').select('id, quiz_id').in('quiz_id', existingQuizIds), 'Loading questions') || []
      : []

    // 1) حذف المديولات التي أزالها الأدمن (مع محتواها)
    const keepModIds = new Set(mods.filter((m) => m.id).map((m) => m.id))
    const removedModIds = existingModIds.filter((id) => !keepModIds.has(id))
    if (removedModIds.length) {
      await deleteQuizzes(existingQuizzes.filter((q) => removedModIds.includes(q.module_id)).map((q) => q.id))
      must(await supabase.from('lessons').delete().in('module_id', removedModIds), 'Removing lessons')
      must(await supabase.from('modules').delete().in('id', removedModIds), 'Removing modules')
    }

    // 2) تحديث / إضافة المديولات بالترتيب
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i]
      const modPayload = { course_id: courseId, title: m.title.trim(), sort_order: i + 1, order_index: i + 1 }

      let moduleId = m.id
      if (moduleId) {
        must(await supabase.from('modules').update(modPayload).eq('id', moduleId), 'Updating module')
      } else {
        const created = must(await supabase.from('modules').insert(modPayload).select().single(), 'Creating module')
        moduleId = created.id
      }

      // --- الدروس ---
      const keepLessonIds = new Set(m.lessons.filter((l) => l.id).map((l) => l.id))
      const removedLessonIds = existingLessons
        .filter((l) => l.module_id === moduleId && !keepLessonIds.has(l.id))
        .map((l) => l.id)
      if (removedLessonIds.length) {
        must(await supabase.from('lessons').delete().in('id', removedLessonIds), 'Removing lessons')
      }

      const toInsert = []
      for (let li = 0; li < m.lessons.length; li++) {
        const l = m.lessons[li]
        const payload = buildLessonPayload(l, moduleId, li)
        if (l.id) must(await supabase.from('lessons').update(payload).eq('id', l.id), 'Updating lesson')
        else toInsert.push(payload)
      }
      if (toInsert.length) must(await supabase.from('lessons').insert(toInsert), 'Creating lessons')

      // --- الاختبار ---
      const existingQuiz = existingQuizzes.find((q) => q.module_id === moduleId)

      if (m.quiz) {
        const quizPayload = {
          course_id: courseId,
          module_id: moduleId,
          title: m.quiz.title.trim(),
          passing_score: passingScore,
        }

        let quizId = m.quiz.id || existingQuiz?.id || null
        if (quizId) {
          must(await supabase.from('quizzes').update(quizPayload).eq('id', quizId), 'Updating quiz')
        } else {
          const createdQuiz = must(await supabase.from('quizzes').insert(quizPayload).select().single(), 'Creating quiz')
          quizId = createdQuiz.id
        }

        const keepQuestionIds = new Set(m.quiz.questions.filter((q) => q.id).map((q) => q.id))
        const removedQuestionIds = existingQuestions
          .filter((q) => q.quiz_id === quizId && !keepQuestionIds.has(q.id))
          .map((q) => q.id)
        if (removedQuestionIds.length) {
          must(await supabase.from('quiz_questions').delete().in('id', removedQuestionIds), 'Removing questions')
        }

        const questionInserts = []
        for (let qi = 0; qi < m.quiz.questions.length; qi++) {
          const q = m.quiz.questions[qi]
          const payload = buildQuestionPayload(q, quizId, qi)
          if (q.id) must(await supabase.from('quiz_questions').update(payload).eq('id', q.id), 'Updating question')
          else questionInserts.push(payload)
        }
        if (questionInserts.length) must(await supabase.from('quiz_questions').insert(questionInserts), 'Creating questions')
      } else if (existingQuiz) {
        await deleteQuizzes([existingQuiz.id])
      }
    }
  }

  const handleSave = async (targetStatus) => {
    const errs = validateForm()
    setErrors(errs)
    if (errs.length) {
      scrollTop()
      return
    }

    setBusy(true)
    let createdId = null
    try {
      const totalMinutes = modules.reduce(
        (acc, m) => acc + m.lessons.reduce((a, l) => a + Number(l.duration || 0), 0),
        0
      )
      const passing = Number(courseData.passing_score)
      const deptIds = deptMode === 'specific' ? selectedDepts : []

      const payload = {
        name: courseData.name.trim(),
        description: courseData.description.trim(),
        course_code: courseData.course_code,
        passing_score: passing,
        passing_percentage: passing,
        certificate_eligible: courseData.certificate_eligible,
        required: courseData.required,
        is_required: courseData.required,
        duration: totalMinutes,
        duration_minutes: totalMinutes,
        status: targetStatus,
        department_id: deptIds.length > 0 ? deptIds[0] : null,
      }

      let courseId = editingCourseId
      if (courseId) {
        must(await supabase.from('courses').update(payload).eq('id', courseId), 'Updating course')
      } else {
        const created = must(
          await supabase.from('courses').insert({ ...payload, created_by: profile?.id ?? null }).select().single(),
          'Creating course'
        )
        courseId = created.id
        createdId = created.id
      }

      await syncCourseDepartments(courseId, deptIds)
      await syncContent(courseId, modules, passing)

      if (!editingCourseId) localStorage.removeItem(DRAFT_KEY)

      const audience = deptMode === 'all' ? 'all employees' : `${visibleEmployees} employee(s)`
      notify(
        'success',
        targetStatus === 'published'
          ? `Course published. It is now visible to ${audience}.`
          : 'Course saved as a draft.'
      )

      setView('list')
      setEditingCourseId(null)
      setDraftRestored(false)
      await loadAll()
      scrollTop()
    } catch (err) {
      console.error('Save course error:', err)
      // تراجع: لو الكورس جديد وفشل حفظ محتواه نحذفه حتى لا يبقى ناقصاً
      if (createdId) await supabase.from('courses').delete().eq('id', createdId)
      setErrors([err.message || 'Failed to save the course.'])
      scrollTop()
    } finally {
      setBusy(false)
    }
  }

  // ---------- الواجهة ----------
  const toastEl = notice && (
    <div
      role="status"
      className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium ${
        notice.type === 'success'
          ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
          : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
      }`}
    >
      {notice.text}
    </div>
  )

  if (loading) {
    return (
      <div className="flex justify-center p-16">
        <Spinner />
      </div>
    )
  }

  // =============== قائمة الكورسات ===============
  if (view === 'list') {
    return (
      <div className="space-y-6 max-w-6xl text-white p-6 pb-24 mx-auto text-left" dir="ltr">
        {toastEl}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Course Management</h1>
            <p className="text-gray-400 text-sm mt-1">
              Build courses, target them to departments, and publish them to your employees.
            </p>
          </div>
          <button onClick={openCreate} className={primaryBtn}>
            + Add new course
          </button>
        </div>

        {loadError && (
          <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Courses" value={stats.total} />
          <StatCard label="Published" value={stats.published} />
          <StatCard label="Drafts" value={stats.drafts} />
          <StatCard label="Lessons" value={stats.lessons} />
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            className={`${inputCls} flex-1 min-w-[200px]`}
            placeholder="Search by course name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={`${inputCls} w-44`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <select className={`${inputCls} w-60`} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All departments</option>
            <option value="__all__">Company-wide courses</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/40 text-gray-400 text-xs uppercase tracking-wider">
                <th className="p-4">Course</th>
                <th className="p-4">Departments</th>
                <th className="p-4">Content</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-gray-400">
                    {courses.length === 0 ? 'No courses yet. Click "Add new course" to create the first one.' : 'No courses match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => {
                  const ids = courseDeptIds(course)
                  const names = ids.map((id) => deptNameById[id]).filter(Boolean)
                  const counts = contentCounts[course.id] || { modules: 0, lessons: 0 }
                  const minutes = Number(course.duration_minutes || course.duration || 0)
                  return (
                    <tr key={course.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <p className="font-semibold text-white">{course.name}</p>
                        <p className="text-xs font-mono text-rose-400 mt-0.5">{course.course_code}</p>
                      </td>
                      <td className="p-4">
                        {names.length === 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs bg-teal-500/15 text-teal-300 border border-teal-500/30">
                            All departments
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {names.slice(0, 3).map((n) => (
                              <span key={n} className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-gray-200">
                                {n}
                              </span>
                            ))}
                            {names.length > 3 && (
                              <span className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-gray-400">
                                +{names.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-gray-300">
                        {counts.modules} modules · {counts.lessons} lessons
                      </td>
                      <td className="p-4 text-gray-300">
                        {minutes > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : '—'}
                      </td>
                      <td className="p-4">
                        <StatusPill status={course.status} />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-rose-600 transition-colors disabled:opacity-50"
                            disabled={openingId === course.id}
                            onClick={() => openEdit(course)}
                          >
                            {openingId === course.id ? 'Opening…' : 'Edit'}
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 transition-colors"
                            onClick={() => handleToggleStatus(course)}
                          >
                            {isPublished(course.status) ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 transition-colors"
                            onClick={() => openEdit(course, { asCopy: true })}
                          >
                            Duplicate
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                            onClick={() => handleDeleteCourse(course)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // =============== فورم الكورس ===============
  return (
    <div className="space-y-6 max-w-6xl text-white p-6 pb-24 mx-auto text-left" dir="ltr">
      {toastEl}

      {/* شريط علوي ثابت */}
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-[#0b0e12]/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" className={secondaryBtn} onClick={() => setView('list')} disabled={busy}>
              ← Back
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">
                {editingCourseId ? 'Edit course' : 'Create new course'}
              </h1>
              <p className="text-xs text-gray-400 truncate">
                {summary.modules} modules · {summary.lessons} lessons · {summary.questions} questions ·{' '}
                {Math.floor(summary.minutes / 60)}h {summary.minutes % 60}m
              </p>
            </div>
            {editingCourseId && <StatusPill status={courseData.status} />}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={secondaryBtn} onClick={() => handleSave('draft')} disabled={busy}>
              {busy ? 'Saving…' : 'Save as draft'}
            </button>
            <button type="button" className={primaryBtn} onClick={() => handleSave('published')} disabled={busy}>
              {busy ? 'Saving…' : 'Save & publish'}
            </button>
          </div>
        </div>
      </div>

      {draftRestored && (
        <div className="flex items-center justify-between gap-3 flex-wrap text-sm bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-lg px-4 py-2.5">
          <span>Your last unsaved draft was restored from this browser.</span>
          <button type="button" className="underline hover:text-white" onClick={discardDraft}>
            Discard draft
          </button>
        </div>
      )}

      {errors.length > 0 && (
        <div role="alert" className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-rose-300 mb-1">
            Please fix the following before saving ({errors.length}):
          </p>
          <ul className="list-disc pl-5 text-sm text-rose-200 space-y-0.5 max-h-48 overflow-y-auto">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1) المعلومات الأساسية */}
      <section className={`${cardCls} p-6 space-y-5`}>
        <SectionHeader step="1" title="Basic information" subtitle="Name, description, and completion rules." />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="course-name">Course name *</label>
            <input
              id="course-name"
              className={inputCls}
              placeholder="e.g. Good Manufacturing Practice (GMP)"
              value={courseData.name}
              onChange={(e) => setCourseData({ ...courseData, name: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="course-code">Course code</label>
            <input
              id="course-code"
              className={`${inputCls} text-gray-400 cursor-not-allowed`}
              value={courseData.course_code}
              readOnly
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="course-desc">Description</label>
          <textarea
            id="course-desc"
            rows="3"
            className={inputCls}
            placeholder="What will employees learn in this course?"
            value={courseData.description}
            onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          <div>
            <label className={labelCls} htmlFor="course-pass">Passing score (%)</label>
            <input
              id="course-pass"
              type="number"
              min="1"
              max="100"
              className={inputCls}
              value={courseData.passing_score}
              onChange={(e) => setCourseData({ ...courseData, passing_score: e.target.value })}
            />
          </div>
          <Toggle
            checked={courseData.certificate_eligible}
            onChange={(v) => setCourseData({ ...courseData, certificate_eligible: v })}
            label="Issue a certificate"
            hint="Employees get a certificate after passing."
          />
          <Toggle
            checked={courseData.required}
            onChange={(v) => setCourseData({ ...courseData, required: v })}
            label="Mandatory course"
            hint="Marked as required training."
          />
        </div>
      </section>

      {/* 2) الإدارات المستهدفة */}
      <section className={`${cardCls} p-6 space-y-4`}>
        <SectionHeader
          step="2"
          title="Target departments"
          subtitle="Choose who will see this course in their catalog."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { id: 'all', title: 'All departments', hint: `Company-wide · ${eligiblePeople.length} active employees` },
            { id: 'specific', title: 'Specific departments', hint: 'Only employees of the departments you select' },
          ].map((opt) => (
            <button
              type="button"
              key={opt.id}
              onClick={() => setDeptMode(opt.id)}
              aria-pressed={deptMode === opt.id}
              className={`text-left p-4 rounded-xl border transition-colors ${
                deptMode === opt.id
                  ? 'bg-rose-600/15 border-rose-500'
                  : 'bg-black/30 border-white/10 hover:bg-white/5'
              }`}
            >
              <p className="font-semibold text-sm">{opt.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{opt.hint}</p>
            </button>
          ))}
        </div>

        {deptMode === 'specific' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputCls} flex-1 min-w-[200px]`}
                placeholder="Search departments…"
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
              />
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => setSelectedDepts(Array.from(new Set([...selectedDepts, ...filteredDepartments.map((d) => d.id)])))}
              >
                Select shown
              </button>
              <button type="button" className={secondaryBtn} onClick={() => setSelectedDepts([])}>
                Clear
              </button>
            </div>

            {departments.length === 0 ? (
              <p className="text-sm text-gray-400">No departments registered yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                {filteredDepartments.map((d) => {
                  const active = selectedDepts.includes(d.id)
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => toggleDept(d.id)}
                      aria-pressed={active}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                        active
                          ? 'bg-rose-600/20 border-rose-500 text-white'
                          : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="truncate">{d.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{deptEmployeeCount[d.id] ?? 0}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-gray-300">
          Visible to <span className="font-semibold text-white">{visibleEmployees}</span> active employee(s)
          {deptMode === 'specific' && ` in ${selectedDepts.length} department(s)`}.
        </p>
      </section>

      {/* 3) المديولات والدروس والاختبارات */}
      <section className="space-y-4">
        <div className={`${cardCls} p-6`}>
          <SectionHeader
            step="3"
            title="Modules, lessons & quizzes"
            subtitle="Organize the content. Use the arrows to reorder."
            action={
              <button type="button" className={primaryBtn} onClick={addModule}>
                + Add module
              </button>
            }
          />
        </div>

        {modules.map((mod, mIdx) => {
          const modMinutes = mod.lessons.reduce((acc, l) => acc + Number(l.duration || 0), 0)
          return (
            <div key={mod.uid} className={`${cardCls} overflow-hidden`}>
              {/* رأس المديول */}
              <div className="flex items-center gap-3 p-4 bg-black/30 border-b border-white/10 flex-wrap">
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={mod.collapsed ? 'Expand module' : 'Collapse module'}
                  onClick={() => patchModule(mod.uid, { collapsed: !mod.collapsed })}
                >
                  {mod.collapsed ? '▸' : '▾'}
                </button>
                <span className="w-7 h-7 rounded-md bg-rose-600/20 text-rose-300 text-xs font-bold flex items-center justify-center">
                  {mIdx + 1}
                </span>
                <input
                  className={`${inputCls} flex-1 min-w-[180px] max-w-md font-semibold`}
                  placeholder="Module title"
                  value={mod.title}
                  onChange={(e) => patchModule(mod.uid, { title: e.target.value })}
                />
                <span className="text-xs text-gray-400">
                  {mod.lessons.length} lessons · {modMinutes} min{mod.quiz ? ' · quiz' : ''}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" className={iconBtn} disabled={mIdx === 0} onClick={() => setModules((p) => moveBy(p, mIdx, -1))} aria-label="Move module up">↑</button>
                  <button type="button" className={iconBtn} disabled={mIdx === modules.length - 1} onClick={() => setModules((p) => moveBy(p, mIdx, 1))} aria-label="Move module down">↓</button>
                  {modules.length > 1 && (
                    <button type="button" className={`${iconBtn} text-red-300`} onClick={() => removeModule(mod)} aria-label="Delete module">✕</button>
                  )}
                </div>
              </div>

              {!mod.collapsed && (
                <div className="p-5 space-y-6">
                  {/* الدروس */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Lessons</h3>
                      <button type="button" className="text-xs px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20" onClick={() => addLesson(mod.uid)}>
                        + Add lesson
                      </button>
                    </div>

                    {mod.lessons.map((lesson, lIdx) => (
                      <div key={lesson.uid} className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded bg-white/10 text-[11px] font-semibold flex items-center justify-center text-gray-300">
                            {lIdx + 1}
                          </span>
                          <input
                            className={`${inputCls} flex-1 min-w-[180px]`}
                            placeholder="Lesson title"
                            value={lesson.title}
                            onChange={(e) => patchLesson(mod.uid, lesson.uid, { title: e.target.value })}
                          />
                          <select
                            className={`${inputCls} w-52`}
                            value={lesson.content_type}
                            onChange={(e) => patchLesson(mod.uid, lesson.uid, { content_type: e.target.value })}
                          >
                            {CONTENT_TYPES.map((t) => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              className={`${inputCls} w-20`}
                              value={lesson.duration}
                              onChange={(e) => patchLesson(mod.uid, lesson.uid, { duration: e.target.value })}
                              aria-label="Duration in minutes"
                            />
                            <span className="text-xs text-gray-400">min</span>
                          </div>
                          <div className="flex items-center">
                            <button type="button" className={iconBtn} disabled={lIdx === 0} onClick={() => moveLesson(mod.uid, lIdx, -1)} aria-label="Move lesson up">↑</button>
                            <button type="button" className={iconBtn} disabled={lIdx === mod.lessons.length - 1} onClick={() => moveLesson(mod.uid, lIdx, 1)} aria-label="Move lesson down">↓</button>
                            {mod.lessons.length > 1 && (
                              <button type="button" className={`${iconBtn} text-red-300`} onClick={() => removeLesson(mod.uid, lesson.uid)} aria-label="Delete lesson">✕</button>
                            )}
                          </div>
                        </div>

                        {lesson.content_type === 'video' && (
                          <div>
                            <input
                              className={inputCls}
                              placeholder="Paste a YouTube or video link (https://…)"
                              value={lesson.video_url}
                              onChange={(e) => patchLesson(mod.uid, lesson.uid, { video_url: e.target.value })}
                            />
                            {lesson.video_url.trim() && !isValidUrl(lesson.video_url.trim()) && (
                              <p className="text-xs text-rose-400 mt-1">The link must start with http:// or https://</p>
                            )}
                          </div>
                        )}

                        {lesson.content_type === 'pdf' && (
                          <div className="flex items-center gap-3 flex-wrap">
                            <label className="cursor-pointer px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold transition-colors">
                              {lesson.pdf_url ? 'Replace PDF' : 'Upload PDF'}
                              <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                disabled={!!uploading[lesson.uid]}
                                onChange={(e) => handleFileUpload(e, mod.uid, lesson.uid)}
                              />
                            </label>
                            {uploading[lesson.uid] && <span className="text-xs text-amber-400">Uploading…</span>}
                            {lesson.pdf_url && !uploading[lesson.uid] && (
                              <>
                                <a
                                  href={lesson.pdf_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-teal-300 hover:underline truncate max-w-xs"
                                >
                                  📄 {lesson.pdf_name || 'View file'}
                                </a>
                                <button
                                  type="button"
                                  className="text-xs text-red-300 hover:underline"
                                  onClick={() => patchLesson(mod.uid, lesson.uid, { pdf_url: '', pdf_name: '' })}
                                >
                                  Remove
                                </button>
                              </>
                            )}
                            {!lesson.pdf_url && !uploading[lesson.uid] && (
                              <span className="text-xs text-gray-500">PDF only · max {MAX_PDF_MB} MB</span>
                            )}
                          </div>
                        )}

                        {lesson.content_type === 'text' && (
                          <textarea
                            rows="4"
                            className={inputCls}
                            placeholder="Write the lesson text or notes here…"
                            value={lesson.text_content}
                            onChange={(e) => patchLesson(mod.uid, lesson.uid, { text_content: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* الاختبار */}
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">Module quiz</h3>
                      {mod.quiz ? (
                        <button type="button" className="text-xs text-red-300 hover:underline" onClick={() => removeQuiz(mod.uid)}>
                          Remove quiz
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded-md bg-teal-600/20 text-teal-300 hover:bg-teal-600/30"
                          onClick={() => addQuiz(mod)}
                        >
                          + Add quiz
                        </button>
                      )}
                    </div>

                    {!mod.quiz && <p className="text-xs text-gray-500">No quiz for this module. Add one to assess employees.</p>}

                    {mod.quiz && (
                      <div className="space-y-3">
                        <input
                          className={`${inputCls} max-w-md`}
                          placeholder="Quiz title (e.g. Module 1 Assessment)"
                          value={mod.quiz.title}
                          onChange={(e) => patchQuiz(mod.uid, { title: e.target.value })}
                        />

                        {mod.quiz.questions.map((q, qIdx) => (
                          <div key={q.uid} className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-gray-300">Question {qIdx + 1}</span>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                                  Points
                                  <input
                                    type="number"
                                    min="1"
                                    className={`${inputCls} w-16 py-1.5`}
                                    value={q.points}
                                    onChange={(e) => patchQuestion(mod.uid, q.uid, { points: e.target.value })}
                                  />
                                </label>
                                <button type="button" className={iconBtn} disabled={qIdx === 0} onClick={() => moveQuestion(mod.uid, qIdx, -1)} aria-label="Move question up">↑</button>
                                <button type="button" className={iconBtn} disabled={qIdx === mod.quiz.questions.length - 1} onClick={() => moveQuestion(mod.uid, qIdx, 1)} aria-label="Move question down">↓</button>
                                {mod.quiz.questions.length > 1 && (
                                  <button type="button" className={`${iconBtn} text-red-300`} onClick={() => removeQuestion(mod.uid, q.uid)} aria-label="Delete question">✕</button>
                                )}
                              </div>
                            </div>

                            <input
                              className={inputCls}
                              placeholder="Question text…"
                              value={q.question_text}
                              onChange={(e) => patchQuestion(mod.uid, q.uid, { question_text: e.target.value })}
                            />

                            <div className="space-y-2">
                              <p className="text-[11px] text-gray-500">Select the radio button next to the correct answer.</p>
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct_${q.uid}`}
                                    checked={q.correct_answer === oIdx}
                                    onChange={() => patchQuestion(mod.uid, q.uid, { correct_answer: oIdx })}
                                    className="text-rose-600 focus:ring-0"
                                    aria-label={`Mark option ${oIdx + 1} as correct`}
                                  />
                                  <input
                                    className={`${inputCls} py-2 ${q.correct_answer === oIdx ? 'border-emerald-500/50' : ''}`}
                                    placeholder={`Option ${oIdx + 1}`}
                                    value={opt}
                                    onChange={(e) => setOption(mod.uid, q, oIdx, e.target.value)}
                                  />
                                  {q.options.length > 2 && (
                                    <button type="button" className={`${iconBtn} text-red-300`} onClick={() => removeOption(mod.uid, q, oIdx)} aria-label="Remove option">✕</button>
                                  )}
                                </div>
                              ))}
                              {q.options.length < MAX_OPTIONS && (
                                <button type="button" className="text-xs text-teal-300 hover:underline" onClick={() => addOption(mod.uid, q)}>
                                  + Add option
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded-md bg-teal-600/20 text-teal-300 hover:bg-teal-600/30"
                          onClick={() => addQuestion(mod.uid)}
                        >
                          + Add question
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={addModule}
          className="w-full py-3 rounded-2xl border border-dashed border-white/20 text-sm text-gray-300 hover:bg-white/5 hover:border-rose-500/50 transition-colors"
        >
          + Add another module
        </button>
      </section>

      {/* أزرار الحفظ السفلية */}
      <div className="flex items-center gap-3 pt-4 border-t border-white/10 flex-wrap">
        <button type="button" className={primaryBtn} onClick={() => handleSave('published')} disabled={busy}>
          {busy ? 'Saving…' : 'Save & publish'}
        </button>
        <button type="button" className={secondaryBtn} onClick={() => handleSave('draft')} disabled={busy}>
          Save as draft
        </button>
        <button type="button" className={secondaryBtn} onClick={() => setView('list')} disabled={busy}>
          Cancel
        </button>
        {!editingCourseId && <span className="text-xs text-gray-500">Your work is auto-saved in this browser until you save the course.</span>}
      </div>
    </div>
  )
}
