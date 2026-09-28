import { supabase } from './supabaseClient'

// ---------- Employee: assignments & progress ----------
export async function getMyAssignments(employeeId) {
  try {
    // 1. جلب التعيينات الخاصة بالمستخدم
    const { data: assignments, error } = await supabase
      .from('course_assignments')
      .select('*')
      .eq('employee_id', employeeId)

    if (error) throw error

    // 2. جلب التقدم الخاص بالمستخدم لضمان ظهور الكورسات التي بدأها من الكتالوج حتى لو لم تُعنَ له
    const { data: progressList } = await supabase
      .from('course_progress')
      .select('*')
      .eq('employee_id', employeeId)

    const assignedMap = new Map((assignments || []).map(a => [a.course_id, a]))
    const allCourseIdsSet = new Set([
      ...(assignments || []).map(a => a.course_id),
      ...(progressList || []).map(p => p.course_id)
    ])

    if (allCourseIdsSet.size === 0) return []

    // جلب جميع الكورسات دفعة واحدة لتفادي أي أخطاء في علاقات الـ Foreign Key وإظهار الأسماء الحقيقية
    const { data: courses } = await supabase.from('courses').select('id, name, duration')
    const courseMap = (courses || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {})

    // دمج التعيينات والتقدم معاً في قائمة موحدة للموظف
    const combinedList = Array.from(allCourseIdsSet).map(courseId => {
      const existingAssignment = assignedMap.get(courseId)
      const prog = (progressList || []).find(p => p.course_id === courseId)

      if (existingAssignment) {
        return {
          ...existingAssignment,
          course: courseMap[courseId] || { name: 'Unknown Course' }
        }
      } else {
        // إنشاء عنصر افتراضي للكورس الذي بدأه الموظف من الكتالوج ولم يُعنَ له مسبقاً
        const isCompleted = prog && prog.progress_percent >= 100
        return {
          id: `prog-${courseId}`,
          course_id: courseId,
          employee_id: employeeId,
          status: isCompleted ? 'completed' : (prog ? 'in_progress' : 'assigned'),
          is_mandatory: false,
          due_date: null,
          course: courseMap[courseId] || { name: 'Unknown Course' }
        }
      }
    })

    return combinedList
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
    const { data: certs, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('employee_id', employeeId)

    if (error) throw error
    if (!certs || certs.length === 0) return []

    // جلب جميع الكورسات لربط الأسماء الحقيقية بضمان 100%
    const { data: courses } = await supabase.from('courses').select('id, name')
    const courseMap = (courses || []).reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {})

    return certs.map(c => ({
      ...c,
      course_name: c.course_name || courseMap[c.course_id] || 'HSE'
    }))
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
export async function getPublishedCourses(employeeId) {
  try {
    let userDeptId = null;
    if (employeeId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', employeeId)
        .maybeSingle();
      
      userDeptId = profile?.department_id;
    }

    let query = supabase
      .from('courses')
      .select('*')
      .eq('status', 'published');

    if (userDeptId) {
      query = query.or(`department_id.eq.${userDeptId},department_id.is.null`);
    } else {
      query = query.is('department_id', null);
    }

    const { data, error } = await query;

    if (error) {
      const { data: allCourses } = await supabase.from('courses').select('*');
      return allCourses || [];
    }
    return data || [];
  } catch (err) {
    console.error('getPublishedCourses error:', err);
    return [];
  }
}

export async function getCourseWithStructure(courseId) {
  try {
    // 1. جلب بيانات الكورس الأساسية
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()

    if (courseError) throw courseError

    // 2. جلب المديولات الخاصة بالكورس يدوياً وبشكل منفصل لتفادي أخطاء الـ Schema Cache
    const { data: modules, error: modError } = await supabase
      .from('modules')
      .select('*')
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true })

    if (modError) throw modError

    // 3. جلب الدروس والاختبارات لكل مديول على حدة
    const modulesWithDetails = await Promise.all(
      (modules || []).map(async (mod) => {
        // جلب الدروس
        const { data: lessons } = await supabase
          .from('lessons')
          .select('*')
          .eq('module_id', mod.id)

        // جلب الاختبارات والأسئلة التابعة لها
        const { data: quizzes } = await supabase
          .from('quizzes')
          .select(`
            *,
            questions:quiz_questions (*)
          `)
          .eq('module_id', mod.id)

        return {
          ...mod,
          lessons: lessons || [],
          quizzes: quizzes || []
        }
      })
    )

    return {
      course,
      modules: modulesWithDetails
    }
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
  
  try {
    const { data: existing } = await supabase
      .from('course_assignments')
      .select('id')
      .eq('course_id', courseId)
      .eq('employee_id', employeeId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('course_assignments')
        .update({ status })
        .eq('course_id', courseId)
        .eq('employee_id', employeeId)
    } else {
      await supabase
        .from('course_assignments')
        .insert({
          course_id: courseId,
          employee_id: employeeId,
          status: status,
          is_mandatory: false
        })
    }
  } catch (err) {
    console.warn('Assignment status update/insert warning:', err)
  }
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
  try {
    const { data: qData, error: qError } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)

    if (qError || !qData) return []

    const questionIds = qData.map(q => q.id)
    const { data: aData } = await supabase
      .from('quiz_answers')
      .select('*')
      .in('question_id', questionIds)

    const answersList = aData || []

    return qData.map(q => ({
      id: q.id,
      text: q.text || q.question_text,
      type: q.type || q.question_type || 'multiple_choice',
      points: q.points || 1,
      correct_answer_text: q.correct_answer_text || '',
      answers: answersList
        .filter(a => a.question_id === q.id)
        .map(a => ({ 
          id: a.id, 
          text: a.answer_text || a.text,
          is_correct: a.is_correct 
        }))
    }))
  } catch (err) {
    console.error('getQuizQuestions error:', err)
    return []
  }
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
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,employee_id.eq.${search}`)
  }
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
    .from('modules')
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
  try {
    const { data, error } = await supabase
      .from('course_assignments')
      .select('*, course:courses(name), employee:profiles!inner(full_name, email)')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('listAssignments error:', err)
    return []
  }
}
