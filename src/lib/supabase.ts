import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Add them to .env.local locally, and to the Cloudflare Pages ' +
      'environment variables for deployed builds.',
  )
}

// db.schema is essential: all StudioDeals tables live in `crm`, not `public`.
export const supabase = createClient<Database>(url, anonKey, {
  db: { schema: 'crm' },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
