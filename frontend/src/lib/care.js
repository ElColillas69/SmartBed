import { useCallback, useState } from 'react'

// Care preferences the backend does not store yet. They live in this
// browser only; move them to the bed_settings table when the API supports it.
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

const KEY = 'smartbed.care'

function load() {
  try {
    return { ...CARE_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return CARE_DEFAULTS
  }
}

export function useCarePrefs() {
  const [care, setCare] = useState(load)
  const save = useCallback((next) => {
    setCare(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // storage unavailable (private mode); keep in memory
    }
  }, [])
  return [care, save]
}
