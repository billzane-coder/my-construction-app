import { createClient } from '@supabase/supabase-js'

// Provide a dummy URL and Key so Vercel doesn't crash during the "prerender" phase.
// In the live app, it will automatically use your real Vercel environment variables.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)