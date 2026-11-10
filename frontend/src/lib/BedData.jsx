// Partly generated with Claude (Anthropic, 2026): takes the chosen bed.
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api } from './api'
import { useCarePrefs } from './care'
import { deriveConditions } from './conditions'
import { usePoll } from './usePoll'

const BedContext = createContext(null)

export function BedDataProvider({ bed, children }) {
  const live = usePoll(async () => {
    const [readings, commands] = await Promise.all([api.readings(8 * 60), api.commands()])
    return { readings, commands, latest: readings[0] ?? null }
  }, 5000)
  const prefs = usePoll(api.preferences, 30000)
  const alarms = usePoll(api.alarms, 15000)
  const nights = usePoll(() => api.nights(7), 60000)
  const [care, setCare] = useCarePrefs(bed)
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, kind = 'ok') => {
    setToast({ message, kind, id: Date.now() })
    setTimeout(() => setToast((t) => (t?.message === message ? null : t)), 3200)
  }, [])

  // Run a write, report errors, then refresh whatever it touched.
  const act = useCallback(async (fn, success, ...refreshers) => {
    try {
      const result = await fn()
      if (success) notify(success)
      await Promise.all(refreshers.map((r) => r()))
      return result
    } catch (err) {
      notify(err.message, 'error')
      return undefined
    }
  }, [notify])

  const conditions = useMemo(
    () => deriveConditions({ latest: live.data?.latest, readings: live.data?.readings, commands: live.data?.commands, care, heating: prefs.data }),
    [live.data, prefs.data, care],
  )

  const value = {
    bed, live, prefs, alarms, nights, care, setCare, conditions, notify, act, toast,
    connected: !live.error && live.data !== undefined,
  }
  return <BedContext.Provider value={value}>{children}</BedContext.Provider>
}

export const useBed = () => useContext(BedContext)
