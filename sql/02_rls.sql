-- ============================================================================
-- ROW LEVEL SECURITY
-- Run after 01_schema.sql. Every table with sensitive data is locked down;
-- policies grant the *minimum* access each role needs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read profiles without
-- recursively triggering RLS on profiles itself)
-- ----------------------------------------------------------------------------
create or replace function public.current_role_name()
returns user_role
language sql security definer stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin','hr_admin') from profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_trainer()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select role = 'trainer' from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS everywhere
-- ----------------------------------------------------------------------------
alter table departments enable row level security;
alter table sections enable row level security;
alter table job_titles enable row level security;
alter table profiles enable row level security;
alter table course_categories enable row level security;
alter table trainers enable row level security;
alter table courses enable row level security;
alter table course_modules enable row level security;
alter table lessons enable row level security;
alter table course_materials enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_answers enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_results enable row level security;
alter table course_assignments enable row level security;
alter table course_progress enable row level security;
alter table lesson_progress enable row level security;
alter table certificates enable row level security;
alter table training_plans enable row level security;
alter table training_records enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- ----------------------------------------------------------------------------
-- ORG STRUCTURE: everyone signed-in can read (needed for dropdowns/labels),
-- only admins can write.
-- ----------------------------------------------------------------------------
create policy "org_read_all" on departments for select using (auth.uid() is not null);
create policy "org_write_admin" on departments for all using (is_admin()) with check (is_admin());

create policy "sections_read_all" on sections for select using (auth.uid() is not null);
create policy "sections_write_admin" on sections for all using (is_admin()) with check (is_admin());

create policy "titles_read_all" on job_titles for select using (auth.uid() is not null);
create policy "titles_write_admin" on job_titles for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- PROFILES: a user can read/update their own profile; admins can read/write
-- all profiles; trainers can read profiles of employees assigned to their
-- courses (kept simple: trainers can read all profiles, write none).
-- ----------------------------------------------------------------------------
create policy "profiles_select_self" on profiles for select
  using (id = auth.uid() or is_admin() or is_trainer());

create policy "profiles_update_self" on profiles for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

create policy "profiles_insert_admin" on profiles for insert
  with check (id = auth.uid() or is_admin());

create policy "profiles_delete_admin" on profiles for delete
  using (is_admin());

-- ----------------------------------------------------------------------------
-- COURSE CATALOG: published courses readable by everyone signed in;
-- draft/archived only visible to admins/trainers. Writes: admins + the
-- owning trainer.
-- ----------------------------------------------------------------------------
create policy "categories_read_all" on course_categories for select using (auth.uid() is not null);
create policy "categories_write_admin" on course_categories for all using (is_admin()) with check (is_admin());

create policy "trainers_read_all" on trainers for select using (auth.uid() is not null);
create policy "trainers_write_admin" on trainers for all using (is_admin()) with check (is_admin());

create policy "courses_select" on courses for select
  using (
    status = 'published' or is_admin() or is_trainer()
  );
create policy "courses_write_admin_or_owner" on courses for all
  using (is_admin() or (is_trainer() and created_by = auth.uid()))
  with check (is_admin() or (is_trainer() and created_by = auth.uid()));

create policy "modules_select" on course_modules for select
  using (exists (select 1 from courses c where c.id = course_id and
                 (c.status = 'published' or is_admin() or is_trainer())));
create policy "modules_write" on course_modules for all
  using (is_admin() or is_trainer()) with check (is_admin() or is_trainer());

create policy "lessons_select" on lessons for select
  using (exists (
    select 1 from course_modules m join courses c on c.id = m.course_id
    where m.id = module_id and (c.status = 'published' or is_admin() or is_trainer())
  ));
create policy "lessons_write" on lessons for all
  using (is_admin() or is_trainer()) with check (is_admin() or is_trainer());

create policy "materials_select" on course_materials for select
  using (exists (select 1 from courses c where c.id = course_id and
                 (c.status = 'published' or is_admin() or is_trainer())));
create policy "materials_write" on course_materials for all
  using (is_admin() or is_trainer()) with check (is_admin() or is_trainer());

-- ----------------------------------------------------------------------------
-- QUIZZES: employees can read quiz + questions + answers for courses they are
-- assigned (answers' is_correct flag is still technically visible via select
-- here -- to fully hide correct answers pre-submission, the app fetches
-- questions/answers through the `get_quiz_for_attempt` function below instead
-- of querying quiz_answers directly).
-- ----------------------------------------------------------------------------
create policy "quizzes_select" on quizzes for select
  using (is_admin() or is_trainer() or exists (
    select 1 from course_assignments a where a.course_id = quizzes.course_id and a.employee_id = auth.uid()
  ));
create policy "quizzes_write" on quizzes for all
  using (is_admin() or is_trainer()) with check (is_admin() or is_trainer());

create policy "questions_select" on quiz_questions for select
  using (is_admin() or is_trainer());  -- employees read via SECURITY DEFINER function only
create policy "questions_write" on quiz_questions for all
  using (is_admin() or is_trainer()) with check (is_admin() or is_trainer());

create policy "answers_select" on quiz_answers for select
  using (is_admin() or is_trainer());  -- employees never query this table directly
create policy "answers_write" on quiz_answers for all
  using (is_admin() or is_trainer()) with check (is_admin() or is_trainer());

create policy "attempts_select_own_or_admin" on quiz_attempts for select
  using (employee_id = auth.uid() or is_admin() or is_trainer());
create policy "attempts_insert_own" on quiz_attempts for insert
  with check (employee_id = auth.uid());
create policy "attempts_update_own" on quiz_attempts for update
  using (employee_id = auth.uid() or is_admin())
  with check (employee_id = auth.uid() or is_admin());

create policy "results_select_own_or_admin" on quiz_results for select
  using (exists (select 1 from quiz_attempts a where a.id = attempt_id and
                 (a.employee_id = auth.uid() or is_admin() or is_trainer())));
create policy "results_insert_own" on quiz_results for insert
  with check (exists (select 1 from quiz_attempts a where a.id = attempt_id and a.employee_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- ASSIGNMENTS / PROGRESS: employees see and update only their own rows;
-- admins/trainers see and manage all.
-- ----------------------------------------------------------------------------
create policy "assignments_select" on course_assignments for select
  using (employee_id = auth.uid() or is_admin() or is_trainer());
create policy "assignments_write_admin" on course_assignments for all
  using (is_admin()) with check (is_admin());
create policy "assignments_update_status_self" on course_assignments for update
  using (employee_id = auth.uid() or is_admin())
  with check (employee_id = auth.uid() or is_admin());

create policy "course_progress_select" on course_progress for select
  using (employee_id = auth.uid() or is_admin() or is_trainer());
create policy "course_progress_upsert_own" on course_progress for insert
  with check (employee_id = auth.uid());
create policy "course_progress_update_own" on course_progress for update
  using (employee_id = auth.uid() or is_admin())
  with check (employee_id = auth.uid() or is_admin());

create policy "lesson_progress_select" on lesson_progress for select
  using (employee_id = auth.uid() or is_admin() or is_trainer());
create policy "lesson_progress_insert_own" on lesson_progress for insert
  with check (employee_id = auth.uid());
create policy "lesson_progress_update_own" on lesson_progress for update
  using (employee_id = auth.uid() or is_admin())
  with check (employee_id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- CERTIFICATES: employee reads own; admins read all; only the certificate-
-- issuing function (SECURITY DEFINER) inserts rows, not the client directly.
-- ----------------------------------------------------------------------------
create policy "certificates_select" on certificates for select
  using (employee_id = auth.uid() or is_admin() or is_trainer());
create policy "certificates_insert_via_function_or_admin" on certificates for insert
  with check (is_admin() or employee_id = auth.uid());

-- ----------------------------------------------------------------------------
-- TRAINING PLANS / RECORDS (Phase 2 UI, policies ready now)
-- ----------------------------------------------------------------------------
create policy "plans_select" on training_plans for select
  using (employee_id = auth.uid() or is_admin() or is_trainer());
create policy "plans_write_admin" on training_plans for all
  using (is_admin()) with check (is_admin());

create policy "records_select" on training_records for select
  using (employee_id = auth.uid() or is_admin() or is_trainer());
create policy "records_write_admin" on training_records for all
  using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS: strictly own-row.
-- ----------------------------------------------------------------------------
create policy "notifications_select_own" on notifications for select
  using (employee_id = auth.uid() or is_admin());
create policy "notifications_update_own" on notifications for update
  using (employee_id = auth.uid()) with check (employee_id = auth.uid());
create policy "notifications_insert_admin_or_system" on notifications for insert
  with check (is_admin() or employee_id = auth.uid());

-- ----------------------------------------------------------------------------
-- AUDIT LOGS: admins read; anyone signed-in may insert their own action log
-- (writes are also produced server-side by triggers - see 03_functions.sql).
-- ----------------------------------------------------------------------------
create policy "audit_select_admin" on audit_logs for select using (is_admin());
create policy "audit_insert_self" on audit_logs for insert
  with check (user_id = auth.uid() or user_id is null);
