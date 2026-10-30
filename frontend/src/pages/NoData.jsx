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
          <p>Connect the bed's Raspberry Pi, or try it with demo data:<br />
            <code>python seed_demo.py</code> then <code>python simulate.py</code></p>
        </>
      ) : (
        <>
          <h3>Can't reach the bed</h3>
          <p>{state?.error?.message}.<br />
            {state?.error?.status === 401
              ? <>Check <code>API_KEY</code> in <code>backend/.env</code> and restart <code>npm run dev</code>.</>
              : <>Start the backend with <code>python run.py</code>. This page keeps retrying.</>}
          </p>
        </>
      )}
    </div>
  )
}
