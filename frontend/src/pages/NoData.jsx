// Partly generated with Claude (Anthropic, 2026): new run instructions.
import { BedMark } from '../components/ui'

export default function NoData({ state, empty }) {
  if (state?.loading) {
    return (
      <div className="loading" aria-busy="true">
        <div className="skeleton" style={{ height: 96 }} />
        <div className="skeleton" style={{ height: 140 }} />
        <div className="skeleton" />
      </div>
    )
  }
  return (
    <div className="empty">
      <BedMark className="empty-mark" />
      {empty ? (
        <>
          <h3>No readings yet</h3>
          <p>Switch on the bed's Raspberry Pi, or try it with fake data:<br />
            <code>python simulate.py --include-maureen</code></p>
        </>
      ) : (
        <>
          <h3>Can't reach the bed</h3>
          <p>{state?.error?.message}.<br />
            Start the backend with <code>fastapi dev app/main.py</code> in <code>backend-fastapi</code>. This page keeps retrying.
          </p>
        </>
      )}
    </div>
  )
}
