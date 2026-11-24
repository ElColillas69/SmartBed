
import {
  agoText,
  isWithinWindow,
  minutesText,
  parseTime,
} from './time'

// Find when the bed last changed state.
// Readings are ordered newest first.
export function lastChange(readings) {
  if (!readings?.length) return null

  const current = readings[0].occupied
  const flip = readings.findIndex(
    (reading) => reading.occupied !== current
  )

  const since = readings[
    flip === -1 ? readings.length - 1 : flip - 1
  ]

  return {
    occupied: current,
    since: parseTime(since.recorded_at),
    sinceKnown: flip !== -1,
  }
}

export function lightLabel(raw, threshold) {
  if (raw == null) return '—'
  if (raw > threshold) return 'Bright'
  if (raw > threshold * 0.4) return 'Dim'
  return 'Dark'
}

// A reading older than five minutes is no longer live.
export const STALE_MINUTES = 5

export function isStale(latest, now = new Date()) {
  if (!latest) return false

  const updated = parseTime(latest.recorded_at)

  if (!updated || !Number.isFinite(updated.getTime())) {
    return true
  }

  const ageMinutes = (now - updated) / 60000

  // Allow one minute of clock skew.
  // Reject very old or future-dated readings.
  return ageMinutes > STALE_MINUTES || ageMinutes < -1
}

export const tempRange = (care) =>
  `${care.lowTemp}–${care.highTemp}°C`

export function deriveConditions({
  latest,
  readings,
  commands,
  care,
  heating,
  connectionDown = false,
  now = new Date(),
}) {
  const out = []

  // A failed backend connection makes the current
  // physical state impossible to confirm.
  if (connectionDown) {
    out.push({
      id: 'connection',
      level: 'warning',
      title: 'Connection lost',
      detail:
        'Current occupancy and actuator status cannot be verified. ' +
        'Check SmartBed connectivity.',
    })
  }

  // Without readings, occupancy is unknown.
  if (!latest) {
    if (!connectionDown) {
      out.push({
        id: 'missing',
        level: 'warning',
        title: 'No bed readings yet',
        detail:
          'Occupancy is unknown until the bed sends a valid reading.',
      })
    }

    return out
  }

  const updated = parseTime(latest.recorded_at)

  const validTimestamp = Boolean(
    updated && Number.isFinite(updated.getTime())
  )

  const staleMinutes = validTimestamp
    ? (now - updated) / 60000
    : null

  const stale = isStale(latest, now)

  // Safety gate: old readings or connection failures
  // must never generate a current bed-exit alert.
  const unavailable = stale || connectionDown

  if (stale) {
    const detail = !validTimestamp
      ? 'Latest reading has an invalid timestamp. Check the Pi clock and sensor connection.'
      : staleMinutes < -1
        ? 'Latest reading is dated in the future. Check the Pi clock.'
        : `Last reading ${agoText(staleMinutes)}. Check the Pi is powered and online.`

    out.push({
      id: 'stale',
      level: 'warning',
      title: 'No reliable live bed data',
      detail,
    })
  }

  // Old command data cannot prove that the buzzer
  // is currently sounding.
  if (!unavailable && commands?.buzzer_on) {
    out.push({
      id: 'alarm',
      level: 'info',
      title: 'Alarm is ringing',
      detail: 'The bedside buzzer is sounding.',
      alarmIds: commands.due_alarm_ids,
    })
  }

  const change = lastChange(readings)

  // Only evaluate bed-exit warnings with reliable
  // current readings and a valid change timestamp.
  if (
    !unavailable &&
    change &&
    !change.occupied &&
    change.since &&
    Number.isFinite(change.since.getTime())
  ) {
    const away = (now - change.since) / 60000

    const night = isWithinWindow(
      now,
      care.nightStart,
      care.nightEnd
    )

    if (night && away >= care.graceMinutes) {
      const title = away < 1
        ? 'Just got out of bed'
        : `Out of bed for ${minutesText(away)}`

      const why = care.graceMinutes
        ? `That's past the ${minutesText(care.graceMinutes)} allowed at night.`
        : 'Set to alert straight away at night.'

      out.push({
        id: 'exit',
        level: 'critical',
        title,
        detail: `${why} Check on ${care.residentName}.`,
      })
    } else if (night) {
      const left = care.graceMinutes - away

      const sofar = away < 1
        ? 'Got up a moment ago.'
        : `Up for ${minutesText(away)} so far.`

      out.push({
        id: 'exit',
        level: 'info',
        title: 'Out of bed',
        detail:
          `${sofar} Alert in ${left < 1
            ? 'under a minute'
            : minutesText(Math.ceil(left))
          } if not back.`,
      })
    }
  }

  // Historical measurements must use past tense.
  const is = unavailable ? 'was' : 'is'

  const reading = (value) =>
    unavailable
      ? `${value} at the last reading`
      : value

  const temp = `${latest.temperature_c.toFixed(1)}°C`

  const heaterNote = !heating
    ? ''
    : heating.heating_enabled
      ? ` Heater target is ${heating.target_temperature_c}°C.`
      : ' Automatic heating is paused.'

  if (latest.temperature_c < care.lowTemp) {
    out.push({
      id: 'cold',
      level: 'warning',
      title: `Room ${is} cold`,
      detail:
        `${reading(temp)}, below the preferred range ` +
        `(${tempRange(care)}).${heaterNote}`,
    })
  } else if (latest.temperature_c > care.highTemp) {
    out.push({
      id: 'hot',
      level: 'warning',
      title: `Room ${is} warm`,
      detail:
        `${reading(temp)}, above the preferred range ` +
        `(${tempRange(care)}).`,
    })
  }

  if (latest.humidity_percent > care.humidityLimit) {
    out.push({
      id: 'humid',
      level: 'warning',
      title: `Humidity ${is} high`,
      detail:
        `${reading(
          `${Math.round(latest.humidity_percent)}%`
        )}, above the ${care.humidityLimit}% limit.`,
    })
  }

  const rank = {
    critical: 0,
    warning: 1,
    info: 2,
  }

  return out.sort(
    (a, b) => rank[a.level] - rank[b.level]
  )
}
