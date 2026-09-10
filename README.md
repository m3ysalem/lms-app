# Meridian LMS — Phase 1 (MVP)

A real, Supabase-backed corporate Learning Management System. React + Vite + Tailwind frontend, Postgres + Auth + Storage + RLS backend, deployable free on Cloudflare Pages + Supabase.

**This is Phase 1 of a phased build.** See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for exactly what's fully wired now vs. planned for Phase 2 (analytics dashboards, training matrix, training plans UI, full report exports, notification scheduling, audit log viewer, bulk-import UI polish).

## What's real right now
No mock data, no localStorage-as-database, no fake buttons. Every action below is a real Supabase read/write, authorized by Postgres Row Level Security:

- **Auth & roles** — Supabase Auth login; `super_admin`, `hr_admin`, `trainer`, `employee` roles with different route access
- **Employee**: dashboard, course catalog, course player (modules → lessons), lesson completion + progress %, quiz engine with server-validated scoring, PDF certificate generation on passing, certificate archive, editable profile
- **HR/Admin**: create employees (via a secure Edge Function), CSV bulk import, deactivate/reactivate, reset password, department-aware directory; create/publish courses, build modules/lessons/quiz questions; assign courses to individuals, a department, or everyone
- **Full database schema + RLS** for every table in the original spec, including the ones whose UI ships in Phase 2, so no migrations are needed later
- **Audit logging** — triggers on courses/profiles/assignments/certificates already write to `audit_logs`, even before the viewer UI exists

## Project layout
```
sql/                       run these in order in the Supabase SQL editor
  01_schema.sql
  02_rls.sql
  03_functions.sql
  04_seed.sql
supabase/functions/        Edge Functions (service-role operations)
  admin-create-employee/
app/                        the React app
scripts/
  create-test-users.mjs    one-time script to create the 15 demo logins
docs/
  ARCHITECTURE.md
  DEPLOYMENT.md
```

## Quick start
Full details in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Short version:

1. Create a free Supabase project, run `sql/01_schema.sql` → `02_rls.sql` → `03_functions.sql`.
2. Create demo users (`scripts/create-test-users.mjs`), then run `sql/04_seed.sql`.
3. Deploy the `admin-create-employee` Edge Function (`supabase functions deploy admin-create-employee`).
4. `cd app && cp .env.example .env` and fill in your Supabase URL/anon key.
5. `npm install && npm run dev`.
6. Deploy to Cloudflare Pages (build output `app/dist`).

## Test accounts
All use the password `Demo-LMS-2026!` if created via the script.

| Role | Email |
|---|---|
| Super Admin | admin@demo-lms.test |
| HR / L&D Admin | hr@demo-lms.test |
| Trainer | trainer1@demo-lms.test |
| Employee | emp1@demo-lms.test ... emp10@demo-lms.test |

`emp1` and `emp2` already have a completed course and issued certificate in the seed data so you can see that flow immediately.

## Environment variables
Frontend (`app/.env`):
| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |

Never put `SUPABASE_SERVICE_ROLE_KEY` in the frontend. It's only used (a) once locally to run `scripts/create-test-users.mjs`, and (b) automatically inside the deployed Edge Function's own environment.

## Security notes
- Passwords are never stored in application tables — Supabase Auth handles hashing/storage entirely (`sql/01_schema.sql` intentionally has no password column).
- Every table has Row Level Security enabled (`sql/02_rls.sql`); an employee's Postgres session can only read/write their own rows, enforced by the database, not the UI.
- Quiz correct-answers are never sent to the browser before submission — the client fetches questions through `get_quiz_for_attempt()`, a function that omits `is_correct`, and scoring happens server-side in `submit_quiz_attempt()` so a client can't fabricate a passing score.
- Certificate issuance (`issue_certificate()`) re-validates a passing attempt exists server-side rather than trusting the client's claim.

## What's next (Phase 2)
See the "Explicitly Phase 2" section of [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — analytics dashboards & charts, the Training Matrix grid, Training Plans UI, full report exports (PDF for all 8 report types), scheduled due-date/overdue notifications, and the audit log viewer.
