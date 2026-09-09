import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useMasters } from '../lib/useMasters'
import { useToast } from '../components/Toast'
import {
  DEFAULT_ORG_ID,
  DEFAULT_PIPE_TYPES,
  DEFAULT_PIPE_CLASSES,
  pipeLabel,
  typeTagClass,
} from '../lib/constants'
import { buildStandardResolver } from '../lib/cementStandards'
import { todayISO } from '../lib/dates'

export default function Settings() {
  const toast = useToast()
  const { machines, pipes, contractors, settings, loading, reload } = useMasters({ activeOnly: false })

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div>
      <MachineSettings machines={machines} reload={reload} toast={toast} />
      <TypeClassSettings settings={settings} reload={reload} toast={toast} />
      <PipeSettings pipes={pipes} settings={settings} reload={reload} toast={toast} />
      <CementStandardSettings pipes={pipes} toast={toast} />
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

// ---- Type & Class editable lists (stored in app_settings) -------------------
function TypeClassSettings({ settings, reload, toast }) {
  const [types, setTypes] = useState([])
  const [classes, setClasses] = useState([])
  const [newType, setNewType] = useState('')
  const [newClass, setNewClass] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTypes(settings?.pipe_types?.length ? settings.pipe_types : DEFAULT_PIPE_TYPES)
    setClasses(settings?.pipe_classes?.length ? settings.pipe_classes : DEFAULT_PIPE_CLASSES)
  }, [settings])

  function addTo(list, setList, value, resetter) {
    const v = value.trim()
    if (!v) return
    if (list.includes(v)) return toast('That value already exists.')
    setList([...list, v])
    resetter('')
  }
  function removeFrom(list, setList, value) {
    setList(list.filter((x) => x !== value))
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('app_settings')
      .update({ pipe_types: types, pipe_classes: classes })
      .eq('org_id', DEFAULT_ORG_ID)
    setSaving(false)
    if (error) return toast(error.message)
    await reload()
    toast('Type & Class lists saved', 'ok')
  }

  return (
    <div className="panel">
      <div className="panel-head">
        Pipe Type &amp; Class lists · प्रकार व श्रेणी
        <span className="spacer" />
        <button className="btn sm primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="panel-body">
        <div className="small muted mb">
          These lists fill the Type and Class dropdowns when adding a pipe below. Add or remove
          values as needed, then press <strong>Save</strong>. Removing a value here does not affect
          pipes already created with it.
        </div>
        <div className="row">
          <div className="field">
            <label>Types</label>
            <div className="flex wrap mb">
              {types.map((t) => (
                <span className="chip" key={t}>
                  {t} <span className="x" onClick={() => removeFrom(types, setTypes, t)}>✕</span>
                </span>
              ))}
            </div>
            <div className="flex wrap">
              <input placeholder="e.g. Plain" style={{ maxWidth: 180 }}
                value={newType} onChange={(e) => setNewType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTo(types, setTypes, newType, setNewType))} />
              <button className="btn" onClick={() => addTo(types, setTypes, newType, setNewType)}>+ Add type</button>
            </div>
          </div>
          <div className="field">
            <label>Classes</label>
            <div className="flex wrap mb">
              {classes.map((c) => (
                <span className="chip" key={c}>
                  {c} <span className="x" onClick={() => removeFrom(classes, setClasses, c)}>✕</span>
                </span>
              ))}
            </div>
            <div className="flex wrap">
              <input placeholder="e.g. NP2" style={{ maxWidth: 180 }}
                value={newClass} onChange={(e) => setNewClass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTo(classes, setClasses, newClass, setNewClass))} />
              <button className="btn" onClick={() => addTo(classes, setClasses, newClass, setNewClass)}>+ Add class</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Pipes (size + type + class) --------------------------------------------
function PipeSettings({ pipes, settings, reload, toast }) {
  const typeOpts = settings?.pipe_types?.length ? settings.pipe_types : DEFAULT_PIPE_TYPES
  const classOpts = settings?.pipe_classes?.length ? settings.pipe_classes : DEFAULT_PIPE_CLASSES

  const [sizeMm, setSizeMm] = useState('')
  const [type, setType] = useState('')
  const [klass, setKlass] = useState('')

  // Default the type/class selects to the first available option.
  useEffect(() => { if (!type && typeOpts.length) setType(typeOpts[0]) }, [typeOpts, type])
  useEffect(() => { if (!klass && classOpts.length) setKlass(classOpts[0]) }, [classOpts, klass])

  async function add() {
    const size = parseInt(sizeMm, 10)
    if (!Number.isInteger(size) || size <= 0) return toast('Enter a valid size in mm.')
    if (!type || !klass) return toast('Pick a type and a class.')
    const { error } = await supabase.from('pipes').insert({
      size_mm: size, type, class: klass, org_id: DEFAULT_ORG_ID,
    })
    if (error) {
      // 23505 = unique violation (this exact size/type/class already exists)
      return toast(error.code === '23505' ? 'That pipe already exists.' : error.message)
    }
    setSizeMm('')
    await reload()
    toast('Pipe added', 'ok')
  }
  async function toggle(p) {
    const { error } = await supabase.from('pipes').update({ active: !p.active }).eq('id', p.id)
    if (error) return toast(error.message)
    await reload()
  }
  async function del(p) {
    if (!window.confirm(`Delete ${pipeLabel(p)}? This cannot be undone.`)) return
    const { error } = await supabase.from('pipes').delete().eq('id', p.id)
    if (error) {
      // 23503 = FK violation: pipe is referenced by production entries
      return toast(
        error.code === '23503'
          ? 'This pipe is used in production entries — archive it instead of deleting.'
          : error.message
      )
    }
    await reload()
    toast('Pipe deleted', 'ok')
  }

  return (
    <div className="panel">
      <div className="panel-head">Pipes · पाइप (Size · Type · Class)</div>
      <div className="panel-body">
        <div className="small muted mb">
          A pipe is one full spec: Size (mm) + Type + Class. Add the ones you make; archive pipes
          you no longer run (kept for old reports), or delete an unused one outright.
        </div>
        <div className="flex wrap mb">
          <input type="number" min="1" step="1" inputMode="numeric" placeholder="Size mm (e.g. 150)"
            style={{ maxWidth: 160 }} value={sizeMm} onChange={(e) => setSizeMm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <select style={{ maxWidth: 150 }} value={type} onChange={(e) => setType(e.target.value)}>
            {typeOpts.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select style={{ maxWidth: 130 }} value={klass} onChange={(e) => setKlass(e.target.value)}>
            {classOpts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn" onClick={add}>+ Add</button>
        </div>
        {pipes.length === 0 ? (
          <div className="empty">No pipes yet — add one above.</div>
        ) : (
          <div className="grid-wrap">
            <table className="register">
              <thead>
                <tr><th>Pipe</th><th>Status</th><th className="center">Actions</th></tr>
              </thead>
              <tbody>
                {pipes.map((p) => (
                  <tr key={p.id}>
                    <td className="rowlabel">
                      {p.size_mm}mm{' '}
                      <span className={typeTagClass(p.type)}>{p.type}</span>{' '}
                      <span className="tag">{p.class}</span>
                    </td>
                    <td>{p.active ? <span className="ok">Active</span> : <span className="muted">Archived</span>}</td>
                    <td className="center">
                      <button className="btn sm ghost" onClick={() => toggle(p)}>{p.active ? 'Archive' : 'Restore'}</button>{' '}
                      <button className="btn sm ghost" onClick={() => del(p)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

// ---- Cement standards (bags per pipe, per Size + Class, effective-dated) -----
function CementStandardSettings({ pipes, toast }) {
  const today = todayISO()
  const [standards, setStandards] = useState([])
  const [draft, setDraft] = useState({}) // `${size_mm}|${class}` -> string value
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Distinct (size_mm, class) combinations from active pipes — type is ignored.
  const combos = useMemo(() => {
    const seen = new Map()
    for (const p of pipes.filter((x) => x.active)) {
      const key = `${p.size_mm}|${p.class}`
      if (!seen.has(key)) seen.set(key, { key, size_mm: p.size_mm, class: p.class })
    }
    return [...seen.values()].sort((a, b) => a.size_mm - b.size_mm || (a.class < b.class ? -1 : 1))
  }, [pipes])

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

  const resolver = useMemo(() => buildStandardResolver(standards), [standards])
  const currentByCombo = useMemo(() => {
    const m = {}
    for (const c of combos) m[c.key] = resolver(c.size_mm, c.class, today)
    return m
  }, [combos, resolver, today])

  // Initialise the draft from the current values whenever they change.
  useEffect(() => {
    const d = {}
    for (const c of combos) d[c.key] = String(currentByCombo[c.key] ?? 0)
    setDraft(d)
  }, [combos, currentByCombo])

  function setVal(key, v) {
    setDraft((prev) => ({ ...prev, [key]: v }))
  }

  async function save() {
    // Only insert new rows for combos whose value actually changed — each insert
    // is a new effective-dated version (history preserved, past reports intact).
    const changed = combos.filter((c) => {
      const cur = Number(currentByCombo[c.key] ?? 0)
      const next = Number(draft[c.key])
      return !Number.isNaN(next) && next >= 0 && next !== cur
    })
    if (!changed.length) return toast('No changes to save.')
    setSaving(true)
    const rows = changed.map((c) => ({
      org_id: DEFAULT_ORG_ID,
      size_mm: c.size_mm,
      class: c.class,
      bags_per_pipe: Number(draft[c.key]),
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
          Enter your plant's own standard cement usage per pipe, per Size + Class (Type is not used
          — cement depends on bore and strength class). Used to calculate expected cement for
          reconciliation reports. There is no universal figure — get these from your QC / mix-design
          staff.
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
        ) : combos.length === 0 ? (
          <div className="empty">Add pipes first — standards are listed per size + class.</div>
        ) : (
          <div className="grid-wrap">
            <table className="register">
              <thead>
                <tr>
                  <th>Size · Class</th>
                  <th className="num">Currently effective (bags/pipe)</th>
                  <th className="num">New value (bags/pipe)</th>
                </tr>
              </thead>
              <tbody>
                {combos.map((c) => {
                  const cur = Number(currentByCombo[c.key] ?? 0)
                  const changed = Number(draft[c.key]) !== cur && draft[c.key] !== undefined
                  return (
                    <tr key={c.key}>
                      <td className="rowlabel">
                        {c.size_mm}mm <span className="tag">{c.class}</span>
                      </td>
                      <td className="num">{cur}</td>
                      <td className="num">
                        <input
                          type="number" min="0" step="0.0001" inputMode="decimal"
                          aria-invalid={Number(draft[c.key]) < 0}
                          style={changed ? { borderColor: 'var(--rust)' } : undefined}
                          value={draft[c.key] ?? ''}
                          onChange={(e) => setVal(c.key, e.target.value)}
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
          <tr><th>Name</th><th>Status</th><th className="center">Actions</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => <tr key={r.id}>{render(r)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}
