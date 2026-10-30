import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, PageHead, Switch } from '../components/ui'
import { api } from '../lib/api'
import { useBed } from '../lib/BedData'
import { clock, parseTime } from '../lib/time'
import NoData from './NoData'

function NewAlarm({ onCreate }) {
  const [form, setForm] = useState({ time: '07:30', label: 'Wake up', snooze_minutes: 5 })
  const set = (k) => (e) => setForm({ ...form, [k]: k === 'snooze_minutes' ? Number(e.target.value) : e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    if (await onCreate(form)) setForm({ ...form, label: 'Wake up' })
  }
  return (
    <Card title="New alarm">
      <form className="form-grid" onSubmit={submit}>
        <div className="field">
          <label htmlFor="a-time">Time</label>
          <input id="a-time" className="input" type="time" required value={form.time} onChange={set('time')} />
        </div>
        <div className="field">
          <label htmlFor="a-label">Label</label>
          <input id="a-label" className="input" maxLength={80} required value={form.label} onChange={set('label')} />
        </div>
        <div className="field">
          <label htmlFor="a-snooze">Snooze</label>
          <select id="a-snooze" className="input" value={form.snooze_minutes} onChange={set('snooze_minutes')}>
            {[5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </div>
        <button className="btn primary" type="submit"><Plus size={16} /> Add alarm</button>
      </form>
    </Card>
  )
}

export default function Alarms() {
  const { alarms, live, act } = useBed()
  if (!alarms.data) return <NoData state={alarms} />
  const ringing = new Set(live.data?.commands?.due_alarm_ids ?? [])
  const refresh = () => Promise.all([alarms.refresh(), live.refresh()])

  return (
    <>
      <PageHead kicker="Sounds the buzzer by the bed" title="Alarms" />
      <div className="alarms">
        {alarms.data.length === 0 && (
          <p className="all-clear">No alarms yet. Add one below and the buzzer by the bed will go off at that time every day.</p>
        )}
        {alarms.data.map((a) => (
          <div key={a.id} className={`alarm ${a.enabled ? '' : 'off'}`}>
            <div className="alarm-time">{a.time}</div>
            <div>
              <div className="alarm-label">{a.label}</div>
              <div className="note">
                {ringing.has(a.id) ? <span className="ringing">Ringing now</span>
                  : a.snoozed_until && parseTime(a.snoozed_until) > new Date() ? `Snoozed until ${clock(parseTime(a.snoozed_until))}`
                  : `Every day, ${a.snooze_minutes} min snooze`}
              </div>
            </div>
            <div className="alarm-actions">
              {ringing.has(a.id) && (
                <>
                  <button className="btn sm" onClick={() => act(() => api.snoozeAlarm(a.id), 'Snoozed', refresh)}>Snooze</button>
                  <button className="btn sm primary" onClick={() => act(() => api.dismissAlarm(a.id), 'Dismissed', refresh)}>Dismiss</button>
                </>
              )}
              <Switch label={`${a.label} at ${a.time}`} checked={a.enabled}
                onChange={(v) => act(() => api.updateAlarm(a.id, { enabled: v }), null, alarms.refresh)} />
              <button className="btn ghost icon danger" aria-label={`Delete ${a.label}`} title="Delete"
                onClick={() => act(() => api.deleteAlarm(a.id), 'Alarm deleted', alarms.refresh)}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        <NewAlarm onCreate={(form) => act(() => api.createAlarm(form), `Alarm set for ${form.time}`, alarms.refresh)} />
      </div>
    </>
  )
}
