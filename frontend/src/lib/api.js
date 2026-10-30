// Thin wrapper around the Flask API. The dev server adds the X-API-Key header.

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the smartBed server', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const fallback = res.status === 401 ? 'The API key was rejected' : `Request failed (${res.status})`
    throw new ApiError(data?.error || fallback, res.status)
  }
  return data
}

export const api = {
  health: () => request('/health'),
  latest: () => request('/readings/latest'),
  // Readings from the last `minutes`, thinned by the server to at most `limit`.
  readings: (minutes = 480, limit = 500) => request(`/readings?minutes=${minutes}&limit=${limit}`),
  nights: (days = 7) => request(`/sleep/nights?days=${days}`),
  commands: () => request('/device/commands'),
  preferences: () => request('/preferences'),
  updatePreferences: (changes) => request('/preferences', { method: 'PATCH', body: changes }),
  alarms: () => request('/alarms'),
  createAlarm: (alarm) => request('/alarms', { method: 'POST', body: alarm }),
  updateAlarm: (id, changes) => request(`/alarms/${id}`, { method: 'PATCH', body: changes }),
  deleteAlarm: (id) => request(`/alarms/${id}`, { method: 'DELETE' }),
  snoozeAlarm: (id) => request(`/alarms/${id}/snooze`, { method: 'POST' }),
  dismissAlarm: (id) => request(`/alarms/${id}/dismiss`, { method: 'POST' }),
}
