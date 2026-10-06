import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey)

    // 1) التحقق من هوية المستخدم اللي بينادي على الدالة
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)

    const { data: caller } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (!caller || !['admin', 'super_admin', 'hr_admin'].includes(caller.role)) {
      return json({ error: 'Forbidden: admins only' }, 403)
    }

    // 2) قراءة والتحقق من البيانات
    const body = await req.json()
    const userId = String(body.user_id || '')
    const password = String(body.password || '')

    if (!userId) return json({ error: 'user_id is required' }, 400)
    if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400)

    // 3) حماية الحسابات الإدارية: تغيير باسورد أدمن يقوم به super_admin / admin فقط
    const { data: target } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (!target) return json({ error: 'User not found' }, 404)

    const privilegedRoles = ['hr_admin', 'super_admin', 'admin']
    if (privilegedRoles.includes(target.role) && !['admin', 'super_admin'].includes(caller.role)) {
      return json({ error: 'Only super_admin can change an admin password' }, 403)
    }

    // 4) تحديث الباسورد في Authentication (يتخزن مشفّراً)
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { password })
    if (updateErr) return json({ error: updateErr.message }, 400)

    // الباسورد اللي حدده الأدمن مؤقت: الموظف يُجبر يغيّره في أول دخول (ما عدا لو الأدمن بيغيّر باسورد نفسه)
    if (userId !== userData.user.id) {
      const { error: flagErr } = await admin
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', userId)
      if (flagErr) console.warn('must_change_password flag not set:', flagErr.message)
    }

    return json({ success: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
