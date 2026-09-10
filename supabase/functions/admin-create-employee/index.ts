// Supabase Edge Function: admin-create-employee
//
// Creating an auth user (with a chosen password/metadata) requires the
// service_role key, which must never reach the browser. This function runs
// server-side with that key, but first verifies the CALLER is an
// authenticated super_admin/hr_admin using their own JWT — so a random
// anon-key request can't invoke it.
//
// Deploy: supabase functions deploy admin-create-employee
// Invoke from the frontend with supabase.functions.invoke(...) — the
// caller's session JWT is forwarded automatically as the Authorization header.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !callerUser) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single()

    if (!callerProfile || !['super_admin', 'hr_admin'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), { status: 403 })
    }

    const body = await req.json()
    const { email, full_name, role, department_id, job_title_id, hire_date, temp_password } = body

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: 'email and full_name are required' }), { status: 400 })
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: temp_password || crypto.randomUUID().slice(0, 12),
      email_confirm: true,
      user_metadata: { full_name, role: role || 'employee' },
    })
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400 })
    }

    // handle_new_user() trigger already created a base profiles row; fill in the rest.
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ department_id, job_title_id, hire_date, role: role || 'employee' })
      .eq('id', created.user.id)
    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 400 })
    }

    return new Response(JSON.stringify({ id: created.user.id, temp_password: temp_password || undefined }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
