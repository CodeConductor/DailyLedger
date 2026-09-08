import { createContext, useCallback, useContext, useState } from 'react'

const ToastCtx = createContext(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

// Tiny toast provider. Call toast('message') or toast('message', 'ok').
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const [kind, setKind] = useState('')

  const show = useCallback((message, k = '') => {
    setMsg(message)
    setKind(k)
    // auto-dismiss
    window.clearTimeout(show._t)
    show._t = window.setTimeout(() => setMsg(null), 3200)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className={`toast ${kind}`} role="status">{msg}</div>}
    </ToastCtx.Provider>
  )
}
