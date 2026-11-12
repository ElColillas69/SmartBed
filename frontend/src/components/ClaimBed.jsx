// Generated with Claude (Anthropic, 2026).
import { useState } from 'react'
import { useSession } from '../lib/Session'

// Enter the code printed on a bed's Raspberry Pi to get access to that bed.
export default function ClaimBed({ onDone }) {
  const { claim } = useSession()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const bed = await claim(code.trim().toUpperCase())
      setCode('')
      onDone?.(bed)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor="claim-code">Pairing code</label>
        <input id="claim-code" className="input mono" required minLength={4} maxLength={16} autoComplete="off"
          placeholder="MAUREEN1" value={code} onChange={(e) => setCode(e.target.value)} />
        <span className="hint">Printed on the label of the bed's sensor box.</span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>Add bed</button>
    </form>
  )
}
