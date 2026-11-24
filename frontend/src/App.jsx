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
import WeekReport from './pages/WeekReport'
import Alarms from './pages/Alarms'
import Settings from './pages/Settings'
import { getMonitoringStatus } from './lib/monitorStatus'

const NAV = [
  { to: '/', label: 'Now', icon: BedDouble },
  { to: '/sleep', label: 'Nights', icon: CalendarDays },
  { to: '/alarms', label: 'Alarms', icon: AlarmClock },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
]

// "Bed online" only when the server answers AND the bed's device sent a reading
// recently. Reaching the server alone doesn't mean the Pi is on.

function Connection() {
  const { live } = useBed()
  const status = getMonitoringStatus(live)

  return (
    <div className="monitor-connection">
      <span
        className={`conn ${status.kind}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status.label}
        <span className="sr-only">
          . {status.detail}
        </span>
      </span>

      <button
        type="button"
        className="btn ghost sm monitor-refresh"
        onClick={() => void live.refresh()}
      >
        Refresh readings
      </button>
    </div>
  )
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
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="topbar">
        <NavLink to="/" className="brand"><BedMark /><span>smartbed</span></NavLink>
        <BedSwitcher />
        <nav className="nav" aria-label="Main">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'}>
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

      <main id="main-content" className="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Tonight />} />
          <Route path="/sleep" element={<Sleep />} />
          <Route path="/sleep/week" element={<WeekReport />} />
          <Route path="/alarms" element={<Alarms />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Tonight />} />
        </Routes>
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={20} strokeWidth={1.75} />{label}
            {to === '/' && urgent > 0 && <span className="badge">{urgent}</span>}
          </NavLink>
        ))}
      </nav>


      {toast && (
        <div
          key={toast.id}
          className={`toast ${toast.kind === 'error' ? 'error' : ''}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          {toast.message}
        </div>
      )}

    </div>
  )
}
