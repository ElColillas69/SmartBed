
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

// Ensure only the newest request can update its consumer.
// Also invalidate requests when a component unmounts.
export function createLatestRequestGate() {
  let generation = 0

  return {
    async run(fetcher, onSuccess, onError) {
      const requestId = ++generation

      try {
        const data = await fetcher()

        // Ignore results from superseded requests.
        if (requestId === generation) {
          onSuccess(data)
        }
      } catch (error) {
        // Old failures must not replace newer success.
        if (requestId === generation) {
          onError(error)
        }
      }
    },

    invalidate() {
      // Invalidate outstanding responses.
      generation += 1
    },
  }
}

// Poll immediately, periodically, and when the tab returns.
// Keep the existing {data, error, loading, refresh} API.
export function usePoll(fetcher, interval = 5000) {
  const [state, setState] = useState({
    data: undefined,
    error: null,
    loading: true,
  })

  const fetcherRef = useRef(fetcher)
  const activeRef = useRef(false)
  const gateRef = useRef(null)

  // Use the latest fetcher without restarting the timer.
  fetcherRef.current = fetcher

  if (gateRef.current === null) {
    gateRef.current = createLatestRequestGate()
  }

  const refresh = useCallback(() => {
    if (!activeRef.current) {
      return Promise.resolve()
    }

    return gateRef.current.run(
      () => fetcherRef.current(),

      // Latest successful request.
      (data) => {
        setState({
          data,
          error: null,
          loading: false,
        })
      },

      // Latest failed request.
      (error) => {
        setState((previous) => ({
          ...previous,
          error,
          loading: false,
        }))
      }
    )
  }, [])

  useEffect(() => {
    activeRef.current = true

    // Fetch immediately when the component mounts.
    void refresh()

    // Refresh as soon as the user returns to the tab.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    )

    // Continue polling only while the tab is visible.
    const timer = interval > 0
      ? setInterval(() => {
        if (document.visibilityState === 'visible') {
          void refresh()
        }
      }, interval)
      : null

    return () => {
      // Prevent responses from an old component instance
      // from changing its state after unmounting.
      activeRef.current = false
      gateRef.current.invalidate()

      if (timer !== null) {
        clearInterval(timer)
      }

      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      )
    }
  }, [refresh, interval])

  return { ...state, refresh }
}
