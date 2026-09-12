import { supabase } from './supabaseClient'

// ---------- Employee: assignments & progress ----------
export async function getMyAssignments(employeeId) {
  try {
    const { data, error } = await supabase
      .from('course_assignments')
      .select('*, course:course_id(*)')
      .eq('employee_id', employeeId)

    if (error) {
      const { data: fallbackData } = await supabase
        .from('course_assignments')
        .select('*')
        .eq('employee_id', employeeId)
      return fallbackData || []
    }

    return data || []
  } catch (err) {
    console.error('getMyAssignments error:', err)
    return []
  }
}

export async function getMyProgressMap(employeeId) {
  try {
    const { data, error } = await supabase
      .from('course_progress')
      .select('*')
      .eq('employee_id', employeeId)

    if (error) return {}
    const map = {}
    for (const row of data || []) {
      if (row.course_id) map[row.course_id] = row
    }
    return map
  } catch (err) {
    console.error('getMyProgressMap error:', err)
    return {}
  }
}

export async function getMyCertificates(employeeId) {
  try {
    const { data, error } = await supabase
      .from('certificates')
      .select('*, course:course_id(*)')
      .eq('employee_id', employeeId)

    if (error) {
      const { data: fallbackData } = await supabase
        .from('certificates')
        .select('*')
        .eq('employee_id', employeeId)
      return fallbackData || []
    }
    return data || []
  } catch (err) {
    console.error('getMyCertificates error:', err)
    return []
  }
}

export async function getMyNotifications(employeeId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('employee_id', employeeId)
      .limit(10)

    if (error) return []
    return data || []
  } catch (err) {
    console.error('getMyNotifications error:', err)
    return []
  }
}

// ---------- Course catalog & player ----------
export async function getPublishedCourses() {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')

    if (error) {
      const { data: allCourses } = await supabase.from('courses').select('*')
      return allCourses || []
    }
    return data || []
  } catch (err) {
    console.error('getPublishedCourses error:', err)
    return []
  }
}

export async function getCourseWithStructure(courseId) {
  try {
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .maybeSingle()

    if (courseErr || !course) throw courseErr || new Error('Course not found')

    // جلب الموديولات من الجدول الجديد modules
    const { data: modules, error: modErr } = await supabase
      .from('modules')
      .select('*')
      .eq('course_id', courseId)

    if (modErr) console.error('Modules fetch error:', modErr)

    const formattedModules = (modules || []).map((m) => ({
      ...m,
      lessons: m.lessons || []
    }))

    const { data: quiz } = await supabase
      .from('quizzes')
      .select('*')
      .eq('course_id', courseId)
      .maybeSingle()

    return { course, modules: formattedModules, quiz: quiz || null }
  } catch (err) {
    console.error('getCourseWithStructure error:', err)
    throw err
  }
}

export async function getLessonProgress(employeeId, courseId) {
  try {
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('employee_id', employeeId)

    if (error) return {}
    const map = {}
    for (const row of data || []) {
      if (row.lesson_id) map[row.lesson_id] = row
    }
    return map
  } catch (err) {
    console.error('getLessonProgress error:', err)
    return {}
  }
}

export async function markLessonComplete(employeeId, lessonId) {
  const { error } = await supabase
    .from('lesson_progress')
    .upsert(
      { employee_id: employeeId, lesson_id: lessonId, status: 'completed', completed_at: new Date().toISOString() },
      { onConflict: 'lesson_id,employee_id' }
    )
  if (error) throw error
}

export async function upsertCourseProgress(employeeId, courseId, percent) {
  const payload = {
    employee_id: employeeId,
    course_id: courseId,
    progress_percent: percent,
    last_accessed_at: new Date().toISOString(),
  }
  if (percent > 0) payload.started_at = new Date().toISOString()
  if (percent >= 100) payload.completed_at = new Date().toISOString()

  const { error } = await supabase
    .from('course_progress')
    .upsert(payload, { onConflict: 'course_id,employee_id' })
  if (error) console.warn('upsertCourseProgress warn:', error.message)

  const status = percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'assigned'
  await supabase
    .from('course_assignments')
    .update({ status })
    .eq('course_id', courseId)
    .eq('employee_id', employeeId)
    .catch(() => {})
}

// ---------- Quiz engine ----------
export async function startQuizAttempt(employeeId, quizId) {
  const { count } = await supabase
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
    .eq('employee_id', employeeId)

  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert({ quiz_id: quizId, employee_id: employeeId, attempt_number: (count ?? 0) + 1 })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getQuizQuestions(quizId) {
  const { data, error } = await supabase.rpc('get_quiz_for_attempt', { p_quiz_id: quizId })
  if (error) throw error
  const map = new Map()
  for (const row of data || []) {
    if (!map.has(row.question_id)) {
      map.set(row.question_id, {
        id: row.question_id,
        text: row.question_text,
        type: row.question_type,
        points: row.points,
        answers: [],
      })
    }
    map.get(row.question_id).answers.push({ id: row.answer_id, text: row.answer_text })
  }
  return Array.from(map.values())
}

export async function submitQuizAttempt(attemptId, answers) {
  const { data, error } = await supabase.rpc('submit_quiz_attempt', {
    p_attempt_id: attemptId,
    p_answers: answers,
  })
  if (error) throw error
  return data ? data[0] : null
}

export async function issueCertificate(courseId) {
  const { data, error } = await supabase.rpc('issue_certificate', { p_course_id: courseId })
  if (error) throw error
  return data
}

// ---------- Admin: employees ----------
export async function listEmployees({ search = '', departmentId = '' } = {}) {
  let query = supabase.from('profiles').select('*')
  if (search) query = query.ilike('full_name', `%${search}%`)
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function updateEmployee(id, patch) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) throw error
}

export async function listDepartments() {
  const { data, error } = await supabase.from('departments').select('*')
  if (error) return []
  return data || []
}

export async function listJobTitles() {
  const { data, error } = await supabase.from('job_titles').select('*')
  if (error) return []
  return data || []
}

// ---------- Admin: courses ----------
export async function listAllCourses() {
  const { data, error } = await supabase.from('courses').select('*')
  if (error) throw error
  return data || []
}

export async function createCourse(payload) {
  const { data, error } = await supabase.from('courses').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateCourse(id, patch) {
  const { error } = await supabase.from('courses').update(patch).eq('id', id)
  if (error) throw error
}

export async function listCategories() {
  const { data, error } = await supabase.from('course_categories').select('*')
  if (error) return []
  return data || []
}

export async function listTrainers() {
  const { data, error } = await supabase.from('trainers').select('*')
  if (error) return []
  return data || []
}

export async function addModule(courseId, title, sortOrder) {
  const { data, error } = await supabase
    .from('modules') // التوجيه للجدول الجديد modules مباشرة
    .insert({ course_id: courseId, title, sort_order: sortOrder })
    .select()
    .single()
  if (error) {
    console.error('addModule error details:', error)
    alert('Failed to add module: ' + error.message)
    throw error
  }
  return data
}

export async function addLesson(moduleId, payload) {
  const { data, error } = await supabase
    .from('lessons')
    .insert({ module_id: moduleId, ...payload })
    .select()
    .single()
  if (error) {
    console.error('addLesson error details:', error)
    alert('Failed to add lesson: ' + error.message)
    throw error
  }
  return data
}

export async function addQuiz(courseId, payload) {
  const { data, error } = await supabase
    .from('quizzes')
    .insert({ course_id: courseId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addQuestion(quizId, payload) {
  const { data, error } = await supabase
    .from('quiz_questions')
    .insert({ quiz_id: quizId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addAnswers(questionId, answers) {
  const rows = answers.map((a, i) => ({ question_id: questionId, answer_text: a.text, is_correct: a.correct, sort_order: i }))
  const { error } = await supabase.from('quiz_answers').insert(rows)
  if (error) throw error
}

// ---------- Admin: assignments ----------
export async function assignCourse({ courseId, employeeIds, assignedBy, dueDate, mandatory }) {
  const rows = employeeIds.map((employee_id) => ({
    course_id: courseId,
    employee_id,
    assigned_by: assignedBy,
    due_date: dueDate || null,
    is_mandatory: mandatory,
  }))
  const { error } = await supabase.from('course_assignments').upsert(rows, { onConflict: 'course_id,employee_id', ignoreDuplicates: true })
  if (error) throw error
}

export async function listAssignments() {
  const { data, error } = await supabase.from('course_assignments').select('*')
  if (error) throw error
  return data || []
}
