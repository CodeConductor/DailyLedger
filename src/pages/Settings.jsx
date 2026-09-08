import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useMasters } from '../lib/useMasters'
import { useToast } from '../components/Toast'
import { CATEGORIES, DEFAULT_ORG_ID, categoryTagClass } from '../lib/constants'
import { buildStandardResolver } from '../lib/cementStandards'
import { todayISO } from '../lib/dates'

export default function Settings() {
  const toast = useToast()
  const { machines, sizes, contractors, settings, loading, reload } = useMasters({ activeOnly: false })

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <MachineSettings machines={machines} reload={reload} toast={toast} />
      <SizeSettings sizes={sizes} reload={reload} toast={toast} />
      <CementStandardSettings sizes={sizes} toast={toast} />
      <ContractorSettings contractors={contractors} reload={reload} toast={toast} />
      <RawMaterialSettings settings={settings} reload={reload} toast={toast} />
    </div>
  )
}

// ---- Machines ---------------------------------------------------------------
function MachineSettings({ machines, reload, toast }) {
  const [name, setName] = useState('')

  async function add() {
    const n = name.trim()
    if (!n) return
    const { error } = await supabase.from('machines').insert({ name: n, org_id: DEFAULT_ORG_ID })
    if (error) return toast(error.message)
    setName('')
    await reload()
    toast('Machine added', 'ok')
  }
  async function rename(m) {
    const n = window.prompt('Rename machine', m.name)
    if (n == null) return
    const t = n.trim()
    if (!t) return
    const { error } = await supabase.from('machines').update({ name: t }).eq('id', m.id)
    if (error) return toast(error.message)
    await reload()
  }
  async function toggle(m) {
    const { error } = await supabase.from('machines').update({ active: !m.active }).eq('id', m.id)
    if (error) return toast(error.message)
    await reload()
  }

  return (
    <div className="panel">
      <div className="panel-head">Machines · मशीन</div>
      <div className="panel-body">
        <div className="flex wrap mb">
          <input placeholder="New machine name" style={{ maxWidth: 260 }}
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <button className="btn" onClick={add}>+ Add</button>
        </div>
        <ListTable
          rows={machines}
          render={(m) => (
            <>
              <td className="rowlabel">{m.name}</td>
              <td>{m.active ? <span className="ok">Active</span> : <span className="muted">Archived</span>}</td>
              <td className="center">
                <button className="btn sm ghost" onClick={() => rename(m)}>Rename</button>{' '}
                <button className="btn sm ghost" onClick={() => toggle(m)}>{m.active ? 'Archive' : 'Restore'}</button>
              </td>
            </>
          )}
        />
      </div>
    </div>
  )
}

// ---- Pipe sizes -------------------------------------------------------------
function SizeSettings({ sizes, reload, toast }) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('S&S')

  async function add() {
    const l = label.trim()
    if (!l) return
    const maxOrder = sizes.reduce((m, s) => Math.max(m, s.sort_order || 0), 0)
    const { error } = await supabase.from('pipe_sizes').insert({
      label: l, category, sort_order: maxOrder + 10, org_id: DEFAULT_ORG_ID,
    })
    if (error) return toast(error.message)
    setLabel('')
    await reload()
    toast('Size added', 'ok')
  }
  async function rename(s) {
    const n = window.prompt('Rename size label', s.label)
    if (n == null) return
    const t = n.trim()
    if (!t) return
    const { error } = await supabase.from('pipe_sizes').update({ label: t }).eq('id', s.id)
    if (error) return toast(error.message)
    await reload()
  }
  async function setCat(s, cat) {
    const { error } = await supabase.from('pipe_sizes').update({ category: cat }).eq('id', s.id)
    if (error) return toast(error.message)
    await reload()
  }
  async function toggle(s) {
    const { error } = await supabase.from('pipe_sizes').update({ active: !s.active }).eq('id', s.id)
    if (error) return toast(error.message)
    await reload()
  }

  return (
    <div className="panel">
      <div className="panel-head">Pipe Sizes / Categories · पाइप साइज़</div>
      <div className="panel-body">
        <div className="flex wrap mb">
          <input placeholder="e.g. 1200/3" style={{ maxWidth: 160 }}
            value={label} onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <select style={{ maxWidth: 140 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn" onClick={add}>+ Add</button>
        </div>
        <ListTable
          rows={sizes}
          render={(s) => (
            <>
              <td className="rowlabel">
                {s.label} <span className={categoryTagClass(s.category)}>{s.category}</span>
              </td>
              <td>
                <select value={s.category} onChange={(e) => setCat(s, e.target.value)} style={{ maxWidth: 130 }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td className="center">
                <button className="btn sm ghost" onClick={() => rename(s)}>Rename</button>{' '}
                <button className="btn sm ghost" onClick={() => toggle(s)}>{s.active ? 'Archive' : 'Restore'}</button>
              </td>
            </>
          )}
        />
      </div>
    </div>
  )
}

// ---- Contractors ------------------------------------------------------------
function ContractorSettings({ contractors, reload, toast }) {
  const [name, setName] = useState('')

  async function add() {
    const n = name.trim()
    if (!n) return
    const { error } = await supabase.from('contractors').insert({ name: n, org_id: DEFAULT_ORG_ID })
    if (error) return toast(error.message)
    setName('')
    await reload()
    toast('Contractor added', 'ok')
  }
  async function rename(c) {
    const n = window.prompt('Rename contractor', c.name)
    if (n == null) return
    const t = n.trim()
    if (!t) return
    const { error } = await supabase.from('contractors').update({ name: t }).eq('id', c.id)
    if (error) return toast(error.message)
    await reload()
  }
  async function toggle(c) {
    const { error } = await supabase.from('contractors').update({ active: !c.active }).eq('id', c.id)
    if (error) return toast(error.message)
    await reload()
  }

  return (
    <div className="panel">
      <div className="panel-head">Contractors · ठेकेदार</div>
      <div className="panel-body">
        <div className="small muted mb">
          Contractors are never deleted — only marked inactive — so historical reports keep their name.
        </div>
        <div className="flex wrap mb">
          <input lang="hi" placeholder="New contractor · नया नाम" style={{ maxWidth: 260 }}
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <button className="btn" onClick={add}>+ Add</button>
        </div>
        <ListTable
          rows={contractors}
          render={(c) => (
            <>
              <td className="rowlabel" lang="hi">{c.name}</td>
              <td>{c.active ? <span className="ok">Active</span> : <span className="muted">Inactive</span>}</td>
              <td className="center">
                <button className="btn sm ghost" onClick={() => rename(c)}>Rename</button>{' '}
                <button className="btn sm ghost" onClick={() => toggle(c)}>{c.active ? 'Deactivate' : 'Reactivate'}</button>
              </td>
            </>
          )}
        />
      </div>
    </div>
  )
}

// ---- Raw material field toggles --------------------------------------------
function RawMaterialSettings({ settings, reload, toast }) {
  const [fields, setFields] = useState(settings?.raw_material_fields || [])
  const [newKey, setNewKey] = useState('')
  const [newEn, setNewEn] = useState('')
  const [newHi, setNewHi] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setFields(settings?.raw_material_fields || []), [settings])

  function toggle(i) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, enabled: !f.enabled } : f)))
  }
  function addField() {
    const key = newKey.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    const en = newEn.trim()
    if (!key || !en) return toast('Field needs a key and an English label.')
    if (fields.some((f) => f.key === key)) return toast('That key already exists.')
    setFields((prev) => [...prev, { key, label_en: en, label_hi: newHi.trim() || en, enabled: true }])
    setNewKey(''); setNewEn(''); setNewHi('')
  }
  function removeField(i) {
    setFields((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('app_settings')
      .update({ raw_material_fields: fields })
      .eq('org_id', DEFAULT_ORG_ID)
    setSaving(false)
    if (error) return toast(error.message)
    await reload()
    toast('Raw-material fields saved', 'ok')
  }

  return (
    <div className="panel">
      <div className="panel-head">
        Raw Material Fields · कच्चा माल
        <span className="spacer" />
        <button className="btn sm primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="panel-body">
        <div className="small muted mb">
          Toggle which optional numeric fields appear in the entry form's raw-materials section.
        </div>
        <div className="grid-wrap mb">
          <table className="register">
            <thead>
              <tr><th>Key</th><th>Label (EN)</th><th>Label (HI)</th><th className="center">Tracked</th><th></th></tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={f.key}>
                  <td className="rowlabel">{f.key}</td>
                  <td>{f.label_en}</td>
                  <td lang="hi">{f.label_hi}</td>
                  <td className="center">
                    <input type="checkbox" style={{ width: 22, minHeight: 22 }} checked={!!f.enabled} onChange={() => toggle(i)} />
                  </td>
                  <td className="center">
                    <button className="btn sm ghost" onClick={() => removeField(i)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row">
          <div className="field" style={{ maxWidth: 160 }}>
            <label>New key</label>
            <input placeholder="e.g. 40mm" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 180 }}>
            <label>Label (EN)</label>
            <input value={newEn} onChange={(e) => setNewEn(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 180 }}>
            <label>Label (HI)</label>
            <input lang="hi" value={newHi} onChange={(e) => setNewHi(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 120, display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn" onClick={addField}>+ Add field</button>
          </div>
        </div>
        <div className="small muted">Remember to press <strong>Save</strong> after changes.</div>
      </div>
    </div>
  )
}

// ---- Cement standards (bags per pipe, effective-dated) ----------------------
function CementStandardSettings({ sizes, toast }) {
  const today = todayISO()
  const [standards, setStandards] = useState([])
  const [draft, setDraft] = useState({}) // pipe_size_id -> string value
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const activeSizes = useMemo(() => sizes.filter((s) => s.active), [sizes])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('cement_standards').select('*')
    setLoading(false)
    if (error) return toast(error.message)
    setStandards(data || [])
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Value currently in effect (today) per size — this is what we edit against.
  const resolver = useMemo(() => buildStandardResolver(standards), [standards])
  const currentBySize = useMemo(() => {
    const m = {}
    for (const s of activeSizes) m[s.id] = resolver(s.id, today)
    return m
  }, [activeSizes, resolver, today])

  // Initialise the draft from the current values whenever they change.
  useEffect(() => {
    const d = {}
    for (const s of activeSizes) d[s.id] = String(currentBySize[s.id] ?? 0)
    setDraft(d)
  }, [activeSizes, currentBySize])

  function setVal(id, v) {
    setDraft((prev) => ({ ...prev, [id]: v }))
  }

  async function save() {
    // Only insert new rows for sizes whose value actually changed — each insert
    // is a new effective-dated version (history preserved, past reports intact).
    const changed = activeSizes.filter((s) => {
      const cur = Number(currentBySize[s.id] ?? 0)
      const next = Number(draft[s.id])
      return !Number.isNaN(next) && next >= 0 && next !== cur
    })
    if (!changed.length) return toast('No changes to save.')
    setSaving(true)
    const rows = changed.map((s) => ({
      org_id: DEFAULT_ORG_ID,
      pipe_size_id: s.id,
      bags_per_pipe: Number(draft[s.id]),
      effective_date: effectiveDate,
    }))
    const { error } = await supabase.from('cement_standards').insert(rows)
    setSaving(false)
    if (error) return toast(error.message)
    await load()
    toast(`Saved ${changed.length} standard(s), effective ${effectiveDate}`, 'ok')
  }

  return (
    <div className="panel">
      <div className="panel-head">
        Cement Standard · सीमेंट मानक
        <span className="spacer" />
        <button className="btn sm primary" onClick={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="panel-body">
        <div className="small muted mb">
          Enter your plant's own standard cement usage per pipe for each size. Used to
          calculate expected cement consumption for reconciliation reports. There is no
          universal figure — it depends on your mix design and pipe wall volume, so get
          these from your QC / mix-design staff.
        </div>
        <div className="row mb">
          <div className="field" style={{ maxWidth: 220 }}>
            <label>New values effective from</label>
            <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            <div className="small muted">
              Editing creates a new version from this date. Past reports keep the older standard.
            </div>
          </div>
        </div>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : activeSizes.length === 0 ? (
          <div className="empty">Add pipe sizes first.</div>
        ) : (
          <div className="grid-wrap">
            <table className="register">
              <thead>
                <tr>
                  <th>Pipe Size</th>
                  <th className="num">Currently effective (bags/pipe)</th>
                  <th className="num">New value (bags/pipe)</th>
                </tr>
              </thead>
              <tbody>
                {activeSizes.map((s) => {
                  const cur = Number(currentBySize[s.id] ?? 0)
                  const changed = Number(draft[s.id]) !== cur && draft[s.id] !== undefined
                  return (
                    <tr key={s.id}>
                      <td className="rowlabel">
                        {s.label} <span className={categoryTagClass(s.category)}>{s.category}</span>
                      </td>
                      <td className="num">{cur}</td>
                      <td className="num">
                        <input
                          type="number" min="0" step="0.0001" inputMode="decimal"
                          aria-invalid={Number(draft[s.id]) < 0}
                          style={changed ? { borderColor: 'var(--rust)' } : undefined}
                          value={draft[s.id] ?? ''}
                          onChange={(e) => setVal(s.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- shared tiny list table -------------------------------------------------
function ListTable({ rows, render }) {
  if (!rows.length) return <div className="empty">Nothing yet.</div>
  return (
    <div className="grid-wrap">
      <table className="register">
        <thead>
          <tr><th>Name</th><th>Status / Category</th><th className="center">Actions</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => <tr key={r.id}>{render(r)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}
