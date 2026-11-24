
import { describe, expect, it } from 'vitest'
import { getMonitoringStatus } from './monitorStatus'

const now = new Date('2026-11-24T14:00:00Z')

function reading(minutesAgo, timestamp) {
    return {
        recorded_at: timestamp ??
            new Date(
                now.getTime() - minutesAgo * 60000
            ).toISOString(),
        occupied: true,
    }
}

function live(latest, extra = {}) {
    return {
        data: { latest },
        loading: false,
        error: null,
        ...extra,
    }
}

describe('SmartBed monitoring status', () => {

    it('identifies initial connection', () => {
        const result = getMonitoringStatus({
            data: undefined,
            loading: true,
            error: null,
        }, now)

        expect(result.kind).toBe('wait')
    })

    it('identifies missing sensor readings', () => {
        const result = getMonitoringStatus(
            live(null),
            now
        )

        expect(result.kind).toBe('stale')
        expect(result.label).toBe('No bed readings yet')
    })

    it('identifies recent sensor readings', () => {
        const result = getMonitoringStatus(
            live(reading(2)),
            now
        )

        expect(result.kind).toBe('ok')
    })

    it('identifies stale readings', () => {
        const result = getMonitoringStatus(
            live(reading(11)),
            now
        )

        expect(result.kind).toBe('stale')
    })

    it('rejects invalid timestamps', () => {
        const result = getMonitoringStatus(
            live(reading(0, 'invalid')),
            now
        )

        expect(result.kind).toBe('stale')
    })

    it('rejects future timestamps', () => {
        const result = getMonitoringStatus(
            live(reading(-3)),
            now
        )

        expect(result.kind).toBe('stale')
    })

    it('reports connection failures despite cached data', () => {
        const result = getMonitoringStatus(
            live(reading(0), {
                error: new Error('Connection failed'),
            }),
            now
        )

        expect(result.kind).toBe('down')
        expect(result.label).toBe('Monitoring unavailable')
    })

})
