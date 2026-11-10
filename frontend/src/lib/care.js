// Partly generated with Claude (Anthropic, 2026): preferences stored per bed.
import { useCallback, useState } from 'react'

// Care preferences the backend does not store yet. They live in this
// browser only, one set per bed; move them to the bed_setting table later.
export const CARE_DEFAULTS = {
  residentName: 'Maureen',
  graceMinutes: 20,
  nightStart: '21:00',
  nightEnd: '07:00',
  sleepGoalMinutes: 450,
  lowTemp: 18,
  highTemp: 26,
  humidityLimit: 70,
}

const keyFor = (bed) => `smartbed.care.${bed.id}`

function load(bed) {
  const defaults = { ...CARE_DEFAULTS, residentName: bed.resident_name }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(keyFor(bed)) || '{}') }
  } catch {
    return defaults
  }
}

export function useCarePrefs(bed) {
  const [care, setCare] = useState(() => load(bed))
  const save = useCallback((next) => {
    setCare(next)
    try {
      localStorage.setItem(keyFor(bed), JSON.stringify(next))
    } catch {
      // storage unavailable (private mode); keep in memory
    }
  }, [bed])
  return [care, save]
}
