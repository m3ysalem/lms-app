# LMS Architecture — Phase 1 (MVP)

## Stack
- **Frontend:** React 18 + Vite + Tailwind CSS, React Router, `@supabase/supabase-js`
- **Backend:** Supabase (Postgres + Auth + Storage + RLS). No custom server — the frontend talks to Postgres directly through RLS-protected queries, which is the correct Supabase pattern (not a "fake backend": every read/write is authorized by the database itself, not by client-side trust).
- **Hosting:** Static build deployed to Cloudflare Pages (Workers is unnecessary for a pure SPA + Supabase backend — Pages is the free, correct target; documented in DEPLOYMENT.md).
- **PDF certificates:** generated client-side with `pdf-lib` from a template, then optionally uploaded to Supabase Storage.

## Why this shape
Supabase *is* the backend. RLS policies are the authorization layer — every table's row-level policy is what actually stops an employee from reading another employee's records, not a hidden Express server. This is the standard, production-correct way to build with Supabase and it's what lets you deploy for free (Cloudflare Pages + Supabase free tier).

## Roles
Roles live in `public.profiles.role`, constrained to `super_admin | hr_admin | trainer | employee`. Supabase Auth (`auth.users`) handles credentials; `profiles` is a 1:1 extension table keyed on `auth.users.id`, created automatically by a `handle_new_user` trigger. **Passwords are never stored in application tables** — Supabase Auth handles hashing/storage entirely.

## Phase 1 scope (this delivery)
Fully wired, real Supabase reads/writes, no mock data in the app:
- Auth (login, session, role-based routing/guards)
- Employee: dashboard, course catalog, course player (modules → lessons → materials), lesson completion + progress tracking, quiz engine (attempts, scoring, pass/fail), certificate generation (PDF) on passing a certificate-eligible course, "My Certificates", personal training history
- Admin (HR/L&D + Super Admin): employee CRUD, department CRUD, course/module/lesson/material CRUD, quiz + question builder, course assignment (single/bulk/by department)
- Full DB schema + RLS for **every** table in the original spec (so Phase 2 doesn't require migrations) — see `sql/01_schema.sql` and `sql/02_rls.sql`
- Seed data: 5 departments, 10 employees, 3 trainers, 10 courses (with modules/lessons/quizzes), assignments, a couple of completed courses with certificates

## Explicitly Phase 2 (not built yet, schema is ready for it)
- HR/Admin analytics dashboards & KPI charts
- Training Matrix grid view
- Training Plans module UI
- Full report exports (CSV done for core tables in Phase 1; PDF reports, department/overdue/hours reports)
- Notification center UI + due-date/overdue scheduled triggers (needs a Supabase Edge Function on a cron schedule — documented, not deployed live from here)
- Audit log viewer UI (the `audit_logs` table + trigger-based logging **is** included in Phase 1 so history isn't lost while you wait for the UI)
- CSV bulk import UI (schema/table ready; a documented SQL-based import path is provided as an interim)

## Data flow (course completion → certificate)
```
employee completes last lesson
        │
        ▼
lesson_progress row upserted (status=completed)
        │
        ▼
frontend recomputes course_progress % from lesson_progress
        │
        ▼
employee takes quiz → quiz_attempts row inserted, scored client-side
        │  (score also re-validated by a Postgres function so a client
        │   can't fake a passing score)
        ▼
if passed AND course.certificate_eligible:
        │
        ▼
certificates row inserted (unique cert_number, e.g. CERT-2026-000125)
        │
        ▼
PDF rendered client-side from certificate data, offered as download,
and optionally stored in Supabase Storage (certificates bucket)
```

## Folder structure
```
lms/
  sql/
    01_schema.sql        full Postgres schema, all tables from the spec
    02_rls.sql            RLS policies, all tables
    03_functions.sql      triggers + score-validation + helper functions
    04_seed.sql            demo data
  app/
    src/
      lib/supabaseClient.js
      lib/certificate.js         PDF generation
      context/AuthContext.jsx
      components/                shared UI (Sidebar, KpiCard, Badge, ProgressBar, DataTable...)
      routes/
        auth/Login.jsx
        employee/Dashboard.jsx, Courses.jsx, CoursePlayer.jsx, Quiz.jsx, Certificates.jsx, Profile.jsx
        admin/Dashboard.jsx, Employees.jsx, Courses.jsx, CourseBuilder.jsx, Assignments.jsx
      App.jsx, main.jsx, index.css
    index.html, vite.config.js, tailwind.config.js, package.json, .env.example
  README.md
  docs/ARCHITECTURE.md (this file)
  docs/DEPLOYMENT.md
```
