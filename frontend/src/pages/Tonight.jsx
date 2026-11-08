import { useEffect, useRef, useState } from 'react'
import { Card, Stepper, Switch } from '../components/ui'
import { GoalBar, OccupancyStrip, Sparkline } from '../components/charts'
import Conditions from '../components/Conditions'
import { api } from '../lib/api'
import { useBed } from '../lib/BedData'
import { isStale, lastChange, lightLabel, tempRange } from '../lib/conditions'
import { ago, agoText, clock, duration, nextAlarm, parseTime } from '../lib/time'
import NoData from './NoData'

function Readout({ label, value, unit, note, children }) {
  return (
    <div className="readout">
      <h2>{label}</h2>
      <div className="reading">{value}{unit && <small>{unit}</small>}</div>
      <div className="note">{note}</div>
      {children}
    </div>
  )
}

function useDebouncedTarget(saved, save) {
  const [pending, setPending] = useState(null)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  const change = (v) => {
    setPending(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await save(v)
      setPending(null)
    }, 600)
  }
  return [pending ?? saved, change]
}

export default function Tonight() {
  const { live, prefs, nights, alarms, care, conditions, act } = useBed()
  const now = new Date()
  const pref = prefs.data
  const savePref = (changes, msg) => act(() => api.updatePreferences(changes), msg, prefs.refresh, live.refresh)
  const [target, setTarget] = useDebouncedTarget(pref?.target_temperature_c, (v) => savePref({ target_temperature_c: v }))

  if (!live.data) return <NoData state={live} />
  const { latest, readings, commands } = live.data
  if (!latest) return <NoData empty />

  const change = lastChange(readings)
  const critical = conditions.some((c) => c.level === 'critical')
  const updated = parseTime(latest.recorded_at)
  const stale = isStale(latest, now)
  const silentFor = agoText((now - updated) / 60000)
  const series = (key) => readings.map((r) => ({ t: parseTime(r.recorded_at).getTime(), v: r[key] })).reverse()
  const tonight = nights.data?.[0]
  const alarm = nextAlarm(alarms.data, now)
  const refreshAlarms = () => Promise.all([live.refresh(), alarms.refresh()])
  const state = critical ? 'alert' : stale ? 'stale' : latest.occupied ? 'in' : 'out'
  const where = latest.occupied ? 'in bed' : 'out of bed'

  return (
    <>
      <header className={`status ${state}`}>
        <div className="kicker">
          {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}, {clock(now)}
        </div>
        {stale && <div className="stale-tag">Not live · no data for {silentFor.replace(/ ago$/, '')}</div>}
        <h1>
          {care.residentName} {stale ? 'was' : 'is'} {where}
          {stale && <span className="stale"> at the last reading</span>}
        </h1>
        {stale ? (
          <p className="status-sub">
            Last reading <b>{updated.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, {clock(updated)}</b>, {silentFor}.
            {' '}Where {care.residentName} is now is unknown until the bed reports again.
            {alarm && <> Alarm set for <b>{alarm.time}</b>.</>}
          </p>
        ) : (
          <p className="status-sub">
            {change && <>{change.sinceKnown ? 'Since' : 'At least since'} <b>{clock(change.since)}</b>, {agoText((now - change.since) / 60000)}. </>}
            Last reading {ago(updated)}.
            {alarm && <> Alarm set for <b>{alarm.time}</b>.</>}
          </p>
        )}
      </header>

      <Conditions items={conditions}
        onSnooze={(id) => act(() => api.snoozeAlarm(id), 'Alarm snoozed', refreshAlarms)}
        onDismiss={(id) => act(() => api.dismissAlarm(id), 'Alarm dismissed', refreshAlarms)} />

      <Card title="Last 8 hours" action={
        <div className="legend">
          <span><i className="in" />in bed</span>
          <span><i className="out" />up</span>
          <span><i className="gap" />no data</span>
        </div>
      }>
        <OccupancyStrip readings={readings} now={now} />
        {tonight && (
          <dl className="facts">
            <div><dt>{tonight.in_progress ? 'Went to bed' : 'Bedtime'}</dt><dd>{clock(parseTime(tonight.bedtime))}</dd></div>
            <div><dt>Times up</dt><dd>{tonight.bed_exits}</dd></div>
            <div><dt>Avg temp</dt><dd>{tonight.avg_temperature_c.toFixed(1)}°</dd></div>
            <div className="wide lead">
              <dt>In bed <span>goal {duration(care.sleepGoalMinutes)}</span></dt>
              <dd>{duration(tonight.in_bed_minutes)}</dd>
              <GoalBar minutes={tonight.in_bed_minutes} goal={care.sleepGoalMinutes} />
            </div>
          </dl>
        )}
      </Card>

      <section className={`block readouts minor${stale ? ' is-stale' : ''}`} aria-label="Room">
        {stale && <p className="readouts-note">Room readings below are from the last reading, {silentFor}.</p>}
        <Readout label="Temperature" value={latest.temperature_c.toFixed(1)} unit="°C"
          note={`Preferred range ${tempRange(care)}`}>
          <Sparkline label="Temperature, last 8 hours" points={series('temperature_c')} band={[care.lowTemp, care.highTemp]} minSpan={4} />
        </Readout>
        <Readout label="Humidity" value={Math.round(latest.humidity_percent)} unit="%"
          note={`Flag above ${care.humidityLimit}%`}>
          <Sparkline label="Humidity, last 8 hours" points={series('humidity_percent')} minSpan={30} />
        </Readout>
        <Readout label="Light" value={lightLabel(latest.light_level, pref?.light_warning_threshold ?? 800)}
          note={`Sensor reads ${latest.light_level} of 1023`}>
          <Sparkline label="Light level, last 8 hours" points={series('light_level')} color="var(--amber)" minSpan={200} />
        </Readout>
      </section>

      <Card title="Heating" className="heating minor">
        <div className="heating-row">
          <p className="heater">
            <span className={`lamp ${commands.heating_led_on ? 'on' : ''}`} aria-hidden />
            <span>
              <b>Heater {commands.heating_led_on ? 'on' : 'off'}</b>
              {' · '}
              {!pref?.heating_enabled ? 'automatic heating is paused' : stale ? 'no recent reading to act on' : commands.heating_led_on ? 'warming up to target' : latest.occupied ? 'room is warm enough' : 'waits until someone is in bed'}
            </span>
          </p>
          {pref && (
            <div className="heating-controls">
              <label className="inline">
                <Switch label="Automatic heating" checked={pref.heating_enabled}
                  onChange={(v) => savePref({ heating_enabled: v }, v ? 'Heating on' : 'Heating paused')} />
                Automatic
              </label>
              <Stepper label="target temperature" value={target} min={15} max={30}
                format={(v) => `${v.toFixed(1)}°`} onChange={setTarget} />
            </div>
          )}
        </div>
      </Card>
    </>
  )
}
