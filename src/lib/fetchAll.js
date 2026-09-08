import { supabase } from './supabaseClient'

// Supabase returns at most 1000 rows per request. For a wide custom date range
// a month/quarter of entries can exceed that, so we page through with .range().
// This keeps reports correct without any paid add-on.
export async function fetchAllInRange(table, { from, to, orderCol = 'date' }) {
  const PAGE = 1000
  let offset = 0
  const all = []
  // Loop until a page returns fewer than PAGE rows.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order(orderCol)
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < PAGE) break
    offset += PAGE
  }
  return all
}
