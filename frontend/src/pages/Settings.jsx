import { useEffect, useState } from 'react'
import { Card, PageHead, Switch } from '../components/ui'
import { api } from '../lib/api'
import { useBed } from '../lib/BedData'
import { CARE_DEFAULTS } from '../lib/care'
import { lightLabel } from '../lib/conditions'
import ThemeSwitch from '../components/ThemeSwitch'

function BedSettings() {
  const { prefs, live, act } = useBed()
  const [draft, setDraft] = useState(null)
  useEffect(() => { if (prefs.data && !draft) setDraft(prefs.data) }, [prefs.data, draft])
  if (!draft) return <div className="skeleton" />
  const current = live.data?.latest?.light_level
  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs.data)

  const save = () => act(() => api.updatePreferences(draft), 'Bed settings saved', prefs.refresh, live.refresh)

  return (
    <Card title="The bed">
      <p className="note">Stored on the bed. Takes effect at the next sensor reading, usually within seconds.</p>
      <div className="row">
        <div><div className="row-title">Automatic heating</div><div className="note">Only heats while someone is in bed and the room is below target.</div></div>
        <Switch label="Automatic heating" checked={draft.heating_enabled} onChange={(v) => setDraft({ ...draft, heating_enabled: v })} />
      </div>
      <div className="row">
        <div className="field grow">
          <label htmlFor="target">Target temperature · <span className="tabular">{draft.target_temperature_c.toFixed(1)}°C</span></label>
          <input id="target" type="range" min={15} max={30} step={0.5} value={draft.target_temperature_c}
            onChange={(e) => setDraft({ ...draft, target_temperature_c: Number(e.target.value) })} />
        </div>
      </div>
      <div className="row">
        <div className="field grow">
          <label htmlFor="light">Light warning above · <span className="tabular">{draft.light_warning_threshold}</span></label>
          <input id="light" type="range" min={0} max={1023} step={1} value={draft.light_warning_threshold}
            onChange={(e) => setDraft({ ...draft, light_warning_threshold: Number(e.target.value) })} />
          <span className="hint">Raw sensor value (0–1023), not lux.{current != null && ` Right now the room reads ${current}, which counts as “${lightLabel(current, draft.light_warning_threshold)}”.`}</span>
        </div>
      </div>
      <div className="row end">
        <button className="btn ghost" disabled={!dirty} onClick={() => setDraft(prefs.data)}>Undo changes</button>
        <button className="btn primary" disabled={!dirty} onClick={save}>Save to bed</button>
      </div>
    </Card>
  )
}

function CareSettings() {
  const { care, setCare, notify } = useBed()
  const [draft, setDraft] = useState(care)
  const set = (k, num) => (e) => setDraft({ ...draft, [k]: num ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })
  const dirty = JSON.stringify(draft) !== JSON.stringify(care)
  const within = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi
  const valid = draft.residentName.trim() && draft.lowTemp < draft.highTemp && within(draft.lowTemp, 10, 25)
    && within(draft.highTemp, 18, 35) && within(draft.humidityLimit, 30, 100)

  return (
    <Card title="Who and when">
      <p className="note">Saved in this browser only for now. The backend has no table for these yet (the new schema adds them to <code>bed_settings</code>).</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="c-name">Who sleeps here</label>
          <input id="c-name" className="input" value={draft.residentName} onChange={set('residentName')} maxLength={40} />
        </div>
        <div className="field">
          <label htmlFor="c-grace">Bed-exit grace period</label>
          <select id="c-grace" className="input" value={draft.graceMinutes} onChange={set('graceMinutes', true)}>
            {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m ? `${m} minutes` : 'Alert immediately'}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="c-ns">Night starts</label>
          <input id="c-ns" className="input" type="time" value={draft.nightStart} onChange={set('nightStart')} />
        </div>
        <div className="field">
          <label htmlFor="c-ne">Night ends</label>
          <input id="c-ne" className="input" type="time" value={draft.nightEnd} onChange={set('nightEnd')} />
        </div>
        <div className="field">
          <label htmlFor="c-goal">Sleep goal</label>
          <select id="c-goal" className="input" value={draft.sleepGoalMinutes} onChange={set('sleepGoalMinutes', true)}>
            {[360, 390, 420, 450, 480, 510, 540].map((m) => <option key={m} value={m}>{Math.floor(m / 60)}h {String(m % 60).padStart(2, '0')}m</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="c-hum">Humidity limit (%)</label>
          <input id="c-hum" className="input" type="number" min={30} max={100} value={draft.humidityLimit} onChange={set('humidityLimit', true)} />
        </div>
        <div className="field">
          <label htmlFor="c-low">Preferred range, lowest (°C)</label>
          <input id="c-low" className="input" type="number" step={0.5} min={10} max={25} value={draft.lowTemp} onChange={set('lowTemp', true)} />
        </div>
        <div className="field">
          <label htmlFor="c-high">Preferred range, highest (°C)</label>
          <input id="c-high" className="input" type="number" step={0.5} min={18} max={35} value={draft.highTemp} onChange={set('highTemp', true)} />
        </div>
      </div>
      <div className="row end">
        <button className="btn ghost" onClick={() => setDraft(CARE_DEFAULTS)}>Defaults</button>
        <button className="btn primary" disabled={!dirty || !valid} onClick={() => { setCare({ ...draft, residentName: draft.residentName.trim() }); notify('Care preferences saved') }}>Save</button>
      </div>
    </Card>
  )
}

export default function Settings() {
  return (
    <>
      <PageHead title="Settings">
        <div className="inline"><span className="note">Look</span><ThemeSwitch /></div>
      </PageHead>
      <div className="cols-2">
        <BedSettings />
        <CareSettings />
      </div>
    </>
  )
}
