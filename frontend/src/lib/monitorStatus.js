
import { isStale } from './conditions'

// A successful API response does not automatically
// mean the Raspberry Pi is still sending readings.
export function getMonitoringStatus(live, now = new Date()) {
    if (live?.error) {
        return {
            kind: 'down',
            label: 'Monitoring unavailable',
            detail:
                'The latest request failed. Previously displayed readings may be outdated.',
        }
    }

    if (!live?.data) {
        return live?.loading
            ? {
                kind: 'wait',
                label: 'Checking bed connection',
                detail: 'Waiting for the first server response.',
            }
            : {
                kind: 'down',
                label: 'Monitoring unavailable',
                detail: 'No monitoring response is available.',
            }
    }

    if (!live.data.latest) {
        return {
            kind: 'stale',
            label: 'No bed readings yet',
            detail:
                'The server responded, but no sensor reading is available.',
        }
    }

    if (isStale(live.data.latest, now)) {
        return {
            kind: 'stale',
            label: 'Bed readings not current',
            detail:
                'The most recent sensor reading is old or has an invalid timestamp.',
        }
    }

    return {
        kind: 'ok',
        label: 'Recent bed reading',
        detail:
            'The server responded and the latest sensor reading is less than five minutes old.',
    }
}
