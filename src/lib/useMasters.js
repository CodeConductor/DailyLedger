import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Loads the master/reference data used across pages: machines, pipes,
// contractors and app_settings. Returns a reload() so pages can refresh after
// inline adds (e.g. adding a contractor from the entry form).
export function useMasters({ activeOnly = false } = {}) {
  const [machines, setMachines] = useState([])
  const [pipes, setPipes] = useState([])
  const [contractors, setContractors] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const mQ = supabase.from('machines').select('*').order('created_at')
      const pQ = supabase.from('pipes').select('*').order('size_mm').order('type').order('class')
      const cQ = supabase.from('contractors').select('*').order('name')
      const gQ = supabase.from('app_settings').select('*').limit(1).maybeSingle()

      const [m, p, c, g] = await Promise.all([mQ, pQ, cQ, gQ])
      if (m.error) throw m.error
      if (p.error) throw p.error
      if (c.error) throw c.error
      if (g.error) throw g.error

      const filt = (rows) => (activeOnly ? rows.filter((r) => r.active) : rows)
      setMachines(filt(m.data || []))
      setPipes(filt(p.data || []))
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

  return { machines, pipes, contractors, settings, loading, error, reload: load }
}
