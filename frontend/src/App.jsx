// Partly generated with Claude (Anthropic, 2026): bed switcher and sign out.
import { NavLink, Route, Routes } from 'react-router-dom'
import { AlarmClock, BedDouble, CalendarDays, SlidersHorizontal } from 'lucide-react'
import ThemeSwitch from './components/ThemeSwitch'
import { BedMark } from './components/ui'
import { useBed } from './lib/BedData'
import { isStale } from './lib/conditions'
import { useSession } from './lib/Session'
import Tonight from './pages/Tonight'
import Sleep from './pages/Sleep'
import Alarms from './pages/Alarms'
import Settings from './pages/Settings'

const NAV = [
  { to: '/', label: 'Now', icon: BedDouble },
  { to: '/sleep', label: 'Nights', icon: CalendarDays },
  { to: '/alarms', label: 'Alarms', icon: AlarmClock },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
]

// "Bed online" only when the server answers AND the bed's device sent a reading
// recently. Reaching the server alone doesn't mean the Pi is on.
function Connection() {
  const { connected, live } = useBed()
  const latest = live.data?.latest
  const fresh = connected && latest && !isStale(latest)
  const state = fresh ? 'ok' : connected ? 'stale' : live.loading ? 'wait' : 'down'
  const text = { ok: 'Bed online', stale: 'No recent readings', wait: 'Connecting…', down: 'Server offline' }
  return <span className={`conn ${state}`}>{text[state]}</span>
}

// Shows whose room this is; a dropdown when the account can see several beds.
function BedSwitcher() {
  const { beds, bed, chooseBed } = useSession()
  const { care } = useBed()
  if (beds.length < 2) return <span className="who">{care.residentName}’s room</span>
  return (
    <label className="who">
      <span className="sr-only">Bed</span>
      <select className="bed-select" value={bed.id} onChange={(e) => chooseBed(e.target.value)}>
        {beds.map((b) => <option key={b.id} value={b.id}>{b.resident_name}’s room</option>)}
      </select>
    </label>
  )
}

export default function App() {
  const { conditions, toast } = useBed()
  const { logout } = useSession()
  const urgent = conditions.filter((c) => c.level !== 'info').length

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand"><BedMark /><span>smartbed</span></NavLink>
        <BedSwitcher />
        <nav className="nav" aria-label="Main">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} end>
              {label}
              {to === '/' && urgent > 0 && <span className="badge">{urgent}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-end">
          <Connection />
          <ThemeSwitch />
          <button className="btn ghost sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Tonight />} />
          <Route path="/sleep" element={<Sleep />} />
          <Route path="/alarms" element={<Alarms />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Tonight />} />
        </Routes>
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end>
            <Icon size={20} strokeWidth={1.75} />{label}
            {to === '/' && urgent > 0 && <span className="badge">{urgent}</span>}
          </NavLink>
        ))}
      </nav>

      {toast && <div key={toast.id} className={`toast ${toast.kind === 'error' ? 'error' : ''}`} role="status">{toast.message}</div>}
    </div>
  )
}
