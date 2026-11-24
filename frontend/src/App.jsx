
import { NavLink, Route, Routes } from 'react-router-dom'
import ComfortHeader, { PRIMARY_NAV } from './components/ComfortHeader'
import { useBed } from './lib/BedData'
import Tonight from './pages/Tonight'
import Sleep from './pages/Sleep'
import WeekReport from './pages/WeekReport'
import Alarms from './pages/Alarms'
import Settings from './pages/Settings'
import './comfort-header.css'

export default function App() {
  const { conditions, toast } = useBed()

  const urgentCount = (conditions ?? []).filter(
    (condition) =>
      condition.level === 'critical' ||
      condition.level === 'warning'
  ).length

  return (
    <div className="app comfort-app">

      {/* Keyboard accessibility */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {/* New comfort-themed header */}
      <ComfortHeader urgentCount={urgentCount} />

      {/* Existing SmartBed pages */}
      <main
        id="main-content"
        className="main"
        tabIndex={-1}
      >
        <Routes>
          <Route path="/" element={<Tonight />} />
          <Route path="/sleep" element={<Sleep />} />
          <Route
            path="/sleep/week"
            element={<WeekReport />}
          />
          <Route path="/alarms" element={<Alarms />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Tonight />} />
        </Routes>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        className="tabbar comfort-mobile-tabbar"
        aria-label="Mobile navigation"
      >
        {PRIMARY_NAV.map(({
          to,
          mobileLabel,
          icon: Icon,
        }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/sleep'}
          >
            <Icon
              size={20}
              strokeWidth={1.9}
              aria-hidden="true"
            />

            {mobileLabel}

            {to === '/' && urgentCount > 0 && (
              <span
                className="badge"
                aria-label={`${urgentCount} notices`}
              >
                {urgentCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Notifications */}
      {toast && (
        <div
          key={toast.id}
          className={`toast ${toast.kind === 'error' ? 'error' : ''
            }`}
          role={
            toast.kind === 'error'
              ? 'alert'
              : 'status'
          }
        >
          {toast.message}
        </div>
      )}

    </div>
  )
}
