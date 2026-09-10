// Run locally, once, to create the demo auth accounts before running
// sql/04_seed.sql. Requires the SERVICE ROLE key — never commit it, never
// ship this script anywhere but your own machine.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/create-test-users.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.')
  process.exit(1)
}

const admin = createClient(url, key)

const DEMO_PASSWORD = 'Demo-LMS-2026!'

const users = [
  { email: 'admin@demo-lms.test', full_name: 'Amina Farouk', role: 'super_admin' },
  { email: 'hr@demo-lms.test', full_name: 'Youssef Nabil', role: 'hr_admin' },
  { email: 'trainer1@demo-lms.test', full_name: 'Dr. Salma Hassan', role: 'trainer' },
  { email: 'trainer2@demo-lms.test', full_name: 'Karim Adel', role: 'trainer' },
  { email: 'trainer3@demo-lms.test', full_name: 'Nourhan Sayed', role: 'trainer' },
  ...Array.from({ length: 10 }, (_, i) => ({
    email: `emp${i + 1}@demo-lms.test`,
    full_name: `Employee ${i + 1}`,
    role: 'employee',
  })),
]

for (const u of users) {
  const { error } = await admin.auth.admin.createUser({
    email: u.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, role: u.role },
  })
  if (error) {
    console.error(`✗ ${u.email}: ${error.message}`)
  } else {
    console.log(`✓ ${u.email}`)
  }
}

console.log(`\nDone. All demo accounts use the password: ${DEMO_PASSWORD}`)
console.log('Now run sql/04_seed.sql in the Supabase SQL editor to fill in roles/departments/courses.')
