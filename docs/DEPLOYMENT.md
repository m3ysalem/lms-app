# Deployment Guide

Everything below fits in Supabase's free tier and Cloudflare Pages' free tier — no paid infrastructure required for an initial deployment.

## 1. Create the Supabase project
1. Go to https://supabase.com, create a free project.
2. In **Project Settings → API**, copy the **Project URL** and **anon public key**. You'll need these for `app/.env`.
3. In **Project Settings → API**, also copy the **service_role key** — keep this ONLY on your local machine / in the Edge Function's environment. Never put it in the frontend.

## 2. Run the database schema
In the Supabase Dashboard → **SQL Editor**, run these files in order, pasting each one's contents and clicking Run:
1. `sql/01_schema.sql`
2. `sql/02_rls.sql`
3. `sql/03_functions.sql`

(Don't run `04_seed.sql` yet — it depends on the demo users existing first, see step 4.)

## 3. Configure Storage
In **Storage**, create these buckets (used by course materials, thumbnails, and generated certificates):
- `course-materials` (private) — PDFs, PPTX, DOCX, images attached to lessons
- `course-thumbnails` (public) — course cover images
- `certificates` (private) — optional archive of generated certificate PDFs

For `course-materials` and `certificates`, add a storage policy so only the uploader/owner and admins can read:
```sql
create policy "materials_read_authenticated"
on storage.objects for select
using (bucket_id = 'course-materials' and auth.uid() is not null);

create policy "materials_write_admin"
on storage.objects for insert
with check (bucket_id = 'course-materials' and public.is_admin());
```
(Repeat similarly for `certificates`, scoping `select` to the owning employee or admins.)

## 4. Create demo accounts and seed data
Auth users can't be created directly via plain SQL — use one of these:

**Option A — script (fastest for 15 demo users):**
```bash
cd app && npm install
SUPABASE_URL=https://YOUR-REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node ../scripts/create-test-users.mjs
```

**Option B — Dashboard:** Authentication → Users → Add user, one at a time.

Then, in the SQL Editor, run `sql/04_seed.sql` to populate departments, courses, quizzes, and link the demo users to their roles/departments.

## 5. Deploy the Edge Function (needed for "Add employee" in the admin UI)
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy admin-create-employee
```
This function uses the service_role key automatically via Supabase's function environment — you don't paste it anywhere yourself.

## 6. Configure the frontend
```bash
cd app
cp .env.example .env
# edit .env: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev   # local check at http://localhost:5173
```

## 7. Deploy to Cloudflare Pages
**Via dashboard (simplest):**
1. Push this repo to GitHub.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `app/dist`
   - Root directory: `app`
4. Add environment variables in Pages → Settings → Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. Cloudflare Pages is a static host — the `public/_redirects` file (already included) makes client-side routing work.

**Via CLI:**
```bash
cd app
npm run build
npx wrangler pages deploy dist --project-name=meridian-lms
```

## 8. First login
Log in as `admin@demo-lms.test` with the password from step 4 (`Demo-LMS-2026!` if you used the script). From there, promote real employees, create real courses, and deactivate/delete the demo accounts once you're ready to go live.

## Ongoing cost
- Supabase free tier: 500MB database, 1GB storage, 50k monthly active users — sufficient for most single-company deployments to start.
- Cloudflare Pages free tier: unlimited static requests, 500 builds/month.
- You will outgrow the Supabase free tier at scale (large file storage, high concurrent users) — Supabase Pro starts at $25/month if/when you do.
