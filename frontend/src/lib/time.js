// Older backends returned UTC timestamps without an offset; treat those as UTC.
export function parseTime(iso) {
  if (!iso) return null
  return new Date(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)
}

export const clock = (date) =>
  date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'

export function duration(minutes) {
  if (minutes == null) return '—'
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}

// "3 minutes", "1 minute", "1 hour", "2h 05m". For prose, where "0m" reads like a glitch.
export function minutesText(minutes) {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`
  if (m % 60 === 0) return `${m / 60} hour${m === 60 ? '' : 's'}`
  return duration(m)
}

// How long ago, in words: "a moment ago" under a minute, then minutesText.
export function agoText(minutes) {
  if (minutes < 1) return 'a moment ago'
  // past two days, hours and minutes are noise: "3 days ago"
  if (minutes >= 48 * 60) return `${Math.floor(minutes / 1440)} days ago`
  return `${minutesText(minutes)} ago`
}

export function ago(date, now = Date.now()) {
  if (!date) return 'never'
  const s = Math.round((now - date.getTime()) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Night window may wrap past midnight, e.g. 21:00 to 07:00.
export function isWithinWindow(date, start, end) {
  const t = date.getHours() * 60 + date.getMinutes()
  const a = toMinutes(start)
  const b = toMinutes(end)
  return a <= b ? t >= a && t < b : t >= a || t < b
}

export function nightLabel(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

// The next alarm to go off after `now`, wrapping to tomorrow's earliest.
export function nextAlarm(alarms, now = new Date()) {
  const on = (alarms ?? []).filter((a) => a.enabled).sort((a, b) => a.time.localeCompare(b.time))
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return on.find((a) => a.time > hhmm) ?? on[0]
}
