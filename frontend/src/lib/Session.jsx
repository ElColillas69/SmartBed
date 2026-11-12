// Generated with Claude (Anthropic, 2026).
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, session } from './api'

// Who is logged in, which beds they can see, and which bed is on screen.
const SessionContext = createContext(null)
const BED_KEY = 'smartbed.bed'

function loadBed() {
  try { return localStorage.getItem(BED_KEY) } catch { return null }
}

export function SessionProvider({ children }) {
  const [token, setToken] = useState(session.token)
  const [user, setUser] = useState(null)
  const [beds, setBeds] = useState(null)          // null while loading
  const [bedId, setBedId] = useState(loadBed)

  const logout = useCallback(() => {
    session.setToken(null)
    setToken(null)
    setUser(null)
    setBeds(null)
  }, [])
  useEffect(() => session.onLogout(logout), [logout])

  const loadBeds = useCallback(async () => {
    const list = await api.beds()
    setBeds(list)
    return list
  }, [])

  useEffect(() => {
    if (!token) return
    api.me().then(setUser).catch(() => {})
    loadBeds().catch(() => setBeds([]))
  }, [token, loadBeds])

  const chooseBed = useCallback((id) => {
    setBedId(id)
    try { localStorage.setItem(BED_KEY, id) } catch { /* private mode */ }
  }, [])

  const login = async (email, password) => {
    const { access_token } = await api.login(email, password)
    session.setToken(access_token)
    setToken(access_token)
  }
  const register = async (form) => {
    await api.register(form)
    await login(form.email, form.password)
  }
  const claim = async (code) => {
    const claimed = await api.claim(code)
    await loadBeds()
    chooseBed(claimed.id)
    return claimed
  }

  const bed = beds?.find((b) => b.id === bedId) ?? beds?.[0] ?? null
  // Point the API at this bed before the pages below render and fetch.
  session.setBed(bed?.id ?? null)

  const value = { token, user, beds, bed, chooseBed, login, register, claim, logout }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = () => useContext(SessionContext)
