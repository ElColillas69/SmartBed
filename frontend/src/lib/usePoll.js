import { useCallback, useEffect, useRef, useState } from 'react'

// Fetch now, then every `interval` ms while the tab is visible.
export function usePoll(fetcher, interval = 5000) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refresh = useCallback(async () => {
    try {
      const data = await fetcherRef.current()
      setState({ data, error: null, loading: false })
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }))
    }
  }, [])

  useEffect(() => {
    refresh()
    if (!interval) return
    const id = setInterval(() => document.visibilityState === 'visible' && refresh(), interval)
    return () => clearInterval(id)
  }, [refresh, interval])

  return { ...state, refresh }
}
