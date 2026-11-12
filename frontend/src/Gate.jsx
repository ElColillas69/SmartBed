// Generated with Claude (Anthropic, 2026).
import App from './App'
import ClaimBed from './components/ClaimBed'
import { BedMark } from './components/ui'
import { BedDataProvider } from './lib/BedData'
import { useSession } from './lib/Session'
import Login from './pages/Login'

// Decides what to show: login, "add your first bed", or the dashboard.
export default function Gate() {
  const { token, beds, bed, user, logout } = useSession()

  if (!token) return <Login />
  if (beds === null) return <main className="gate"><div className="skeleton" style={{ width: 'min(420px, 100%)' }} /></main>
  if (!bed) {
    return (
      <main className="gate">
        <section className="block">
          <div className="gate-brand"><BedMark /><span>smartbed</span></div>
          <h1>Add a bed</h1>
          <p className="note">{user ? `Signed in as ${user.email}. ` : ''}You don't have access to any beds yet.</p>
          <ClaimBed />
          <p className="note"><button className="link" type="button" onClick={logout}>Sign out</button></p>
        </section>
      </main>
    )
  }
  // key={bed.id}: switching beds throws away the old bed's data and starts fresh.
  return (
    <BedDataProvider key={bed.id} bed={bed}>
      <App />
    </BedDataProvider>
  )
}
