import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { supabase, isConfigured } from './lib/supabaseClient'
import { ToastProvider } from './components/Toast'
import Login from './components/Login'
import EntryForm from './pages/EntryForm'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

// Shown when env vars are missing — avoids a confusing blank/error screen.
function SetupNeeded() {
  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <div className="panel-head">Setup needed · सेटअप</div>
        <div className="panel-body small">
          <p>
            Supabase keys are not configured. Copy <code>.env.example</code> to{' '}
            <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.
          </p>
          <p className="muted">See <strong>SETUP.md</strong> for step-by-step instructions.</p>
        </div>
      </div>
    </div>
  )
}

function Shell({ session }) {
  const email = session?.user?.email || ''
  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          DAILY LEDGER <span className="hi" lang="hi">पाइप रजिस्टर</span>
        </div>
        <div className="spacer" />
        <span className="who">{email}</span>
        <button className="btn sm ghost" onClick={() => supabase.auth.signOut()}>
          Logout
        </button>
      </div>
      <nav className="tabs">
        <NavLink to="/entry" className={({ isActive }) => (isActive ? 'active' : '')}>
          Daily Entry · दैनिक
        </NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
          Reports · रिपोर्ट
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          Settings · सेटिंग
        </NavLink>
      </nav>
      <div className="content">
        <Routes>
          <Route path="/entry" element={<EntryForm />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/entry" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isConfigured) {
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="brand">DAILY LEDGER</div>
        </div>
        <SetupNeeded />
      </div>
    )
  }

  if (!ready) return <div className="loading">Loading…</div>

  return (
    <ToastProvider>
      {session ? <Shell session={session} /> : <Login />}
    </ToastProvider>
  )
}
