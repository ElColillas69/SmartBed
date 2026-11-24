
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { api } from './api'

// Fallback values for display while loading.
// The server remains the source of truth.
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

export function useCarePrefs(bed) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    saving: false,
    error: null,
  })

  // Prevent old requests from overwriting newer data.
  const version = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++version.current

    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }))

    try {
      const data = await api.carePreferences(bed.id)

      if (requestId === version.current) {
        setState((previous) => ({
          ...previous,
          data,
          loading: false,
          error: null,
        }))
      }

      return data
    } catch (error) {
      if (requestId === version.current) {
        setState((previous) => ({
          ...previous,
          loading: false,
          error,
        }))
      }

      throw error
    }
  }, [bed.id])

  // Load preferences when the selected bed is opened.
  useEffect(() => {
    refresh().catch(() => { })

    return () => {
      version.current += 1
    }
  }, [refresh])

  const save = useCallback(async (next) => {
    const requestId = ++version.current

    setState((previous) => ({
      ...previous,
      saving: true,
      error: null,
    }))

    try {
      const saved = await api.updateCarePreferences(
        bed.id,
        next
      )

      if (requestId === version.current) {
        setState({
          data: saved,
          loading: false,
          saving: false,
          error: null,
        })
      }

      return saved
    } catch (error) {
      if (requestId === version.current) {
        setState((previous) => ({
          ...previous,
          saving: false,
          error,
        }))
      }

      throw error
    }
  }, [bed.id])

  const care = state.data ?? {
    ...CARE_DEFAULTS,
    residentName: bed.resident_name,
  }

  return [
    care,
    save,
    {
      ...state,
      refresh,
      ready: Boolean(state.data),
    },
  ]
}
