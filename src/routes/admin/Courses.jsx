import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllCourses, createCourse, listCategories, listTrainers } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Badge, Spinner } from '../../components/Ui'
import { supabase } from '../../lib/supabaseClient' // أضفنا استيراد supabase لجلب وحفظ الإدارات المرتبطة

const TRAINING_TYPES = ['classroom', 'online', 'video', 'e_learning', 'workshop', 'external', 'webinar', 'blended']

const emptyForm = {
  name: '', description: '', category_id: '', training_type: 'online', trainer_id: '',
  duration_minutes: 60, difficulty: 'beginner', passing_score: 80,
  certificate_eligible: true, is_required: false, status: 'draft',
  departments: [] // أضفنا مصفوفة الإدارات هنا بدون تغيير أي شيء قديم
}

export default function AdminCourses() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState(null)
  const [categories, setCategories] = useState([])
  const [trainers, setTrainers] = useState([])
  const [departments, setDepartments] = useState([]) // حالة لحفظ الإدارات
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const refresh = () => listAllCourses().then(setCourses)

  useEffect(() => {
    refresh()
    listCategories().then(setCategories)
    listTrainers().then(setTrainers)
    // جلب الإدارات من جدول departments مباشرة
    supabase.from('departments').select('*').then(({ data }) => {
      if (data) setDepartments(data)
    })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const count = (courses?.length || 0) + 1
      
      // 1. إنشاء الكورس بالطريقة الأصلية تماماً
      const newCourseData = {
        name: form.name,
        description: form.description,
        category_id: form.category_id,
        training_type: form.training_type,
        trainer_id: form.trainer_id,
        duration_minutes: form.duration_minutes,
        difficulty: form.difficulty,
        passing_score: form.passing_score,
        certificate_eligible: form.certificate_eligible,
        is_required: form.is_required,
        status: form.status,
        course_code: `CRS-${String(count).padStart(4, '0')}`,
        created_by: profile.id,
        publish_date: form.status === 'published' ? new Date().toISOString().slice(0, 10) : null,
      }

      // بما أن دالة createCourse قد تختلف في الـ API، سنستعمل الـ API المعتاد ونلتقط الكورس الناتج أو ننشئه عبر الـ API
      const created = await createCourse(newCourseData)

      // لو الـ API رجع الـ id بتاع الكورس الجديد (أو بنجيبه بآخر كورس أضيف لو مش بيجيبه)
      // نفترض أن الـ createCourse بترجع الكورس أو بنجيبه من الـ id المباشر
      let courseId = created?.id;
      if (!courseId) {
        // لو الدالة مش بترجع الكอร์س، هنجيب أحدث كورس أضيف بالـ code أو الاسم
        const { data: latest } = await supabase.from('courses').select('id').eq('course_code', newCourseData.course_code).single()
        if (latest) courseId = latest.id
      }

      // 2. ربط الإدارات المختارة بالكورس في جدول course_departments
      if (courseId && form.departments && form.departments.length > 0) {
        const insertRows = form.departments.map(deptId => ({
          course_id: courseId,
          department_id: deptId
        }))
        await supabase.from('course_departments').insert(insertRows)
      }

      setShowForm(false)
      setForm(emptyForm)
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!courses) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-muted mt-1">{courses.length} courses</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Create course</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card p-5 space-y-3 max-w-xl">
          <h2 className="font-head font-semibold">New course</h2>
          {error && <div className="text-sm text-danger bg-danger-light border border-danger-light rounded px-3 py-2">{error}</div>}
          <div>
            <label className="label">Course name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Training type</label>
              <select className="input" value={form.training_type} onChange={(e) => setForm({ ...form, training_type: e.target.value })}>
                {TRAINING_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Trainer</label>
              <select className="input" value={form.trainer_id} onChange={(e) => setForm({ ...form, trainer_id: e.target.value })}>
                <option value="">—</option>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.profile?.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Duration (minutes)</label>
              <input className="input" type="number" min={0} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Passing score (%)</label>
              <input className="input" type="number" min={0} max={100} value={form.passing_score} onChange={(e) => setForm({ ...form, passing_score: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          {/* إضافة خانات اختيار الإدارات هنا بدقة وبدون المساس بأي شيء */}
          <div>
            <label className="label mb-1">Target Departments (الإدارات المستهدفة)</label>
            <div className="space-y-2 border border-surface-border p-3 rounded bg-surface">
              {departments.map((dept) => {
                const isChecked = form.departments.includes(dept.id)
                return (
                  <label key={dept.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const updatedDepts = e.target.checked
                          ? [...form.departments, dept.id]
                          : form.departments.filter(id => id !== dept.id)
                        setForm({ ...form, departments: updatedDepts })
                      }}
                    />
                    {dept.name}
                  </label>
                )
              })}
              {departments.length === 0 && <p className="text-xs text-muted">No departments found.</p>}
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.certificate_eligible} onChange={(e) => setForm({ ...form, certificate_eligible: e.target.checked })} />
              Certificate eligible
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} />
              Required
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create course'}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-surface-border">
        {courses.map((c) => (
          <Link to={`/admin/courses/${c.id}`} key={c.id} className="p-4 flex items-center justify-between hover:bg-surface transition-colors">
            <div>
              <p className="font-medium text-ink-800">{c.name}</p>
              <p className="text-xs text-muted mt-0.5">{c.course_code} · {c.category?.name || 'Uncategorized'}</p>
            </div>
            <div className="flex items-center gap-2">
              {c.is_required && <Badge tone="warning">Required</Badge>}
              <Badge tone={c.status === 'published' ? 'success' : 'default'}>{c.status}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
