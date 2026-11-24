
import { useEffect, useState } from 'react'
import { Card, PageHead, Switch } from '../components/ui'
import { api } from '../lib/api'
import { useBed } from '../lib/BedData'
import { CARE_DEFAULTS } from '../lib/care'
import ThemeSwitch from '../components/ThemeSwitch'
import ClaimBed from '../components/ClaimBed'
import { useSession } from '../lib/Session'

// --------------------------------------------
// BED SETTINGS
// Automatic heating and target temperature
// --------------------------------------------

function BedSettings() {
  const { prefs, live, act } = useBed()
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    if (prefs.data && !draft) {
      setDraft(prefs.data)
    }
  }, [prefs.data, draft])

  if (!draft) {
    return (
      <Card title="The bed">
        <p className="note" role="status">
          Loading bed settings...
        </p>
      </Card>
    )
  }

  // Only edit the fields supported by this bed.
  // The current build does not have a light sensor.
  const edited = ({
    heating_enabled,
    target_temperature_c,
  }) => ({
    heating_enabled,
    target_temperature_c,
  })

  const dirty =
    JSON.stringify(edited(draft)) !==
    JSON.stringify(edited(prefs.data))

  const save = () =>
    act(
      () => api.updatePreferences(edited(draft)),
      'Bed settings saved',
      prefs.refresh,
      live.refresh
    )

  return (
    <Card title="The bed">
      <p className="note">
        These settings control automatic heating.
        Changes take effect when the device next
        receives an updated command.
      </p>

      <div className="row">
        <div>
          <div className="row-title">
            Automatic heating
          </div>

          <div className="note">
            Only heats while someone is in bed and
            the room temperature is below the target.
          </div>
        </div>

        <Switch
          label="Automatic heating"
          checked={draft.heating_enabled}
          onChange={(value) =>
            setDraft({
              ...draft,
              heating_enabled: value,
            })
          }
        />
      </div>

      <div className="row">
        <div className="field grow">
          <label htmlFor="target">
            Target temperature ·{' '}
            <span className="tabular">
              {draft.target_temperature_c.toFixed(1)}°C
            </span>
          </label>

          <input
            id="target"
            type="range"
            min={15}
            max={30}
            step={0.5}
            value={draft.target_temperature_c}
            onChange={(event) =>
              setDraft({
                ...draft,
                target_temperature_c: Number(
                  event.target.value
                ),
              })
            }
          />
        </div>
      </div>

      <div className="row end">
        <button
          type="button"
          className="btn ghost"
          disabled={!dirty}
          onClick={() => setDraft(prefs.data)}
        >
          Undo changes
        </button>

        <button
          type="button"
          className="btn primary"
          disabled={!dirty}
          onClick={save}
        >
          Save to bed
        </button>
      </div>
    </Card>
  )
}

// --------------------------------------------
// CARE SETTINGS
// Shared preferences stored through FastAPI
// --------------------------------------------

function CareSettings() {
  const {
    care,
    setCare,
    careStatus,
    notify,
  } = useBed()

  const [draft, setDraft] = useState(care)

  // Keep the form synchronised when the backend
  // loads or saves care preferences.
  useEffect(() => {
    if (careStatus.ready) {
      setDraft({ ...care })
    }
  }, [care, careStatus.ready])

  // Update a text or numeric form field.
  const set = (key, numeric = false) => (event) => {
    const value = event.target.value

    setDraft((previous) => ({
      ...previous,
      [key]: numeric
        ? value === ''
          ? ''
          : Number(value)
        : value,
    }))
  }

  // Check whether any settings have changed.
  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify(care)

  const within = (value, min, max) =>
    Number.isFinite(value) &&
    value >= min &&
    value <= max

  // Validate the form before saving.
  const valid =
    draft.residentName.trim().length > 0 &&
    draft.residentName.trim().length <= 40 &&
    within(draft.graceMinutes, 0, 60) &&
    within(draft.sleepGoalMinutes, 180, 720) &&
    within(draft.lowTemp, 10, 25) &&
    within(draft.highTemp, 18, 35) &&
    draft.lowTemp < draft.highTemp &&
    within(draft.humidityLimit, 30, 100) &&
    draft.nightStart !== draft.nightEnd

  // Save preferences using the FastAPI backend.
  const saveChanges = async () => {
    try {
      await setCare({
        ...draft,
        residentName: draft.residentName.trim(),
      })

      notify('Care preferences saved to SmartBed')
    } catch (error) {
      notify(
        error.message || 'Could not save preferences',
        'error'
      )
    }
  }

  // Restore default settings in the form.
  // The changes are not stored until Save is pressed.
  const restoreDefaults = () => {
    setDraft({
      ...CARE_DEFAULTS,
      residentName: care.residentName,
    })
  }

  // Reload preferences from the database.
  const reloadPreferences = async () => {
    try {
      await careStatus.refresh()
    } catch (error) {
      notify(
        error.message || 'Could not reload preferences',
        'error'
      )
    }
  }

  // Handle initial loading or an unavailable API.
  // This must appear BEFORE the main form return.
  if (!careStatus.ready) {
    return (
      <Card title="Who and when">
        <p className="note" role="status">
          {careStatus.loading
            ? 'Loading shared care preferences...'
            : 'Could not load care preferences.'}
        </p>

        {careStatus.error && (
          <p role="alert">
            {careStatus.error.message}
          </p>
        )}

        {!careStatus.loading && (
          <button
            type="button"
            className="btn ghost"
            onClick={reloadPreferences}
          >
            Try again
          </button>
        )}
      </Card>
    )
  }

  return (
    <Card title="Who and when">
      <p className="note">
        These preferences are stored on the SmartBed
        server and shared with authorised carers.
      </p>

      <div className="form-grid">

        {/* Resident name */}
        <div className="field">
          <label htmlFor="c-name">
            Who sleeps here
          </label>

          <input
            id="c-name"
            className="input"
            value={draft.residentName}
            onChange={set('residentName')}
            maxLength={40}
          />
        </div>

        {/* Bed-exit grace period */}
        <div className="field">
          <label htmlFor="c-grace">
            Bed-exit grace period
          </label>

          <select
            id="c-grace"
            className="input"
            value={draft.graceMinutes}
            onChange={set('graceMinutes', true)}
          >
            {[0, 5, 10, 15, 20, 30, 45, 60].map(
              (minutes) => (
                <option
                  key={minutes}
                  value={minutes}
                >
                  {minutes
                    ? `${minutes} minutes`
                    : 'Alert immediately'}
                </option>
              )
            )}
          </select>
        </div>

        {/* Start of night monitoring */}
        <div className="field">
          <label htmlFor="c-ns">
            Night starts
          </label>

          <input
            id="c-ns"
            className="input"
            type="time"
            value={draft.nightStart}
            onChange={set('nightStart')}
          />
        </div>

        {/* End of night monitoring */}
        <div className="field">
          <label htmlFor="c-ne">
            Night ends
          </label>

          <input
            id="c-ne"
            className="input"
            type="time"
            value={draft.nightEnd}
            onChange={set('nightEnd')}
          />
        </div>

        {/* Sleep goal */}
        <div className="field">
          <label htmlFor="c-goal">
            Sleep goal
          </label>

          <select
            id="c-goal"
            className="input"
            value={draft.sleepGoalMinutes}
            onChange={set('sleepGoalMinutes', true)}
          >
            {[360, 390, 420, 450, 480, 510, 540].map(
              (minutes) => (
                <option
                  key={minutes}
                  value={minutes}
                >
                  {Math.floor(minutes / 60)}h{' '}
                  {String(minutes % 60).padStart(2, '0')}m
                </option>
              )
            )}
          </select>
        </div>

        {/* Humidity preference */}
        <div className="field">
          <label htmlFor="c-hum">
            Humidity limit (%)
          </label>

          <input
            id="c-hum"
            className="input"
            type="number"
            min={30}
            max={100}
            value={draft.humidityLimit}
            onChange={set('humidityLimit', true)}
          />
        </div>

        {/* Minimum preferred temperature */}
        <div className="field">
          <label htmlFor="c-low">
            Preferred range, lowest (°C)
          </label>

          <input
            id="c-low"
            className="input"
            type="number"
            step={0.5}
            min={10}
            max={25}
            value={draft.lowTemp}
            onChange={set('lowTemp', true)}
          />
        </div>

        {/* Maximum preferred temperature */}
        <div className="field">
          <label htmlFor="c-high">
            Preferred range, highest (°C)
          </label>

          <input
            id="c-high"
            className="input"
            type="number"
            step={0.5}
            min={18}
            max={35}
            value={draft.highTemp}
            onChange={set('highTemp', true)}
          />
        </div>

      </div>

      {/* Form actions */}
      <div className="row end">

        <button
          type="button"
          className="btn ghost"
          disabled={careStatus.saving || careStatus.loading}
          onClick={reloadPreferences}
        >
          Reload from server
        </button>

        <button
          type="button"
          className="btn ghost"
          disabled={careStatus.saving}
          onClick={restoreDefaults}
        >
          Defaults
        </button>

        <button
          type="button"
          className="btn primary"
          disabled={
            !dirty ||
            !valid ||
            careStatus.saving ||
            careStatus.loading
          }
          onClick={saveChanges}
        >
          {careStatus.saving
            ? 'Saving...'
            : 'Save to bed'}
        </button>

      </div>
    </Card>
  )
}

// --------------------------------------------
// YOUR BEDS
// Account information and bed selection
// --------------------------------------------

function Beds() {
  const {
    beds,
    bed,
    chooseBed,
    user,
    logout,
  } = useSession()

  const { notify } = useBed()

  return (
    <Card title="Your beds">

      <p className="note">
        {user
          ? `Signed in as ${user.email}. `
          : ''}

        You can see{' '}
        {beds.map((item) => item.resident_name).join(', ')}.
      </p>

      {beds.length > 1 && (
        <div
          className="field"
          style={{ marginBottom: 18 }}
        >
          <label htmlFor="pick-bed">
            Showing
          </label>

          <select
            id="pick-bed"
            className="input"
            value={bed.id}
            onChange={(event) =>
              chooseBed(event.target.value)
            }
          >
            {beds.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.resident_name}’s room
              </option>
            ))}
          </select>
        </div>
      )}

      <ClaimBed
        onDone={(claimedBed) =>
          notify(
            `Added ${claimedBed.resident_name}’s bed`
          )
        }
      />

      <div className="row end">
        <button
          type="button"
          className="btn ghost"
          onClick={logout}
        >
          Sign out
        </button>
      </div>

    </Card>
  )
}

// --------------------------------------------
// SETTINGS PAGE
// --------------------------------------------

export default function Settings() {
  return (
    <>
      <PageHead title="Settings">
        <div className="inline">
          <span className="note">
            Look
          </span>

          <ThemeSwitch />
        </div>
      </PageHead>

      <div className="cols-2">
        <BedSettings />
        <CareSettings />
        <Beds />
      </div>
    </>
  )
}
