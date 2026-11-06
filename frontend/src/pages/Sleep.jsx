import { Card, PageHead } from '../components/ui'
import { useBed } from '../lib/BedData'
import { clock, duration, nightLabel, parseTime } from '../lib/time'
import NoData from './NoData'

function averageClock(dates) {
  if (!dates.length) return null
  const mins = dates.map((d) => {
    const m = d.getHours() * 60 + d.getMinutes()
    return m < 12 * 60 ? m + 1440 : m
  })
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) % 1440
  return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`
}

export default function Sleep() {
  const { nights, care } = useBed()
  if (!nights.data) return <NoData state={nights} />
  const goal = care.sleepGoalMinutes
  const done = nights.data.filter((n) => !n.in_progress)
  const list = [...nights.data].reverse()

  if (!list.length) return <><PageHead title="No nights recorded yet" /><NoData empty /></>

  const avg = done.length ? done.reduce((a, n) => a + n.in_bed_minutes, 0) / done.length : null
  const exits = done.reduce((a, n) => a + n.bed_exits, 0)
  const metGoal = done.filter((n) => n.in_bed_minutes >= goal).length
  const max = Math.max(goal * 1.15, ...list.map((n) => n.in_bed_minutes))
  const avgTemp = done.length ? (done.reduce((a, n) => a + n.avg_temperature_c, 0) / done.length).toFixed(1) : null

  return (
    <>
      <PageHead kicker={`Goal ${duration(goal)} a night`} title={`The last ${list.length} nights`} />

      <dl className="facts summary">
        <div><dt>Average in bed</dt><dd>{duration(avg)}</dd><p>{metGoal} of {done.length} nights hit the goal</p></div>
        <div><dt>Usual bedtime</dt><dd>{averageClock(done.map((n) => parseTime(n.bedtime))) ?? '—'}</dd><p>up around {averageClock(done.map((n) => parseTime(n.wake))) ?? '—'}</p></div>
        <div><dt>Times up in the night</dt><dd>{exits}</dd><p>{done.length ? (exits / done.length).toFixed(1) : 0} a night</p></div>
        <div><dt>Room while in bed</dt><dd>{avgTemp ?? '—'}{avgTemp && '°C'}</dd><p>average</p></div>
      </dl>

      <Card title="Time in bed" action={
        <div className="legend">
          <span><i className="in" />goal met</span>
          <span><i className="short" />short</span>
        </div>
      }>
        <div className="bars" style={{ '--cols': list.length }}>
          <div className="goal-line" style={{ bottom: `${(goal / max) * 100}%` }}><span>goal</span></div>
          {list.map((n) => (
            <div className="bar-col" key={n.night}>
              <div className={`bar ${n.in_bed_minutes < goal && !n.in_progress ? 'short' : ''} ${n.in_progress ? 'live' : ''}`}
                style={{ height: `${(n.in_bed_minutes / max) * 100}%` }}
                title={`${nightLabel(n.night)}: ${duration(n.in_bed_minutes)}`}>
                <span className="bar-val">{duration(n.in_bed_minutes).replace(' ', '')}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="bar-days" style={{ '--cols': list.length }}>
          {list.map((n) => <span key={n.night}>{n.in_progress ? 'tonight' : nightLabel(n.night).split(' ')[0].replace(',', '')}</span>)}
        </div>
      </Card>

      <Card title="Night by night">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Night of</th><th>Bed</th><th>Up</th><th>In bed</th><th>Times up</th><th>Temp</th></tr></thead>
            <tbody>
              {nights.data.map((n) => (
                <tr key={n.night}>
                  <td>{nightLabel(n.night)}</td>
                  <td className="num">{clock(parseTime(n.bedtime))}</td>
                  <td className="num">{n.in_progress ? <span className="muted">still in bed</span> : clock(parseTime(n.wake))}</td>
                  <td className={`num ${n.in_bed_minutes >= goal ? '' : 'short'}`}>{duration(n.in_bed_minutes)}</td>
                  <td className="num">{n.bed_exits}</td>
                  <td className="num">{n.avg_temperature_c.toFixed(1)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
