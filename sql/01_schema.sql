-- ============================================================================
-- LMS DATABASE SCHEMA
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run: uses IF NOT EXISTS / DROP ... IF EXISTS guards.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('super_admin', 'hr_admin', 'trainer', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_status as enum ('active', 'on_leave', 'suspended', 'terminated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type training_type as enum
    ('classroom','online','video','e_learning','workshop','external','webinar','blended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type difficulty_level as enum ('beginner','intermediate','advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type course_status as enum ('draft','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type material_type as enum ('video','pdf','pptx','docx','image','text','external_video','external_url');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_status as enum ('assigned','started','in_progress','completed','overdue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_type as enum ('multiple_choice','true_false','multiple_answer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_status as enum ('planned','in_progress','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum
    ('course_assigned','due_soon','overdue','course_completed','certificate_available','quiz_result');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- ORG STRUCTURE
-- ----------------------------------------------------------------------------
create table if not exists departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists sections (
  id uuid primary key default uuid_generate_v4(),
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (department_id, name)
);

create table if not exists job_titles (
  id uuid primary key default uuid_generate_v4(),
  title text not null unique,
  grade text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- USERS / PROFILES  (1:1 extension of auth.users — never store passwords here)
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_code text unique,                     -- e.g. EMP-0001
  full_name text not null,
  email text not null,
  phone text,
  role user_role not null default 'employee',
  department_id uuid references departments(id),
  section_id uuid references sections(id),
  job_title_id uuid references job_titles(id),
  manager_id uuid references profiles(id),
  hire_date date,
  employment_status employment_status not null default 'active',
  location text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_department on profiles(department_id);
create index if not exists idx_profiles_manager on profiles(manager_id);
create index if not exists idx_profiles_role on profiles(role);

-- ----------------------------------------------------------------------------
-- COURSES
-- ----------------------------------------------------------------------------
create table if not exists course_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists trainers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid unique references profiles(id) on delete cascade,
  bio text,
  specialty text,
  created_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid primary key default uuid_generate_v4(),
  course_code text unique,                          -- e.g. CRS-0001
  name text not null,
  description text,
  category_id uuid references course_categories(id),
  training_type training_type not null default 'online',
  trainer_id uuid references trainers(id),
  duration_minutes integer not null default 0,
  difficulty difficulty_level not null default 'beginner',
  thumbnail_url text,
  status course_status not null default 'draft',
  publish_date date,
  expiry_date date,
  passing_score integer not null default 80,          -- percent
  certificate_eligible boolean not null default true,
  is_required boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_courses_status on courses(status);
create index if not exists idx_courses_category on courses(category_id);

create table if not exists course_modules (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_modules_course on course_modules(course_id);

create table if not exists lessons (
  id uuid primary key default uuid_generate_v4(),
  module_id uuid not null references course_modules(id) on delete cascade,
  title text not null,
  content_type material_type not null default 'text',
  body text,                       -- text-lesson content / external URL for links
  video_url text,
  duration_minutes integer default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_lessons_module on lessons(module_id);

create table if not exists course_materials (
  id uuid primary key default uuid_generate_v4(),
  lesson_id uuid references lessons(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  material_type material_type not null,
  storage_path text,               -- Supabase Storage object path
  external_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_materials_course on course_materials(course_id);

-- ----------------------------------------------------------------------------
-- QUIZZES
-- ----------------------------------------------------------------------------
create table if not exists quizzes (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null default 'Final Quiz',
  time_limit_minutes integer,
  max_attempts integer not null default 3,
  passing_score integer not null default 80,
  randomize_questions boolean not null default true,
  randomize_answers boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_quizzes_course on quizzes(course_id);

create table if not exists quiz_questions (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_text text not null,
  question_type question_type not null default 'multiple_choice',
  explanation text,
  points integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_questions_quiz on quiz_questions(quiz_id);

create table if not exists quiz_answers (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references quiz_questions(id) on delete cascade,
  answer_text text not null,
  is_correct boolean not null default false,
  sort_order integer not null default 0
);
create index if not exists idx_answers_question on quiz_answers(question_id);

create table if not exists quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  employee_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score_points integer,
  total_points integer,
  percentage numeric(5,2),
  passed boolean,
  attempt_number integer not null default 1
);
create index if not exists idx_attempts_quiz_employee on quiz_attempts(quiz_id, employee_id);

create table if not exists quiz_results (
  id uuid primary key default uuid_generate_v4(),
  attempt_id uuid not null references quiz_attempts(id) on delete cascade,
  question_id uuid not null references quiz_questions(id) on delete cascade,
  selected_answer_ids uuid[] not null default '{}',
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_results_attempt on quiz_results(attempt_id);

-- ----------------------------------------------------------------------------
-- ASSIGNMENTS / PROGRESS
-- ----------------------------------------------------------------------------
create table if not exists course_assignments (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  employee_id uuid not null references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id),
  assigned_date date not null default current_date,
  due_date date,
  is_mandatory boolean not null default true,
  status assignment_status not null default 'assigned',
  created_at timestamptz not null default now(),
  unique (course_id, employee_id)
);
create index if not exists idx_assignments_employee on course_assignments(employee_id);
create index if not exists idx_assignments_course on course_assignments(course_id);
create index if not exists idx_assignments_status on course_assignments(status);

create table if not exists course_progress (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  employee_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz,
  last_accessed_at timestamptz,
  completed_at timestamptz,
  progress_percent integer not null default 0,
  time_spent_seconds integer not null default 0,
  unique (course_id, employee_id)
);
create index if not exists idx_course_progress_employee on course_progress(employee_id);

create table if not exists lesson_progress (
  id uuid primary key default uuid_generate_v4(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  employee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'not_started', -- not_started | in_progress | completed
  completed_at timestamptz,
  time_spent_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (lesson_id, employee_id)
);
create index if not exists idx_lesson_progress_employee on lesson_progress(employee_id);

-- ----------------------------------------------------------------------------
-- CERTIFICATES
-- ----------------------------------------------------------------------------
create table if not exists certificates (
  id uuid primary key default uuid_generate_v4(),
  cert_number text unique not null,        -- e.g. CERT-2026-000125
  course_id uuid not null references courses(id),
  employee_id uuid not null references profiles(id),
  issued_date date not null default current_date,
  final_score numeric(5,2),
  trainer_name text,
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  unique (course_id, employee_id)          -- one certificate per employee per course
);
create index if not exists idx_certificates_employee on certificates(employee_id);

-- ----------------------------------------------------------------------------
-- TRAINING PLANS (Phase 2 UI, schema ready now)
-- ----------------------------------------------------------------------------
create table if not exists training_plans (
  id uuid primary key default uuid_generate_v4(),
  year integer not null,
  department_id uuid references departments(id),
  job_title_id uuid references job_titles(id),
  employee_id uuid references profiles(id),
  training_need text,
  course_id uuid references courses(id),
  priority text default 'medium',
  planned_date date,
  actual_date date,
  status plan_status not null default 'planned',
  training_hours numeric(6,2),
  trainer_id uuid references trainers(id),
  evaluation text,
  score numeric(5,2),
  created_at timestamptz not null default now()
);
create index if not exists idx_training_plans_employee on training_plans(employee_id);

create table if not exists training_records (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references profiles(id) on delete cascade,
  course_id uuid references courses(id),
  training_hours numeric(6,2) not null default 0,
  record_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_training_records_employee on training_records(employee_id);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS / AUDIT
-- ----------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  related_course_id uuid references courses(id),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_employee on notifications(employee_id, is_read);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_user on audit_logs(user_id);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);
