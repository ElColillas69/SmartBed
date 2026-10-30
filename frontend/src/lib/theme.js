import { useSyncExternalStore } from 'react'

const KEY = 'smartbed.theme'
const listeners = new Set()

function read() {
  try {
    return localStorage.getItem(KEY) || 'auto'
  } catch {
    return 'auto'
  }
}

let current = read()
apply(current)

function apply(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

function setTheme(theme) {
  current = theme
  apply(theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // storage unavailable; theme still applies for this visit
  }
  listeners.forEach((fn) => fn())
}

const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Shared by every theme switch on the page.
export function useTheme() {
  return [useSyncExternalStore(subscribe, () => current), setTheme]
}
