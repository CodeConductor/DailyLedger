import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Loads the master/reference data used across pages: machines, pipe_sizes,
// contractors and app_settings. Returns a reload() so pages can refresh after
// inline adds (e.g. adding a contractor from the entry form).
export function useMasters({ activeOnly = false } = {}) {
  const [machines, setMachines] = useState([])
  const [sizes, setSizes] = useState([])
  const [contractors, setContractors] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const mQ = supabase.from('machines').select('*').order('created_at')
      const sQ = supabase.from('pipe_sizes').select('*').order('sort_order').order('label')
      const cQ = supabase.from('contractors').select('*').order('name')
      const gQ = supabase.from('app_settings').select('*').limit(1).maybeSingle()

      const [m, s, c, g] = await Promise.all([mQ, sQ, cQ, gQ])
      if (m.error) throw m.error
      if (s.error) throw s.error
      if (c.error) throw c.error
      if (g.error) throw g.error

      const filt = (rows) => (activeOnly ? rows.filter((r) => r.active) : rows)
      setMachines(filt(m.data || []))
      setSizes(filt(s.data || []))
      setContractors(filt(c.data || []))
      setSettings(g.data || null)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    load()
  }, [load])

  return { machines, sizes, contractors, settings, loading, error, reload: load }
}
