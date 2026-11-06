import { isWithinWindow, parseTime, duration } from './time'

// When did the bed last change state? readings are newest first.
export function lastChange(readings) {
  if (!readings?.length) return null
  const current = readings[0].occupied
  const flip = readings.findIndex((r) => r.occupied !== current)
  const since = readings[flip === -1 ? readings.length - 1 : flip - 1]
  return { occupied: current, since: parseTime(since.recorded_at), sinceKnown: flip !== -1 }
}

export function lightLabel(raw, threshold) {
  if (raw == null) return '—'
  if (raw > threshold) return 'Bright'
  if (raw > threshold * 0.4) return 'Dim'
  return 'Dark'
}

// Turn the latest data into things a caretaker should notice, most urgent first.
export function deriveConditions({ latest, readings, commands, care, now = new Date() }) {
  const out = []
  if (!latest) return out
  const updated = parseTime(latest.recorded_at)
  const staleMinutes = (now - updated) / 60000

  if (commands?.buzzer_on) {
    out.push({ id: 'alarm', level: 'info', title: 'Alarm is ringing', detail: 'The bedside buzzer is sounding.', alarmIds: commands.due_alarm_ids })
  }

  if (staleMinutes > 5) {
    out.push({ id: 'stale', level: 'warning', title: 'No data from the bed', detail: `Last reading ${duration(staleMinutes)} ago. Check the Pi is powered and online.` })
  }

  const change = lastChange(readings)
  if (change && !change.occupied) {
    const away = (now - change.since) / 60000
    const night = isWithinWindow(now, care.nightStart, care.nightEnd)
    if (night && away >= care.graceMinutes) {
      out.push({ id: 'exit', level: 'critical', title: `Bed empty for ${duration(away)}`, detail: `${care.graceMinutes ? `Past the ${care.graceMinutes}-minute night-time grace period. ` : ''}Check on ${care.residentName} now.` })
    } else if (night) {
      out.push({ id: 'exit', level: 'info', title: 'Out of bed', detail: `${duration(away)} so far. An alert is raised after ${care.graceMinutes} minutes.` })
    }
  }

  if (latest.temperature_c < care.lowTemp) {
    out.push({ id: 'cold', level: 'warning', title: 'Room is cold', detail: `${latest.temperature_c.toFixed(1)}°C is below the ${care.lowTemp}°C limit.` })
  } else if (latest.temperature_c > care.highTemp) {
    out.push({ id: 'hot', level: 'warning', title: 'Room is warm', detail: `${latest.temperature_c.toFixed(1)}°C is above the ${care.highTemp}°C limit.` })
  }
  if (latest.humidity_percent > care.humidityLimit) {
    out.push({ id: 'humid', level: 'warning', title: 'Humidity is high', detail: `${Math.round(latest.humidity_percent)}% is above the ${care.humidityLimit}% limit.` })
  }
  // commands are re-evaluated against current settings; the stored flag is not
  if (commands ? commands.light_warning : latest.light_warning) {
    out.push({ id: 'light', level: 'warning', title: 'Room light is on', detail: 'Light is above the warning threshold.' })
  }

  const rank = { critical: 0, warning: 1, info: 2 }
  return out.sort((a, b) => rank[a.level] - rank[b.level])
}
