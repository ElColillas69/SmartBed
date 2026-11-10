import { clock, duration, parseTime } from '../lib/time'

<<<<<<< HEAD
// Average points into fixed time buckets so bursts of fast readings don't dominate.
=======
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
export function downsample(points, buckets = 60) {
  if (points.length <= buckets) return points
  const t0 = points[0].t
  const size = (points.at(-1).t - t0) / buckets || 1
  const groups = new Map()
  for (const p of points) {
    const k = Math.min(buckets - 1, Math.floor((p.t - t0) / size))
    const g = groups.get(k) ?? { t: 0, v: 0, n: 0 }
    g.t += p.t; g.v += p.v; g.n += 1
    groups.set(k, g)
  }
  return [...groups.values()].map((g) => ({ t: g.t / g.n, v: g.v / g.n }))
}

<<<<<<< HEAD
// Plain trend line, like a pen trace. `band` shades the acceptable range.
=======
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
export function Sparkline({ points: raw, band, color = 'var(--ink)', label, minSpan = 1 }) {
  const points = downsample(raw)
  if (points.length < 2) return <div className="spark" aria-hidden />
  const W = 300
  const H = 48
  const values = points.map((p) => p.v)
  let lo = Math.min(...values, ...(band ?? []))
  let hi = Math.max(...values, ...(band ?? []))
<<<<<<< HEAD
  // A floor on the vertical range keeps sensor jitter from looking like drama.
=======
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
  if (hi - lo < minSpan) { const mid = (hi + lo) / 2; hi = mid + minSpan / 2; lo = mid - minSpan / 2 }
  const t0 = points[0].t
  const span = points.at(-1).t - t0 || 1
  const x = (t) => ((t - t0) / span) * W
  const y = (v) => H - 3 - ((v - lo) / (hi - lo)) * (H - 6)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {band && (
        <rect x="0" width={W} y={y(band[1])} height={Math.max(0, y(band[0]) - y(band[1]))} fill="var(--band)" />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

<<<<<<< HEAD
// Time in bed against the goal, as a ruler with an hour tick.
=======
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
export function GoalBar({ minutes, goal }) {
  const total = Math.max(goal, minutes ?? 0)
  const hours = Math.floor(total / 60)
  return (
    <div className="goal">
      <div className="goal-track" role="img" aria-label={`${duration(minutes)} of a ${duration(goal)} goal`}>
        <span className="goal-fill" style={{ width: `${Math.min(100, ((minutes ?? 0) / total) * 100)}%` }} />
        {Array.from({ length: hours }, (_, i) => (
          <i key={i} style={{ left: `${(((i + 1) * 60) / total) * 100}%` }} />
        ))}
        <b className="goal-mark" style={{ left: `${(goal / total) * 100}%` }} />
      </div>
    </div>
  )
}

<<<<<<< HEAD
// In-bed / out-of-bed timeline. readings are newest first.
=======
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
export function OccupancyStrip({ readings, hours = 8, now = new Date() }) {
  const end = now.getTime()
  const start = end - hours * 3600_000
  const asc = readings
    .map((r) => ({ t: parseTime(r.recorded_at).getTime(), occupied: r.occupied }))
    .filter((r) => r.t >= start)
    .reverse()
  const segments = []
  let cursor = start
  asc.forEach((r, i) => {
    const next = asc[i + 1]?.t ?? end
    if (r.t > cursor) segments.push({ kind: 'gap', from: cursor, to: r.t })
    const to = Math.min(next, r.t + 10 * 60_000) // don't stretch over long silences
    const kind = r.occupied ? 'in' : 'out'
    const prev = segments.at(-1)
    if (prev?.kind === kind && prev.to === r.t) prev.to = to
    else segments.push({ kind, from: r.t, to })
    cursor = to
  })
  if (cursor < end) segments.push({ kind: 'gap', from: cursor, to: end })
  const ticks = Array.from({ length: hours + 1 }, (_, i) => new Date(start + i * 3600_000))
  return (
    <div className="timeline">
      <div className="strip" role="img" aria-label={`Bed occupancy over the last ${hours} hours`}>
        {segments.map((s, i) => (
          <span key={i} className={s.kind} style={{ width: `${((s.to - s.from) / (end - start)) * 100}%` }}
            title={`${s.kind === 'in' ? 'In bed' : s.kind === 'out' ? 'Out of bed' : 'No data'} ${clock(new Date(s.from))}–${clock(new Date(s.to))}`} />
        ))}
      </div>
      <div className="axis">
        {ticks.map((t, i) => (
          <span key={i} style={{ left: `${(i / hours) * 100}%` }}>{i === hours ? 'now' : i % 2 ? '' : clock(t)}</span>
        ))}
      </div>
    </div>
  )
}
