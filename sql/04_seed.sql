-- ============================================================================
-- SEED DATA
-- IMPORTANT: run this AFTER you have created the demo auth users (see
-- README.md "Test accounts" section — either via the Supabase Dashboard
-- Authentication > Users > Add user, or the provided create-test-users
-- script). Each auth user creation fires handle_new_user() and creates a
-- matching `profiles` row automatically; this script then fills in the rest
-- (department, role, courses, etc.) by matching on email.
-- ============================================================================

-- ---------- Org structure ----------
insert into departments (name, description) values
  ('Manufacturing', 'Production and plant operations'),
  ('Quality Assurance', 'QA and compliance'),
  ('Human Resources', 'People and culture'),
  ('Information Technology', 'IT and systems'),
  ('Sales & Marketing', 'Commercial functions')
on conflict (name) do nothing;

insert into sections (department_id, name)
  select id, 'Line 1' from departments where name = 'Manufacturing'
  union all select id, 'Line 2' from departments where name = 'Manufacturing'
  union all select id, 'Compliance' from departments where name = 'Quality Assurance'
  union all select id, 'Recruiting' from departments where name = 'Human Resources'
  union all select id, 'Support' from departments where name = 'Information Technology'
on conflict do nothing;

insert into job_titles (title, grade) values
  ('Production Operator', 'G3'),
  ('QA Specialist', 'G5'),
  ('HR Coordinator', 'G4'),
  ('IT Support Engineer', 'G5'),
  ('Sales Executive', 'G4'),
  ('Plant Manager', 'G8'),
  ('L&D Administrator', 'G6')
on conflict (title) do nothing;

insert into course_categories (name) values
  ('Compliance'), ('Safety'), ('Technical Skills'), ('Soft Skills'), ('Onboarding')
on conflict (name) do nothing;

-- ---------- Link demo auth users to roles/departments ----------
-- Expects users with these emails to already exist in auth.users.
do $$
declare
  v_dept_mfg uuid; v_dept_qa uuid; v_dept_hr uuid; v_dept_it uuid; v_dept_sales uuid;
begin
  select id into v_dept_mfg from departments where name = 'Manufacturing';
  select id into v_dept_qa from departments where name = 'Quality Assurance';
  select id into v_dept_hr from departments where name = 'Human Resources';
  select id into v_dept_it from departments where name = 'Information Technology';
  select id into v_dept_sales from departments where name = 'Sales & Marketing';

  update profiles set role = 'super_admin', full_name = 'Amina Farouk', department_id = v_dept_it
    where email = 'admin@demo-lms.test';
  update profiles set role = 'hr_admin', full_name = 'Youssef Nabil', department_id = v_dept_hr
    where email = 'hr@demo-lms.test';
  update profiles set role = 'trainer', full_name = 'Dr. Salma Hassan', department_id = v_dept_qa
    where email = 'trainer1@demo-lms.test';
  update profiles set role = 'trainer', full_name = 'Karim Adel', department_id = v_dept_mfg
    where email = 'trainer2@demo-lms.test';
  update profiles set role = 'trainer', full_name = 'Nourhan Sayed', department_id = v_dept_it
    where email = 'trainer3@demo-lms.test';

  update profiles set role='employee', full_name='Mohamed Ali', department_id=v_dept_mfg where email='emp1@demo-lms.test';
  update profiles set role='employee', full_name='Fatma Zahra', department_id=v_dept_mfg where email='emp2@demo-lms.test';
  update profiles set role='employee', full_name='Ahmed Samir', department_id=v_dept_qa where email='emp3@demo-lms.test';
  update profiles set role='employee', full_name='Mariam Tarek', department_id=v_dept_qa where email='emp4@demo-lms.test';
  update profiles set role='employee', full_name='Omar Khaled', department_id=v_dept_hr where email='emp5@demo-lms.test';
  update profiles set role='employee', full_name='Hana Gamal', department_id=v_dept_hr where email='emp6@demo-lms.test';
  update profiles set role='employee', full_name='Tamer Fathy', department_id=v_dept_it where email='emp7@demo-lms.test';
  update profiles set role='employee', full_name='Dina Mostafa', department_id=v_dept_it where email='emp8@demo-lms.test';
  update profiles set role='employee', full_name='Sherif Adly', department_id=v_dept_sales where email='emp9@demo-lms.test';
  update profiles set role='employee', full_name='Yasmin Ezz', department_id=v_dept_sales where email='emp10@demo-lms.test';
end $$;

insert into trainers (profile_id, bio, specialty)
  select id, 'QA & compliance trainer with 10+ years in GMP environments.', 'Compliance'
  from profiles where email = 'trainer1@demo-lms.test'
  on conflict do nothing;
insert into trainers (profile_id, bio, specialty)
  select id, 'Manufacturing safety and operations trainer.', 'Safety'
  from profiles where email = 'trainer2@demo-lms.test'
  on conflict do nothing;
insert into trainers (profile_id, bio, specialty)
  select id, 'IT systems and security awareness trainer.', 'Technical Skills'
  from profiles where email = 'trainer3@demo-lms.test'
  on conflict do nothing;

-- ---------- Courses ----------
do $$
declare
  v_admin uuid; v_cat_compliance uuid; v_cat_safety uuid; v_cat_tech uuid; v_cat_soft uuid; v_cat_onboard uuid;
  v_trainer_qa uuid; v_trainer_mfg uuid; v_trainer_it uuid;
  v_course uuid; v_module uuid; v_lesson uuid; v_quiz uuid; v_q uuid;
begin
  select id into v_admin from profiles where email = 'admin@demo-lms.test';
  select id into v_cat_compliance from course_categories where name = 'Compliance';
  select id into v_cat_safety from course_categories where name = 'Safety';
  select id into v_cat_tech from course_categories where name = 'Technical Skills';
  select id into v_cat_soft from course_categories where name = 'Soft Skills';
  select id into v_cat_onboard from course_categories where name = 'Onboarding';
  select id into v_trainer_qa from trainers t join profiles p on p.id = t.profile_id where p.email = 'trainer1@demo-lms.test';
  select id into v_trainer_mfg from trainers t join profiles p on p.id = t.profile_id where p.email = 'trainer2@demo-lms.test';
  select id into v_trainer_it from trainers t join profiles p on p.id = t.profile_id where p.email = 'trainer3@demo-lms.test';

  -- Course 1: Good Manufacturing Practices (fully built out, matches the spec's example)
  insert into courses (course_code, name, description, category_id, training_type, trainer_id,
                        duration_minutes, difficulty, status, publish_date, passing_score,
                        certificate_eligible, is_required, created_by)
  values ('CRS-0001', 'Good Manufacturing Practices', 'Core GMP training covering basics, principles, documentation and deviation handling.',
          v_cat_compliance, 'e_learning', v_trainer_qa, 90, 'beginner', 'published', current_date - 30, 80, true, true, v_admin)
  returning id into v_course;

  insert into course_modules (course_id, title, sort_order) values (v_course, 'Introduction', 1) returning id into v_module;
  insert into lessons (module_id, title, content_type, body, duration_minutes, sort_order)
    values (v_module, 'GMP Basics', 'text', 'Good Manufacturing Practice (GMP) ensures products are consistently produced and controlled to quality standards. This lesson covers the core definitions and why GMP matters.', 15, 1) returning id into v_lesson;
  insert into lessons (module_id, title, content_type, body, duration_minutes, sort_order)
    values (v_module, 'GMP Principles', 'text', 'The ten core GMP principles: write procedures, follow procedures, document work, validate, design for quality, maintain equipment, ensure competence, protect from contamination, build quality in, and audit regularly.', 20, 2);

  insert into course_modules (course_id, title, sort_order) values (v_course, 'Practical Application', 2) returning id into v_module;
  insert into lessons (module_id, title, content_type, body, duration_minutes, sort_order)
    values (v_module, 'Documentation', 'text', 'Accurate, contemporaneous documentation is a regulatory requirement. This lesson covers batch records, logbooks and the ALCOA+ principle.', 20, 1);
  insert into lessons (module_id, title, content_type, body, duration_minutes, sort_order)
    values (v_module, 'Deviation Management', 'text', 'How to identify, report, and investigate deviations from standard procedure, and the CAPA process that follows.', 20, 2);

  insert into quizzes (course_id, title, max_attempts, passing_score) values (v_course, 'GMP Final Quiz', 3, 80) returning id into v_quiz;
  insert into quiz_questions (quiz_id, question_text, question_type, explanation, points, sort_order)
    values (v_quiz, 'GMP stands for Good Manufacturing Practice.', 'true_false', 'Correct — GMP is the standard for consistent quality production.', 1, 1) returning id into v_q;
  insert into quiz_answers (question_id, answer_text, is_correct, sort_order) values (v_q, 'True', true, 1), (v_q, 'False', false, 2);

  insert into quiz_questions (quiz_id, question_text, question_type, explanation, points, sort_order)
    values (v_quiz, 'Which of the following is a core GMP principle?', 'multiple_choice', 'Documenting work is one of the ten core GMP principles.', 1, 2) returning id into v_q;
  insert into quiz_answers (question_id, answer_text, is_correct, sort_order) values
    (v_q, 'Document your work', true, 1), (v_q, 'Skip steps when busy', false, 2), (v_q, 'Ignore deviations', false, 3);

  insert into quiz_questions (quiz_id, question_text, question_type, explanation, points, sort_order)
    values (v_quiz, 'Select all elements of the ALCOA+ principle.', 'multiple_answer', 'ALCOA+ = Attributable, Legible, Contemporaneous, Original, Accurate (+ Complete, Consistent, Enduring, Available).', 2, 3) returning id into v_q;
  insert into quiz_answers (question_id, answer_text, is_correct, sort_order) values
    (v_q, 'Attributable', true, 1), (v_q, 'Legible', true, 2), (v_q, 'Anonymous', false, 3), (v_q, 'Original', true, 4);

  -- Course 2: Workplace Safety Fundamentals
  insert into courses (course_code, name, description, category_id, training_type, trainer_id,
                        duration_minutes, difficulty, status, publish_date, passing_score, certificate_eligible, is_required, created_by)
  values ('CRS-0002', 'Workplace Safety Fundamentals', 'PPE, hazard identification, and emergency procedures for plant staff.',
          v_cat_safety, 'video', v_trainer_mfg, 60, 'beginner', 'published', current_date - 60, 75, true, true, v_admin)
  returning id into v_course;
  insert into course_modules (course_id, title, sort_order) values (v_course, 'Core Safety', 1) returning id into v_module;
  insert into lessons (module_id, title, content_type, body, duration_minutes, sort_order)
    values (v_module, 'PPE Requirements', 'text', 'Overview of required personal protective equipment by work area.', 15, 1);
  insert into lessons (module_id, title, content_type, body, duration_minutes, sort_order)
    values (v_module, 'Emergency Procedures', 'text', 'Evacuation routes, assembly points, and incident reporting.', 15, 2);
  insert into quizzes (course_id, title, passing_score) values (v_course, 'Safety Quiz', 75) returning id into v_quiz;
  insert into quiz_questions (quiz_id, question_text, question_type, points, sort_order)
    values (v_quiz, 'Safety glasses are required in all production areas.', 'true_false', 1, 1) returning id into v_q;
  insert into quiz_answers (question_id, answer_text, is_correct, sort_order) values (v_q, 'True', true, 1), (v_q, 'False', false, 2);

  -- Courses 3–10: lighter-weight catalog entries so the catalog and matrix have breadth
  insert into courses (course_code, name, description, category_id, training_type, trainer_id, duration_minutes, difficulty, status, publish_date, passing_score, certificate_eligible, is_required, created_by) values
    ('CRS-0003', 'Information Security Awareness', 'Phishing, password hygiene and data handling.', v_cat_tech, 'online', v_trainer_it, 45, 'beginner', 'published', current_date - 20, 80, true, true, v_admin),
    ('CRS-0004', 'New Employee Onboarding', 'Company policies, benefits, and culture.', v_cat_onboard, 'blended', v_trainer_qa, 120, 'beginner', 'published', current_date - 90, 70, true, true, v_admin),
    ('CRS-0005', 'Effective Communication Skills', 'Workplace communication and feedback.', v_cat_soft, 'workshop', v_trainer_mfg, 90, 'intermediate', 'published', current_date - 15, 70, false, false, v_admin),
    ('CRS-0006', 'Deviation & CAPA Deep Dive', 'Advanced root-cause analysis for QA staff.', v_cat_compliance, 'e_learning', v_trainer_qa, 75, 'advanced', 'published', current_date - 10, 85, true, false, v_admin),
    ('CRS-0007', 'Fire Safety & Evacuation', 'Annual mandatory fire safety refresher.', v_cat_safety, 'classroom', v_trainer_mfg, 45, 'beginner', 'published', current_date - 5, 75, true, true, v_admin),
    ('CRS-0008', 'Excel for Reporting', 'Practical spreadsheet skills for reporting.', v_cat_tech, 'online', v_trainer_it, 60, 'intermediate', 'published', current_date - 40, 70, false, false, v_admin),
    ('CRS-0009', 'Leadership Essentials', 'First-time manager fundamentals.', v_cat_soft, 'webinar', v_trainer_mfg, 90, 'intermediate', 'draft', null, 70, true, false, v_admin),
    ('CRS-0010', 'Data Privacy & GDPR Basics', 'Handling personal data responsibly.', v_cat_compliance, 'external', v_trainer_it, 30, 'beginner', 'published', current_date - 25, 80, true, true, v_admin);
end $$;

-- ---------- Assignments (assign all published, required courses to all employees) ----------
insert into course_assignments (course_id, employee_id, assigned_by, assigned_date, due_date, is_mandatory, status)
select c.id, p.id,
       (select id from profiles where email = 'hr@demo-lms.test'),
       current_date - 20, current_date + 20, true, 'assigned'
from courses c
cross join profiles p
where c.is_required = true and c.status = 'published' and p.role = 'employee'
on conflict (course_id, employee_id) do nothing;

-- Mark one course as completed with a certificate for the first two employees, to seed realistic demo state
do $$
declare
  v_course uuid; v_emp record; v_progress_id uuid; v_quiz uuid; v_attempt uuid;
begin
  select id into v_course from courses where course_code = 'CRS-0001';
  select id into v_quiz from quizzes where course_id = v_course;

  for v_emp in select id from profiles where email in ('emp1@demo-lms.test','emp2@demo-lms.test') loop
    update course_assignments set status = 'completed' where course_id = v_course and employee_id = v_emp.id;

    insert into course_progress (course_id, employee_id, started_at, last_accessed_at, completed_at, progress_percent, time_spent_seconds)
    values (v_course, v_emp.id, now() - interval '10 days', now() - interval '1 days', now() - interval '1 days', 100, 5400)
    on conflict (course_id, employee_id) do update set progress_percent = 100, completed_at = now() - interval '1 days';

    insert into quiz_attempts (quiz_id, employee_id, started_at, submitted_at, score_points, total_points, percentage, passed, attempt_number)
    values (v_quiz, v_emp.id, now() - interval '2 days', now() - interval '2 days', 4, 4, 100.00, true, 1)
    returning id into v_attempt;

    insert into certificates (cert_number, course_id, employee_id, final_score, trainer_name, issued_date)
    values ('CERT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('certificate_seq')::text, 6, '0'),
            v_course, v_emp.id, 100.00, 'Dr. Salma Hassan', current_date - 1)
    on conflict do nothing;
  end loop;
end $$;

-- ---------- Notifications ----------
insert into notifications (employee_id, type, title, body, related_course_id)
select p.id, 'course_assigned', 'New course assigned',
       'You have been assigned "Good Manufacturing Practices". Due in 20 days.',
       (select p.id courses where course_code = 'CRS-0001')
from profiles p where p.role = 'employee'
limit 10;
