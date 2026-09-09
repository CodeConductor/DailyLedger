import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useMasters } from '../lib/useMasters'
import { useToast } from '../components/Toast'
import { DEFAULT_ORG_ID, FUEL_TYPES, pipeLabel, typeTagClass } from '../lib/constants'
import { todayISO } from '../lib/dates'

// A stable client-side key generator for row identity (no Date.now/random needed).
let _seq = 0
const nextKey = () => `r${++_seq}`

// Build an <option> list that always includes the currently-selected value even
// if it has since been archived (so editing an old day never loses its value).
function optionsFor(list, selectedId) {
  const active = list.filter((x) => x.active)
  if (selectedId && !active.some((x) => x.id === selectedId)) {
    const found = list.find((x) => x.id === selectedId)
    if (found) return [...active, found]
  }
  return active
}

export default function EntryForm() {
  const toast = useToast()
  // Load ALL masters (incl. archived) so old days keep their labels; we filter
  // to active when offering new choices.
  const { machines, pipes, contractors, settings, loading: mLoading, reload } =
    useMasters({ activeOnly: false })

  const [date, setDate] = useState(todayISO())
  const [dayMachines, setDayMachines] = useState([]) // machine ids active this day
  const [rows, setRows] = useState([]) // production rows
  const [fuel, setFuel] = useState({}) // `${machineId}:${type}` -> {opening,consumed,closing,touched}
  // Which contractor(s) operated each machine when cement was drawn that day.
  // machineId -> array of contractor ids. Persisted against the CEMENT fuel_log.
  const [machineContractors, setMachineContractors] = useState({})
  const [loadingDay, setLoadingDay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState(false) // is this an already-saved day?

  const enabledRM = useMemo(
    () => (settings?.raw_material_fields || []).filter((f) => f.enabled),
    [settings]
  )

  const activeMachines = useMemo(() => machines.filter((m) => m.active), [machines])

  // ---- load a day ----------------------------------------------------------
  const loadDay = useCallback(async () => {
    setLoadingDay(true)
    try {
      const [pe, fl] = await Promise.all([
        supabase.from('production_entries').select('*').eq('date', date),
        supabase.from('fuel_logs').select('*').eq('date', date),
      ])
      if (pe.error) throw pe.error
      if (fl.error) throw fl.error

      const peData = pe.data || []
      const flData = fl.data || []
      setExisting(peData.length > 0 || flData.length > 0)

      // rows
      setRows(
        peData.map((r) => ({
          key: nextKey(),
          id: r.id,
          pipe_id: r.pipe_id,
          machine_id: r.machine_id,
          contractor_id: r.contractor_id,
          good_qty: String(r.good_qty ?? 0),
          reject_qty: String(r.reject_qty ?? 0),
          raw_materials: r.raw_materials || {},
          expanded: false,
        }))
      )

      // machines active this day: union from entries + fuel, else all active
      const usedMachines = new Set([
        ...peData.map((r) => r.machine_id),
        ...flData.map((r) => r.machine_id),
      ])
      const dm = usedMachines.size
        ? [...usedMachines]
        : machines.filter((m) => m.active).map((m) => m.id)
      setDayMachines(dm)

      // fuel map
      const fmap = {}
      for (const r of flData) {
        fmap[`${r.machine_id}:${r.fuel_type}`] = {
          opening: String(r.opening ?? 0),
          consumed: String(r.consumed ?? 0),
          closing: String(r.closing ?? 0),
          touched: true,
        }
      }
      setFuel(fmap)

      // contractor tags live on the CEMENT fuel_log row for each machine/day.
      const cementLogs = flData.filter((r) => r.fuel_type === 'cement')
      const machineByCementLog = Object.fromEntries(cementLogs.map((r) => [r.id, r.machine_id]))
      const cementIds = cementLogs.map((r) => r.id)
      const mc = {}
      if (cementIds.length) {
        const links = await supabase
          .from('fuel_log_contractors')
          .select('fuel_log_id, contractor_id')
          .in('fuel_log_id', cementIds)
        if (links.error) throw links.error
        for (const l of links.data || []) {
          const mId = machineByCementLog[l.fuel_log_id]
          if (!mId) continue
          ;(mc[mId] ||= []).push(l.contractor_id)
        }
      }
      setMachineContractors(mc)
    } catch (e) {
      toast(`Load failed: ${e.message}`)
    } finally {
      setLoadingDay(false)
    }
  }, [date, machines, toast])

  useEffect(() => {
    if (!mLoading) loadDay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, mLoading])

  // ---- day machine toggles -------------------------------------------------
  function toggleDayMachine(id) {
    setDayMachines((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // ---- machine contractor tags (for cement reconciliation) -----------------
  function addMachineContractor(machineId, contractorId) {
    if (!contractorId) return
    setMachineContractors((prev) => {
      const cur = prev[machineId] || []
      if (cur.includes(contractorId)) return prev
      return { ...prev, [machineId]: [...cur, contractorId] }
    })
  }
  function removeMachineContractor(machineId, contractorId) {
    setMachineContractors((prev) => ({
      ...prev,
      [machineId]: (prev[machineId] || []).filter((x) => x !== contractorId),
    }))
  }

  // ---- production rows -----------------------------------------------------
  function addRow(prefill = {}) {
    setRows((prev) => [
      ...prev,
      {
        key: nextKey(),
        pipe_id: prefill.pipe_id || '',
        machine_id: prefill.machine_id || dayMachines[0] || '',
        contractor_id: prefill.contractor_id || '',
        good_qty: '0',
        reject_qty: '0',
        raw_materials: {},
        expanded: false,
      },
    ])
  }

  // Convenience: add one row for every active pipe on the first day-machine —
  // mirrors filling a column of the paper register quickly.
  function addAllPipes() {
    const machine = dayMachines[0] || ''
    const activePipes = pipes.filter((p) => p.active)
    setRows((prev) => [
      ...prev,
      ...activePipes.map((p) => ({
        key: nextKey(),
        pipe_id: p.id,
        machine_id: machine,
        contractor_id: '',
        good_qty: '0',
        reject_qty: '0',
        raw_materials: {},
        expanded: false,
      })),
    ])
  }

  function updateRow(key, patch) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  function removeRow(key) {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }
  function updateRowRM(key, rmKey, value) {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, raw_materials: { ...r.raw_materials, [rmKey]: value } } : r
      )
    )
  }

  // ---- inline add contractor ----------------------------------------------
  const [newContractor, setNewContractor] = useState('')
  const [addingC, setAddingC] = useState(false)
  async function addContractor() {
    const name = newContractor.trim()
    if (!name) return
    setAddingC(true)
    const { data, error } = await supabase
      .from('contractors')
      .insert({ name, org_id: DEFAULT_ORG_ID })
      .select()
      .single()
    setAddingC(false)
    if (error) return toast(`Add failed: ${error.message}`)
    setNewContractor('')
    await reload()
    toast(`Added contractor: ${name}`, 'ok')
    return data
  }

  // ---- fuel ----------------------------------------------------------------
  function fuelVal(machineId, type) {
    return (
      fuel[`${machineId}:${type}`] || {
        opening: '0',
        consumed: '0',
        closing: '0',
        touched: false,
      }
    )
  }
  function setFuelField(machineId, type, field, value) {
    const k = `${machineId}:${type}`
    setFuel((prev) => {
      const cur = prev[k] || { opening: '0', consumed: '0', closing: '0', touched: false }
      const next = { ...cur, [field]: value, touched: true }
      // Auto-suggest closing = opening - consumed unless the user edited closing.
      if (field !== 'closing' && !cur.closingTouched) {
        const o = parseFloat(field === 'opening' ? value : next.opening) || 0
        const c = parseFloat(field === 'consumed' ? value : next.consumed) || 0
        next.closing = String(Math.max(0, +(o - c).toFixed(2)))
      }
      if (field === 'closing') next.closingTouched = true
      return { ...prev, [k]: next }
    })
  }

  // ---- validation ----------------------------------------------------------
  const validation = useMemo(() => {
    const errs = []
    const warns = []
    rows.forEach((r, i) => {
      const label = `Row ${i + 1}`
      if (!r.pipe_id || !r.machine_id || !r.contractor_id) {
        errs.push(`${label}: pick pipe, machine and contractor.`)
      }
      const g = Number(r.good_qty)
      const rj = Number(r.reject_qty)
      if (g < 0 || rj < 0 || Number.isNaN(g) || Number.isNaN(rj)) {
        errs.push(`${label}: quantities cannot be negative.`)
      }
    })
    // fuel consistency warnings (non-blocking — manual override allowed)
    for (const machineId of dayMachines) {
      for (const ft of FUEL_TYPES) {
        const v = fuel[`${machineId}:${ft.key}`]
        if (!v || !v.touched) continue
        const o = parseFloat(v.opening) || 0
        const c = parseFloat(v.consumed) || 0
        const cl = parseFloat(v.closing) || 0
        if (o < 0 || c < 0 || cl < 0) {
          errs.push(`Fuel (${ft.label_en}): values cannot be negative.`)
        }
        if (Math.abs(o - c - cl) > 0.001) {
          const mName = machines.find((m) => m.id === machineId)?.name || 'machine'
          warns.push(
            `${mName} · ${ft.label_en}: closing (${cl}) ≠ opening − consumed (${(o - c).toFixed(2)}).`
          )
        }
      }
    }
    return { errs, warns }
  }, [rows, fuel, dayMachines, machines])

  // ---- save ----------------------------------------------------------------
  async function save() {
    if (validation.errs.length) {
      toast(validation.errs[0])
      return
    }
    setSaving(true)
    try {
      // Production: replace-all for the day (simple + safe for a single register).
      const del = await supabase.from('production_entries').delete().eq('date', date)
      if (del.error) throw del.error

      const toInsert = rows
        .filter((r) => r.pipe_id && r.machine_id && r.contractor_id)
        .map((r) => {
          // keep only non-empty raw material numbers
          const rm = {}
          for (const [k, val] of Object.entries(r.raw_materials || {})) {
            if (val !== '' && val !== null && val !== undefined && !Number.isNaN(Number(val))) {
              rm[k] = Number(val)
            }
          }
          return {
            org_id: DEFAULT_ORG_ID,
            date,
            machine_id: r.machine_id,
            pipe_id: r.pipe_id,
            contractor_id: r.contractor_id,
            good_qty: Number(r.good_qty) || 0,
            reject_qty: Number(r.reject_qty) || 0,
            raw_materials: Object.keys(rm).length ? rm : null,
          }
        })
      if (toInsert.length) {
        const ins = await supabase.from('production_entries').insert(toInsert)
        if (ins.error) throw ins.error
      }

      // Fuel: upsert one row per day-machine/type that has been touched.
      // Also force-save the CEMENT row for any machine that has contractor tags,
      // so the fuel_log_contractors links always have a target row to attach to.
      const fuelRows = []
      for (const machineId of dayMachines) {
        const hasTags = (machineContractors[machineId] || []).length > 0
        for (const ft of FUEL_TYPES) {
          const v = fuel[`${machineId}:${ft.key}`]
          const forceCement = ft.key === 'cement' && hasTags
          if ((!v || !v.touched) && !forceCement) continue
          fuelRows.push({
            org_id: DEFAULT_ORG_ID,
            date,
            machine_id: machineId,
            fuel_type: ft.key,
            opening: parseFloat(v?.opening) || 0,
            consumed: parseFloat(v?.consumed) || 0,
            closing: parseFloat(v?.closing) || 0,
          })
        }
      }
      if (fuelRows.length) {
        const up = await supabase
          .from('fuel_logs')
          .upsert(fuelRows, { onConflict: 'org_id,date,machine_id,fuel_type' })
        if (up.error) throw up.error
      }

      // Reconcile contractor tags on the cement fuel logs for this day.
      // Fetch back the cement fuel_log ids (upsert doesn't return them reliably),
      // clear their existing links, then insert the current tags.
      const cementSel = await supabase
        .from('fuel_logs')
        .select('id, machine_id')
        .eq('date', date)
        .eq('fuel_type', 'cement')
      if (cementSel.error) throw cementSel.error
      const cementIdByMachine = Object.fromEntries(
        (cementSel.data || []).map((r) => [r.machine_id, r.id])
      )
      const cementIds = Object.values(cementIdByMachine)
      if (cementIds.length) {
        const delLinks = await supabase
          .from('fuel_log_contractors')
          .delete()
          .in('fuel_log_id', cementIds)
        if (delLinks.error) throw delLinks.error
      }
      const linkRows = []
      for (const machineId of dayMachines) {
        const cid = cementIdByMachine[machineId]
        if (!cid) continue
        for (const contractorId of machineContractors[machineId] || []) {
          linkRows.push({ org_id: DEFAULT_ORG_ID, fuel_log_id: cid, contractor_id: contractorId })
        }
      }
      if (linkRows.length) {
        const insLinks = await supabase.from('fuel_log_contractors').insert(linkRows)
        if (insLinks.error) throw insLinks.error
      }

      toast('Saved ✓', 'ok')
      await loadDay()
    } catch (e) {
      toast(`Save failed: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (mLoading) return <div className="loading">Loading…</div>

  const dayMachineObjs = dayMachines
    .map((id) => machines.find((m) => m.id === id))
    .filter(Boolean)

  return (
    <div>
      {/* ---- Day setup ---- */}
      <div className="panel">
        <div className="panel-head">
          Day Setup · दिन
          {existing && <span className="tag" style={{ marginLeft: 8 }}>Editing saved day</span>}
          <span className="spacer" />
          {loadingDay && <span className="small muted">loading…</span>}
        </div>
        <div className="panel-body">
          <div className="row">
            <div className="field" style={{ maxWidth: 220 }}>
              <label>Date · तारीख</label>
              <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Machines active today · मशीन</label>
            <div className="flex wrap">
              {activeMachines.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`btn sm ${dayMachines.includes(m.id) ? 'primary' : 'ghost'}`}
                  onClick={() => toggleDayMachine(m.id)}
                >
                  {m.name}
                </button>
              ))}
              {activeMachines.length === 0 && (
                <span className="muted small">No machines — add some in Settings.</span>
              )}
            </div>
          </div>

          <div className="field">
            <label>Add contractor (inline) · ठेकेदार जोड़ें</label>
            <div className="flex wrap">
              <input
                lang="hi"
                placeholder="New contractor name · नया नाम"
                style={{ maxWidth: 260 }}
                value={newContractor}
                onChange={(e) => setNewContractor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addContractor())}
              />
              <button type="button" className="btn" disabled={addingC} onClick={addContractor}>
                {addingC ? 'Adding…' : '+ Add'}
              </button>
              <span className="small muted">{contractors.filter((c) => c.active).length} active contractors</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Production grid ---- */}
      <div className="panel">
        <div className="panel-head">
          Production · उत्पादन
          <span className="spacer" />
          <button type="button" className="btn sm" onClick={() => addRow()}>+ Row</button>
          <button type="button" className="btn sm ghost" onClick={addAllPipes} disabled={!dayMachines.length}>
            + All pipes
          </button>
        </div>
        <div className="panel-body">
          {rows.length === 0 && (
            <div className="empty">
              No production rows yet. Use <strong>+ Row</strong> or <strong>+ All pipes</strong> to begin.
            </div>
          )}
          {rows.length > 0 && (
            <div className="grid-wrap">
              <table className="register">
                <thead>
                  <tr>
                    <th style={{ minWidth: 180 }}>Pipe (Size · Type · Class)</th>
                    <th style={{ minWidth: 120 }}>Machine</th>
                    <th style={{ minWidth: 160 }}>Contractor · ठेकेदार</th>
                    <th className="num" style={{ minWidth: 80 }}>Good</th>
                    <th className="num" style={{ minWidth: 80 }}>Reject</th>
                    <th style={{ width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const pipe = pipes.find((p) => p.id === r.pipe_id)
                    return (
                      <RowEditor
                        key={r.key}
                        row={r}
                        pipe={pipe}
                        pipes={pipes}
                        machines={machines}
                        contractors={contractors}
                        enabledRM={enabledRM}
                        onChange={(patch) => updateRow(r.key, patch)}
                        onRemove={() => removeRow(r.key)}
                        onRM={(k, v) => updateRowRM(r.key, k, v)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ---- Fuel / consumables ---- */}
      <div className="panel">
        <div className="panel-head">Fuel &amp; Consumables · ईंधन (per machine)</div>
        <div className="panel-body">
          {dayMachineObjs.length === 0 && (
            <div className="empty">Select at least one machine above to log fuel.</div>
          )}
          {dayMachineObjs.map((m) => (
            <div key={m.id} className="mb">
              <h3>{m.name}</h3>
              <div className="grid-wrap">
                <table className="register">
                  <thead>
                    <tr>
                      <th>Fuel</th>
                      <th className="num">Opening</th>
                      <th className="num">Consumed</th>
                      <th className="num">Closing (auto = O − C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FUEL_TYPES.map((ft) => {
                      const v = fuelVal(m.id, ft.key)
                      return (
                        <tr key={ft.key}>
                          <td className="rowlabel">
                            {ft.label_en} <span lang="hi" className="muted">{ft.label_hi}</span>
                          </td>
                          <td className="num">
                            <input type="number" min="0" step="0.01" inputMode="decimal"
                              value={v.opening}
                              onChange={(e) => setFuelField(m.id, ft.key, 'opening', e.target.value)} />
                          </td>
                          <td className="num">
                            <input type="number" min="0" step="0.01" inputMode="decimal"
                              value={v.consumed}
                              onChange={(e) => setFuelField(m.id, ft.key, 'consumed', e.target.value)} />
                          </td>
                          <td className="num">
                            <input type="number" min="0" step="0.01" inputMode="decimal"
                              value={v.closing}
                              onChange={(e) => setFuelField(m.id, ft.key, 'closing', e.target.value)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <MachineContractorTags
                selected={machineContractors[m.id] || []}
                contractors={contractors}
                onAdd={(cid) => addMachineContractor(m.id, cid)}
                onRemove={(cid) => removeMachineContractor(m.id, cid)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ---- warnings + save ---- */}
      {validation.warns.length > 0 && (
        <div className="panel">
          <div className="panel-body">
            {validation.warns.map((w, i) => (
              <div key={i} className="small"><span className="pill-warn">CHECK</span> {w}</div>
            ))}
            <div className="small muted mt">These are warnings only — you can still save (manual override allowed).</div>
          </div>
        </div>
      )}

      <div className="flex" style={{ position: 'sticky', bottom: 0, padding: '10px 0' }}>
        <button className="btn primary" style={{ minWidth: 160 }} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : existing ? 'Update Day ✓' : 'Save Day ✓'}
        </button>
        {validation.errs.length > 0 && (
          <span className="err small">{validation.errs.length} issue(s) to fix before saving.</span>
        )}
      </div>
    </div>
  )
}

// ---- one production row (with expandable raw materials) --------------------
function RowEditor({ row, pipe, pipes, machines, contractors, enabledRM, onChange, onRemove, onRM }) {
  return (
    <>
      <tr>
        <td>
          <select value={row.pipe_id} onChange={(e) => onChange({ pipe_id: e.target.value })}>
            <option value="">— pipe —</option>
            {optionsFor(pipes, row.pipe_id).map((p) => (
              <option key={p.id} value={p.id}>{pipeLabel(p)}{!p.active ? ' (archived)' : ''}</option>
            ))}
          </select>
          {pipe && (
            <span style={{ marginTop: 4, display: 'inline-flex', gap: 4 }}>
              <span className={typeTagClass(pipe.type)}>{pipe.type}</span>
              <span className="tag">{pipe.class}</span>
            </span>
          )}
        </td>
        <td>
          <select value={row.machine_id} onChange={(e) => onChange({ machine_id: e.target.value })}>
            <option value="">— machine —</option>
            {optionsFor(machines, row.machine_id).map((m) => (
              <option key={m.id} value={m.id}>{m.name}{!m.active ? ' (archived)' : ''}</option>
            ))}
          </select>
        </td>
        <td>
          <select lang="hi" value={row.contractor_id} onChange={(e) => onChange({ contractor_id: e.target.value })}>
            <option value="">— contractor —</option>
            {optionsFor(contractors, row.contractor_id).map((c) => (
              <option key={c.id} value={c.id}>{c.name}{!c.active ? ' (inactive)' : ''}</option>
            ))}
          </select>
        </td>
        <td className="num">
          <input type="number" min="0" step="1" inputMode="numeric"
            value={row.good_qty}
            aria-invalid={Number(row.good_qty) < 0}
            onChange={(e) => onChange({ good_qty: e.target.value })} />
        </td>
        <td className="num">
          <input type="number" min="0" step="1" inputMode="numeric"
            value={row.reject_qty}
            aria-invalid={Number(row.reject_qty) < 0}
            onChange={(e) => onChange({ reject_qty: e.target.value })} />
        </td>
        <td className="center">
          <button type="button" className="btn sm ghost" title="Remove row" onClick={onRemove}>✕</button>
        </td>
      </tr>
      {enabledRM.length > 0 && (
        <tr>
          <td colSpan={6} style={{ background: 'transparent', border: 'none', paddingTop: 0 }}>
            <div className={`collapse-head ${row.expanded ? 'open' : ''}`} onClick={() => onChange({ expanded: !row.expanded })}>
              <span className="chev">▶</span>
              <span className="small">Raw materials · कच्चा माल {row.expanded ? '' : '(optional)'}</span>
            </div>
            {row.expanded && (
              <div className="row" style={{ marginTop: 8 }}>
                {enabledRM.map((f) => (
                  <div className="field" key={f.key} style={{ minWidth: 110, maxWidth: 150 }}>
                    <label>{f.label_en} <span lang="hi" className="muted">{f.label_hi}</span></label>
                    <input type="number" min="0" step="0.01" inputMode="decimal"
                      value={row.raw_materials?.[f.key] ?? ''}
                      onChange={(e) => onRM(f.key, e.target.value)} />
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ---- contractor tags for a machine's cement draw --------------------------
function MachineContractorTags({ selected, contractors, onAdd, onRemove }) {
  const byId = Object.fromEntries(contractors.map((c) => [c.id, c]))
  // Offer active contractors not already selected.
  const available = contractors.filter((c) => c.active && !selected.includes(c.id))
  return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>Contractors operating this machine today (for cement reconciliation) · ठेकेदार</label>
      <div className="flex wrap">
        {selected.map((cid) => (
          <span className="chip" key={cid} lang="hi">
            {byId[cid]?.name || '—'}
            <span className="x" title="Remove" onClick={() => onRemove(cid)}>✕</span>
          </span>
        ))}
        <select
          style={{ maxWidth: 220 }}
          value=""
          onChange={(e) => { onAdd(e.target.value); e.target.value = '' }}
        >
          <option value="">+ tag contractor…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id} lang="hi">{c.name}</option>
          ))}
        </select>
      </div>
      <div className="small muted">
        Tag everyone who drew/consumed this machine's cement today. Used only for the
        reconciliation report — production credit still comes from each production row.
      </div>
    </div>
  )
}
