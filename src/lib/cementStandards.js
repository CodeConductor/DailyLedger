// Resolve the cement standard (bags per pipe) that was EFFECTIVE for a given
// pipe size on a given date. Editing a standard inserts a new row with a later
// effective_date, so a report for a past day keeps using the older standard.
//
// buildStandardResolver(rows) -> (pipeSizeId, dateISO) => number (bags/pipe)
//   rows: array of cement_standards { pipe_size_id, bags_per_pipe, effective_date }
export function buildStandardResolver(rows) {
  // Group by pipe_size_id, each list sorted by effective_date ASCENDING.
  const bySize = new Map()
  for (const r of rows || []) {
    if (!bySize.has(r.pipe_size_id)) bySize.set(r.pipe_size_id, [])
    bySize.get(r.pipe_size_id).push(r)
  }
  for (const list of bySize.values()) {
    list.sort((a, b) => (a.effective_date < b.effective_date ? -1 : 1))
  }

  return function resolve(pipeSizeId, dateISO) {
    const list = bySize.get(pipeSizeId)
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

// The value currently in effect (today) for a size — used by the Settings UI to
// show the standard being edited.
export function currentStandard(rows, pipeSizeId, todayISO) {
  return buildStandardResolver(rows)(pipeSizeId, todayISO)
}
