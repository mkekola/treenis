import { createClient } from '@supabase/supabase-js'

/**
 * Julkinen avain saa olla selaimessa: se ei yksin anna pääsyä mihinkään.
 * Tietokanta päästää jokaisen vain omiin riveihinsä (RLS).
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Kirjautuminen tehdään koodilla, ei linkillä, joten osoitteesta ei lueta mitään.
      detectSessionInUrl: false,
    },
  },
)
