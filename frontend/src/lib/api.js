// Partly generated with Claude (Anthropic, 2026): JWT login and bed-scoped URLs.
// Thin wrapper around the FastAPI backend.
// Logging in returns a JWT; every request then sends "Authorization: Bearer <token>".
// Bed data lives under /api/beds/<bedId>/..., and the server checks this account
// may see that bed. The page functions (api.readings() etc.) keep their old names,
// so the pages did not need to change.

const TOKEN_KEY = 'smartbed.token'

function load(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function save(key, value) {
  try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key) } catch { /* private mode */ }
}

let token = load(TOKEN_KEY)
let bedId = null
const logoutListeners = new Set()

export const session = {
  get token() { return token },
  setToken(value) { token = value; save(TOKEN_KEY, value) },
  setBed(id) { bedId = id },
  onLogout(fn) { logoutListeners.add(fn); return () => logoutListeners.delete(fn) },
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// FastAPI errors look like {"detail": "text"} or, for validation (422),
// {"detail": [{"loc": ["body", "time"], "msg": "..."}]}.
function errorText(detail, status) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => `${d.loc?.slice(1).join('.')}: ${d.msg}`).join('; ')
  return `Request failed (${status})`
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) {
    payload = new URLSearchParams(form)        // the OAuth2 login endpoint expects a form
  } else if (body) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError('Cannot reach the smartBed server', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) {         // expired or invalid token: back to the login page
      session.setToken(null)
      logoutListeners.forEach((fn) => fn())
    }
    throw new ApiError(errorText(data?.detail, res.status), res.status)
  }
  return data
}

const bed = (path) => `/beds/${bedId}${path}`

export const api = {
  // Accounts and beds
  login: (email, password) => request('/auth/login', { method: 'POST', form: { username: email, password } }),
  register: (user) => request('/auth/register', { method: 'POST', body: user }),
  me: () => request('/auth/me'),
  beds: () => request('/beds'),
  claim: (pairingCode) => request('/beds/claim', { method: 'POST', body: { pairing_code: pairingCode } }),
  health: () => request('/health'),

  // The selected bed
  latest: () => request(bed('/readings/latest')),
  // Readings from the last `minutes`, thinned by the server to at most `limit`.
  readings: (minutes = 480, limit = 500) => request(bed(`/readings?minutes=${minutes}&limit=${limit}`)),
  nights: (days = 7) => request(bed(`/sleep/nights?days=${days}`)),
  commands: () => request(bed('/device/commands')),
  preferences: () => request(bed('/settings')),
  updatePreferences: (changes) => request(bed('/settings'), { method: 'PATCH', body: changes }),
  alarms: () => request(bed('/alarms')),
  createAlarm: (alarm) => request(bed('/alarms'), { method: 'POST', body: alarm }),
  updateAlarm: (id, changes) => request(bed(`/alarms/${id}`), { method: 'PATCH', body: changes }),
  deleteAlarm: (id) => request(bed(`/alarms/${id}`), { method: 'DELETE' }),
  snoozeAlarm: (id) => request(bed(`/alarms/${id}/snooze`), { method: 'POST' }),
  dismissAlarm: (id) => request(bed(`/alarms/${id}/dismiss`), { method: 'POST' }),
}
