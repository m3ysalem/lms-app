import { createClient } from '@supabase/supabase-js'

const url = 'https://nklnvhigturnxlnmizog.supabase.co'
const anonKey = 'sb_publishable_8cDjXtd4miLFctGPtPSMVw_UBB7TdJd'

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
