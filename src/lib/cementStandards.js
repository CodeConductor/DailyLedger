// Resolve the cement standard (bags per pipe) that was EFFECTIVE for a given
// pipe SIZE + CLASS on a given date. Editing a standard inserts a new row with a
// later effective_date, so a report for a past day keeps using the older
// standard. (Type is intentionally ignored — cement usage depends on bore and
// strength class, not the joint type.)
//
// buildStandardResolver(rows) -> (sizeMm, klass, dateISO) => number (bags/pipe)
//   rows: array of cement_standards { size_mm, class, bags_per_pipe, effective_date }
const keyOf = (sizeMm, klass) => `${sizeMm}|${klass}`

export function buildStandardResolver(rows) {
  // Group by size+class, each list sorted by effective_date ASCENDING.
  const byKey = new Map()
  for (const r of rows || []) {
    const k = keyOf(r.size_mm, r.class)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(r)
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => (a.effective_date < b.effective_date ? -1 : 1))
  }

  return function resolve(sizeMm, klass, dateISO) {
    const list = byKey.get(keyOf(sizeMm, klass))
    if (!list || !list.length) return 0
    // Pick the last row whose effective_date <= dateISO (string compare is safe
    // for ISO 'YYYY-MM-DD'). If none is effective yet, treat as 0.
    let val = 0
    for (const r of list) {
      if (r.effective_date <= dateISO) val = Number(r.bags_per_pipe) || 0
      else break
    }
    return val
  }
}

// The value currently in effect (today) for a size+class — used by the Settings
// UI to show the standard being edited.
export function currentStandard(rows, sizeMm, klass, todayISO) {
  return buildStandardResolver(rows)(sizeMm, klass, todayISO)
}
