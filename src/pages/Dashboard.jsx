import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useMasters } from '../lib/useMasters'
import { useToast } from '../components/Toast'
import { fetchAllInRange } from '../lib/fetchAll'
import { supabase } from '../lib/supabaseClient'
import { downloadCSV } from '../lib/csv'
import { buildStandardResolver } from '../lib/cementStandards'
import { rangePreset, shortDate, todayISO } from '../lib/dates'

const RUST = '#b5432e'
const INK = '#1f2420'
const TAN = '#a89b82'
const OK = '#3d6b46'

function rate(good, reject) {
  const t = good + reject
  return t === 0 ? 0 : +((reject / t) * 100).toFixed(1)
}

export default function Dashboard() {
  const toast = useToast()
  const { machines, sizes, contractors, loading: mLoading } = useMasters({ activeOnly: false })

  const [preset, setPreset] = useState('month')
  const [from, setFrom] = useState(rangePreset('month').from)
  const [to, setTo] = useState(rangePreset('month').to)
  const [prod, setProd] = useState([])
  const [fuel, setFuel] = useState([])
  const [standards, setStandards] = useState([]) // cement_standards (all versions)
  const [links, setLinks] = useState([])         // fuel_log_contractors for cement logs in range
  const [loading, setLoading] = useState(false)
  const [selectedContractor, setSelectedContractor] = useState(null)

  // name lookups
  const mName = useMemo(() => Object.fromEntries(machines.map((m) => [m.id, m.name])), [machines])
  const sName = useMemo(() => Object.fromEntries(sizes.map((s) => [s.id, s.label])), [sizes])
  const cName = useMemo(() => Object.fromEntries(contractors.map((c) => [c.id, c.name])), [contractors])

  function applyPreset(p) {
    setPreset(p)
    if (p !== 'custom') {
      const r = rangePreset(p)
      setFrom(r.from)
      setTo(r.to)
    }
  }

  async function load() {
    setLoading(true)
    try {
      const [p, f, st] = await Promise.all([
        fetchAllInRange('production_entries', { from, to }),
        fetchAllInRange('fuel_logs', { from, to }),
        // cement_standards is small (a few versions per size); fetch all so the
        // resolver can pick the version effective on each entry's date.
        supabase.from('cement_standards').select('*'),
      ])
      if (st.error) throw st.error
      setProd(p)
      setFuel(f)
      setStandards(st.data || [])

      // contractor tags for the cement fuel logs in this range
      const cementIds = f.filter((r) => r.fuel_type === 'cement').map((r) => r.id)
      if (cementIds.length) {
        const lk = await supabase
          .from('fuel_log_contractors')
          .select('fuel_log_id, contractor_id')
          .in('fuel_log_id', cementIds)
        if (lk.error) throw lk.error
        setLinks(lk.data || [])
      } else {
        setLinks([])
      }
    } catch (e) {
      toast(`Load failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mLoading) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, mLoading])

  // ---- aggregations --------------------------------------------------------
  const agg = useMemo(() => {
    let totalGood = 0, totalReject = 0
    const bySize = {}       // sizeId -> {good, reject}
    const byMachine = {}    // machineId -> {good, reject}
    const trend = {}        // date -> {good, reject}
    const byContractor = {} // cid -> {good, reject, days:Set, sizes:Set, machines:Set, bySize:{sizeId:{good,reject}}}

    for (const r of prod) {
      const g = r.good_qty || 0
      const rj = r.reject_qty || 0
      totalGood += g; totalReject += rj

      ;(bySize[r.pipe_size_id] ||= { good: 0, reject: 0 })
      bySize[r.pipe_size_id].good += g; bySize[r.pipe_size_id].reject += rj

      ;(byMachine[r.machine_id] ||= { good: 0, reject: 0 })
      byMachine[r.machine_id].good += g; byMachine[r.machine_id].reject += rj

      ;(trend[r.date] ||= { good: 0, reject: 0 })
      trend[r.date].good += g; trend[r.date].reject += rj

      const c = (byContractor[r.contractor_id] ||= {
        good: 0, reject: 0, days: new Set(), sizes: new Set(), machines: new Set(), bySize: {},
      })
      c.good += g; c.reject += rj
      c.days.add(r.date); c.sizes.add(r.pipe_size_id); c.machines.add(r.machine_id)
      ;(c.bySize[r.pipe_size_id] ||= { good: 0, reject: 0 })
      c.bySize[r.pipe_size_id].good += g; c.bySize[r.pipe_size_id].reject += rj
    }

    // fuel
    let totalCement = 0, totalDiesel = 0
    const fuelTrend = {} // date -> {cement, diesel}
    for (const r of fuel) {
      const consumed = Number(r.consumed) || 0
      if (r.fuel_type === 'cement') totalCement += consumed
      if (r.fuel_type === 'diesel') totalDiesel += consumed
      ;(fuelTrend[r.date] ||= { cement: 0, diesel: 0 })
      fuelTrend[r.date][r.fuel_type] += consumed
    }

    return { totalGood, totalReject, bySize, byMachine, trend, byContractor, totalCement, totalDiesel, fuelTrend }
  }, [prod, fuel])

  // chart datasets ------------------------------------------------------------
  const sizeChart = useMemo(
    () =>
      Object.entries(agg.bySize)
        .map(([id, v]) => ({ name: sName[id] || '—', good: v.good, reject: v.reject, rejectRate: rate(v.good, v.reject) }))
        .sort((a, b) => b.good - a.good),
    [agg, sName]
  )

  const machineChart = useMemo(
    () =>
      Object.entries(agg.byMachine).map(([id, v]) => ({
        name: mName[id] || '—', good: v.good, reject: v.reject, rejectRate: rate(v.good, v.reject),
      })),
    [agg, mName]
  )

  const trendChart = useMemo(
    () =>
      Object.keys(agg.trend).sort().map((d) => ({
        date: shortDate(d), good: agg.trend[d].good, reject: agg.trend[d].reject,
      })),
    [agg]
  )

  const fuelChart = useMemo(
    () =>
      Object.keys(agg.fuelTrend).sort().map((d) => ({
        date: shortDate(d), cement: +agg.fuelTrend[d].cement.toFixed(2), diesel: +agg.fuelTrend[d].diesel.toFixed(2),
      })),
    [agg]
  )

  // contractor table + above-average reject flagging
  const contractorRows = useMemo(() => {
    const rows = Object.entries(agg.byContractor).map(([id, v]) => ({
      id,
      name: cName[id] || '—',
      good: v.good,
      reject: v.reject,
      total: v.good + v.reject,
      rejectRate: rate(v.good, v.reject),
      days: v.days.size,
      sizes: v.sizes.size,
      machines: v.machines.size,
      bySize: v.bySize,
    }))
    const avg = rows.length ? rows.reduce((s, r) => s + r.rejectRate, 0) / rows.length : 0
    rows.forEach((r) => (r.aboveAvg = r.rejectRate > avg && rows.length > 1))
    rows.sort((a, b) => b.good - a.good)
    return { rows, avg: +avg.toFixed(1) }
  }, [agg, cName])

  const activeContractorsInRange = contractorRows.rows.length

  // ---- cement reconciliation ----------------------------------------------
  const [reconMachine, setReconMachine] = useState('') // '' = all
  const [reconContractor, setReconContractor] = useState('') // '' = all

  const recon = useMemo(() => {
    const resolve = buildStandardResolver(standards)

    // contractor tags per cement fuel_log id
    const tagsByLog = {}
    for (const l of links) (tagsByLog[l.fuel_log_id] ||= []).push(l.contractor_id)

    const cementLogs = fuel.filter((r) => r.fuel_type === 'cement')
    const machMatch = (mid) => !reconMachine || mid === reconMachine

    // ----- headline totals (respect both optional filters) -----
    let expected = 0
    for (const r of prod) {
      if (!machMatch(r.machine_id)) continue
      if (reconContractor && r.contractor_id !== reconContractor) continue
      expected += (r.good_qty || 0) * resolve(r.pipe_size_id, r.date)
    }

    let actual = 0
    for (const log of cementLogs) {
      if (!machMatch(log.machine_id)) continue
      if (reconContractor && !(tagsByLog[log.id] || []).includes(reconContractor)) continue
      actual += Number(log.consumed) || 0
    }

    // ----- per-contractor breakdown (machine filter only; each row is one
    // contractor, so the contractor filter would make the table trivial) -----
    const ids = new Set()
    for (const r of prod) if (machMatch(r.machine_id)) ids.add(r.contractor_id)
    for (const log of cementLogs) {
      if (!machMatch(log.machine_id)) continue
      for (const cid of tagsByLog[log.id] || []) ids.add(cid)
    }

    const rows = [...ids].map((cid) => {
      let exp = 0
      for (const r of prod) {
        if (!machMatch(r.machine_id)) continue
        if (r.contractor_id !== cid) continue
        exp += (r.good_qty || 0) * resolve(r.pipe_size_id, r.date)
      }
      let assoc = 0
      for (const log of cementLogs) {
        if (!machMatch(log.machine_id)) continue
        if ((tagsByLog[log.id] || []).includes(cid)) assoc += Number(log.consumed) || 0
      }
      return {
        id: cid,
        name: cName[cid] || '—',
        associated: +assoc.toFixed(2),
        expected: +exp.toFixed(2),
        difference: +(assoc - exp).toFixed(2),
      }
    })
    rows.sort((a, b) => b.expected - a.expected)

    return {
      actual: +actual.toFixed(2),
      expected: +expected.toFixed(2),
      difference: +(actual - expected).toFixed(2),
      rows,
    }
  }, [prod, fuel, standards, links, reconMachine, reconContractor, cName])

  function exportReconciliation() {
    const rows = recon.rows.map((r) => ({
      contractor: r.name,
      associated: r.associated,
      expected: r.expected,
      difference: r.difference,
    }))
    downloadCSV(`cement_reconciliation_${from}_to_${to}.csv`, rows, [
      { key: 'contractor', header: 'Contractor' },
      { key: 'associated', header: 'Cement associated (bags)' },
      { key: 'expected', header: 'Expected cement (bags)' },
      { key: 'difference', header: 'Difference (assoc − expected)' },
    ])
  }

  // ---- CSV exports ---------------------------------------------------------
  function exportProduction() {
    const rows = prod.map((r) => ({
      date: r.date,
      size: sName[r.pipe_size_id] || r.pipe_size_id,
      machine: mName[r.machine_id] || r.machine_id,
      contractor: cName[r.contractor_id] || r.contractor_id,
      good_qty: r.good_qty,
      reject_qty: r.reject_qty,
    }))
    downloadCSV(`production_${from}_to_${to}.csv`, rows, [
      { key: 'date', header: 'Date' },
      { key: 'size', header: 'Pipe Size' },
      { key: 'machine', header: 'Machine' },
      { key: 'contractor', header: 'Contractor' },
      { key: 'good_qty', header: 'Good Qty' },
      { key: 'reject_qty', header: 'Reject Qty' },
    ])
  }

  function exportContractors() {
    const rows = contractorRows.rows.map((r) => ({
      contractor: r.name, good: r.good, reject: r.reject, total: r.total,
      rejectRate: r.rejectRate, days: r.days, sizes: r.sizes, machines: r.machines,
    }))
    downloadCSV(`contractors_${from}_to_${to}.csv`, rows, [
      { key: 'contractor', header: 'Contractor' },
      { key: 'good', header: 'Good (pieces)' },
      { key: 'reject', header: 'Reject' },
      { key: 'total', header: 'Total made' },
      { key: 'rejectRate', header: 'Reject %' },
      { key: 'days', header: 'Days worked' },
      { key: 'sizes', header: 'Distinct sizes' },
      { key: 'machines', header: 'Distinct machines' },
    ])
  }

  if (mLoading) return <div className="loading">Loading…</div>

  return (
    <div>
      {/* ---- range filter ---- */}
      <div className="panel">
        <div className="panel-head">Range · अवधि</div>
        <div className="panel-body">
          <div className="flex wrap">
            {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom']].map(
              ([k, label]) => (
                <button key={k} className={`btn sm ${preset === k ? 'primary' : 'ghost'}`} onClick={() => applyPreset(k)}>
                  {label}
                </button>
              )
            )}
            <span className="spacer" />
            {loading && <span className="small muted">loading…</span>}
          </div>
          {preset === 'custom' && (
            <div className="row mt">
              <div className="field" style={{ maxWidth: 200 }}>
                <label>From</label>
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field" style={{ maxWidth: 200 }}>
                <label>To</label>
                <input type="date" value={to} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}
          <div className="small muted mt">Showing {from} → {to}</div>
        </div>
      </div>

      {/* ---- summary cards ---- */}
      <div className="cards mb">
        <Stat k="Pipes produced" v={agg.totalGood.toLocaleString()} sub="good pieces" />
        <Stat k="Rejects" v={agg.totalReject.toLocaleString()} sub={`${rate(agg.totalGood, agg.totalReject)}% reject rate`} />
        <Stat k="Diesel consumed" v={agg.totalDiesel.toLocaleString()} sub="डीजल (units)" />
        <Stat k="Cement consumed" v={agg.totalCement.toLocaleString()} sub="सीमेंट (units)" />
        <Stat k="Active contractors" v={activeContractorsInRange} sub="worked in range" />
      </div>

      {/* ================= PRODUCTION REPORTS ================= */}
      <div className="panel">
        <div className="panel-head">
          Production Reports · उत्पादन रिपोर्ट
          <span className="spacer" />
          <button className="btn sm" onClick={exportProduction} disabled={!prod.length}>Export CSV</button>
        </div>
        <div className="panel-body">
          {prod.length === 0 ? (
            <div className="empty">No production in this range.</div>
          ) : (
            <>
              <h3>Total production by size</h3>
              <ChartBox>
                <BarChart data={sizeChart} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8d2c4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={54} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="good" name="Good" fill={INK} />
                  <Bar dataKey="reject" name="Reject" fill={RUST} />
                </BarChart>
              </ChartBox>

              <hr className="divider" />
              <h3>Production trend over time</h3>
              <ChartBox>
                <LineChart data={trendChart} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8d2c4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="good" name="Good" stroke={INK} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="reject" name="Reject" stroke={RUST} strokeWidth={2} dot={false} />
                </LineChart>
              </ChartBox>

              <hr className="divider" />
              <h3>Reject rate % by size</h3>
              <RateTable rows={sizeChart} labelHead="Size" />

              <hr className="divider" />
              <h3>Reject rate % by machine</h3>
              <RateTable rows={machineChart} labelHead="Machine" />
            </>
          )}
        </div>
      </div>

      {/* ================= CONTRACTOR REPORTS ================= */}
      <div className="panel">
        <div className="panel-head">
          Contractor Reports · ठेकेदार रिपोर्ट
          <span className="spacer" />
          <button className="btn sm" onClick={exportContractors} disabled={!contractorRows.rows.length}>Export CSV</button>
        </div>
        <div className="panel-body">
          {contractorRows.rows.length === 0 ? (
            <div className="empty">No contractor activity in this range.</div>
          ) : (
            <>
              <div className="small muted mb">
                Pay-by-piece basis. Average reject rate across contractors:{' '}
                <strong>{contractorRows.avg}%</strong> — rows above it are flagged.
              </div>
              <div className="grid-wrap">
                <table className="register">
                  <thead>
                    <tr>
                      <th>Contractor · ठेकेदार</th>
                      <th className="num">Good</th>
                      <th className="num">Reject</th>
                      <th className="num">Reject %</th>
                      <th className="num">Days</th>
                      <th className="num">Sizes</th>
                      <th className="num">Machines</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractorRows.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="rowlabel" lang="hi">{r.name}</td>
                        <td className="num">{r.good.toLocaleString()}</td>
                        <td className="num">{r.reject.toLocaleString()}</td>
                        <td className="num">
                          {r.rejectRate}% {r.aboveAvg && <span className="pill-warn">HIGH</span>}
                        </td>
                        <td className="num">{r.days}</td>
                        <td className="num">{r.sizes}</td>
                        <td className="num">{r.machines}</td>
                        <td className="center">
                          <button className="btn sm ghost" onClick={() => setSelectedContractor(r)}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= FUEL REPORTS ================= */}
      <div className="panel">
        <div className="panel-head">Fuel Consumption · ईंधन खपत</div>
        <div className="panel-body">
          {fuelChart.length === 0 ? (
            <div className="empty">No fuel logs in this range.</div>
          ) : (
            <ChartBox>
              <LineChart data={fuelChart} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8d2c4" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="diesel" name="Diesel · डीजल" stroke={RUST} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cement" name="Cement · सीमेंट" stroke={OK} strokeWidth={2} dot={false} />
              </LineChart>
            </ChartBox>
          )}
          <div className="small muted mt">
            Combined across all machines. Per-machine breakdown is available in the CSV export via the daily entries.
          </div>
        </div>
      </div>

      {/* ================= CEMENT RECONCILIATION ================= */}
      <div className="panel">
        <div className="panel-head">
          Cement Reconciliation · सीमेंट मिलान
          <span className="spacer" />
          <button className="btn sm" onClick={exportReconciliation} disabled={!recon.rows.length}>Export CSV</button>
        </div>
        <div className="panel-body">
          <div className="small muted mb">
            Actual cement drawn (from fuel logs) vs. expected cement for the pipes actually
            produced (good qty × your plant's per-size standard, using whichever standard was
            effective on each day). Uses the global range above.
          </div>

          {/* optional machine / contractor filters */}
          <div className="row mb">
            <div className="field" style={{ maxWidth: 220 }}>
              <label>Machine (optional)</label>
              <select value={reconMachine} onChange={(e) => setReconMachine(e.target.value)}>
                <option value="">All machines</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{!m.active ? ' (archived)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 240 }}>
              <label>Contractor (optional)</label>
              <select lang="hi" value={reconContractor} onChange={(e) => setReconContractor(e.target.value)}>
                <option value="">All contractors</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{!c.active ? ' (inactive)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* headline numbers — plain, side by side, no colour/flagging */}
          <div className="cards mb">
            <Stat k="Actual cement (bags)" v={recon.actual.toLocaleString()} sub="from fuel logs — consumed" />
            <Stat k="Expected cement (bags)" v={recon.expected.toLocaleString()} sub="good qty × standard" />
            <Stat k="Difference (actual − expected)" v={recon.difference.toLocaleString()} sub="bags" />
          </div>

          <h3>Contractor breakdown</h3>
          {recon.rows.length === 0 ? (
            <div className="empty">Nothing to reconcile in this scope.</div>
          ) : (
            <>
              <div className="grid-wrap">
                <table className="register">
                  <thead>
                    <tr>
                      <th>Contractor · ठेकेदार</th>
                      <th className="num">Cement associated (bags)</th>
                      <th className="num">Expected (bags)</th>
                      <th className="num">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recon.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="rowlabel" lang="hi">{r.name}</td>
                        <td className="num">{r.associated.toLocaleString()}</td>
                        <td className="num">{r.expected.toLocaleString()}</td>
                        <td className="num">{r.difference.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="small muted mt">
                "Cement associated" = cement drawn on machines/days this contractor was tagged on.
                When several contractors are tagged on the same cement draw, the full amount shows
                against each (associated, not split), so the column can total more than the actual
                drawn. "Expected" credits pipes to a contractor via each production row. The two are
                shown for visual comparison only — no automatic flagging.
              </div>
            </>
          )}
        </div>
      </div>

      {selectedContractor && (
        <ContractorDetail
          row={selectedContractor}
          sName={sName}
          onClose={() => setSelectedContractor(null)}
        />
      )}
    </div>
  )
}

function Stat({ k, v, sub }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function ChartBox({ children }) {
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function RateTable({ rows, labelHead }) {
  return (
    <div className="grid-wrap">
      <table className="register">
        <thead>
          <tr>
            <th>{labelHead}</th>
            <th className="num">Good</th>
            <th className="num">Reject</th>
            <th className="num">Reject %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="rowlabel">{r.name}</td>
              <td className="num">{r.good.toLocaleString()}</td>
              <td className="num">{r.reject.toLocaleString()}</td>
              <td className="num">{r.rejectRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Per-contractor detail modal-ish panel.
function ContractorDetail({ row, sName, onClose }) {
  const sizeRows = Object.entries(row.bySize)
    .map(([id, v]) => ({ size: sName[id] || '—', good: v.good, reject: v.reject, rate: rate(v.good, v.reject) }))
    .sort((a, b) => b.good - a.good)
  return (
    <div className="toast" style={{ position: 'fixed', inset: 'auto 10px 10px 10px', left: '50%', transform: 'translateX(-50%)', maxWidth: 560, width: '92vw', background: '#f6f5f1', color: '#1f2420', borderLeftColor: RUST, padding: 0 }}>
      <div className="panel" style={{ margin: 0 }}>
        <div className="panel-head">
          <span lang="hi">{row.name}</span> — detail
          <span className="spacer" />
          <button className="btn sm ghost" onClick={onClose}>Close ✕</button>
        </div>
        <div className="panel-body">
          <div className="cards mb">
            <Stat k="Good" v={row.good.toLocaleString()} />
            <Stat k="Reject" v={row.reject.toLocaleString()} sub={`${row.rejectRate}%`} />
            <Stat k="Days worked" v={row.days} />
            <Stat k="Sizes / Machines" v={`${row.sizes} / ${row.machines}`} />
          </div>
          <h3>By size</h3>
          <RateTable rows={sizeRows.map((s) => ({ name: s.size, good: s.good, reject: s.reject, rejectRate: s.rate }))} labelHead="Size" />
        </div>
      </div>
    </div>
  )
}
