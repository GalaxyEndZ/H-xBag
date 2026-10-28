import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'As variáveis de ambiente do Supabase não foram configuradas.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
