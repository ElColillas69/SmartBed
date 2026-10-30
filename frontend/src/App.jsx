import { NavLink, Route, Routes } from 'react-router-dom'
import { AlarmClock, BedDouble, CalendarDays, SlidersHorizontal } from 'lucide-react'
import ThemeSwitch from './components/ThemeSwitch'
import { BedMark } from './components/ui'
import { useBed } from './lib/BedData'
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

function Connection() {
  const { connected, live } = useBed()
  const state = connected ? 'ok' : live.loading ? 'wait' : 'down'
  return (
    <span className={`conn ${state}`}>
      {connected ? 'Bed online' : live.loading ? 'Connecting…' : 'Bed offline'}
    </span>
  )
}

export default function App() {
  const { care, conditions, toast } = useBed()
  const urgent = conditions.filter((c) => c.level !== 'info').length

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand"><BedMark /><span>smartbed</span></NavLink>
        <span className="who">{care.residentName}’s room</span>
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
