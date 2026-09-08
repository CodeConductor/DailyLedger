import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Single supervisor login (email + password). v1 has no self-signup UI — create
// the supervisor account once in the Supabase dashboard (see SETUP.md).
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          DAILY LEDGER <span className="hi" lang="hi">पाइप रजिस्टर</span>
        </div>
      </div>
      <div className="login-wrap">
        <form className="panel login-card" onSubmit={submit}>
          <div className="panel-head">Supervisor Login · लॉगिन</div>
          <div className="panel-body">
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Password · पासवर्ड</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {err && <div className="err mb">{err}</div>}
            <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In · साइन इन'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
