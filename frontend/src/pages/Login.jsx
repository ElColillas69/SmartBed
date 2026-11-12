// Generated with Claude (Anthropic, 2026).
import { useState } from 'react'
import { BedMark } from '../components/ui'
import { useSession } from '../lib/Session'

export default function Login() {
  const { login, register } = useSession()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', display_name: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const creating = mode === 'register'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (creating) await register(form)
      else await login(form.email, form.password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="gate">
      <section className="block">
        <div className="gate-brand"><BedMark /><span>smartbed</span></div>
        <h1>{creating ? 'Create an account' : 'Sign in'}</h1>
        <form className="stack" onSubmit={submit}>
          {creating && (
            <div className="field">
              <label htmlFor="l-name">Your name</label>
              <input id="l-name" className="input" required maxLength={80} value={form.display_name} onChange={set('display_name')} />
            </div>
          )}
          <div className="field">
            <label htmlFor="l-email">Email</label>
            <input id="l-email" className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
          </div>
          <div className="field">
            <label htmlFor="l-pass">Password</label>
            <input id="l-pass" className="input" type="password" required minLength={creating ? 8 : undefined}
              autoComplete={creating ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} />
            {creating && <span className="hint">At least 8 characters.</span>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{creating ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="note">
          {creating ? 'Already have an account? ' : 'New here? '}
          <button className="link" type="button" onClick={() => { setMode(creating ? 'login' : 'register'); setError(null) }}>
            {creating ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </section>
    </main>
  )
}
