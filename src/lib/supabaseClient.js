import { createClient } from '@supabase/supabase-js'

// Values come from Vite env vars (see .env.example). They are injected at build
// time, so anything referenced here must be prefixed with VITE_.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loudly & early with a helpful message rather than a cryptic runtime error
// deep inside a query. This is a common first-run mistake.
if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    '[config] Missing Supabase env vars. Copy .env.example to .env and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart `npm run dev`.'
  )
}

export const supabase = createClient(url || 'http://missing.local', anonKey || 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Whether the app is configured at all — used to show a friendly setup screen.
export const isConfigured = Boolean(url && anonKey)
