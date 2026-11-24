
import { describe, expect, it } from 'vitest'
import { getDashboardSummary } from './dashboardSummary'

const now = new Date('2026-11-24T15:00:00Z')

const care = {
    residentName: 'Maureen',
    sleepGoalMinutes: 450,
    lowTemp: 18,
    highTemp: 26,
    humidityLimit: 70,
}

function recentReading(minutesAgo = 2) {
    return {
        recorded_at: new Date(
            now.getTime() - minutesAgo * 60000
        ).toISOString(),
        temperature_c: 20.5,
        humidity_percent: 55,
        occupied: true,
    }
}

function summary(overrides = {}) {
    return getDashboardSummary({
        live: {
            data: {
                latest: recentReading(),
            },
            error: null,
        },

        nights: {
            data: [{
                night: '2026-11-23',
                in_bed_minutes: 420,
                bed_exits: 1,
                in_progress: false,
            }],
        },

        alarms: {
            data: [{
                time: '07:00',
                enabled: true,
            }],
        },

        care,
        now,
        ...overrides,
    })
}

describe('SmartBed dashboard summary', () => {
    it('shows time in bed and goal progress', () => {
        const result = summary()

        expect(result.night.metric).toBe('7h 00m')
        expect(result.night.progress).toBe(93)
    })

    it('does not treat an ongoing night as completed', () => {
        const result = summary({
            nights: {
                data: [{
                    night: '2026-11-24',
                    in_bed_minutes: 120,
                    in_progress: true,
                }],
            },
        })

        expect(result.night.metric).toBe('—')
        expect(result.night.progress).toBeNull()
    })

    it('recognises comfortable room measurements', () => {
        const result = summary()

        expect(result.room.tone).toBe('good')
        expect(result.room.label).toBe(
            'Within preferred ranges'
        )
    })

    it('explains when the room is too warm', () => {
        const hot = {
            ...recentReading(),
            temperature_c: 29,
        }

        const result = summary({
            live: {
                data: { latest: hot },
                error: null,
            },
        })

        expect(result.room.tone).toBe('watch')
        expect(result.room.detail).toContain(
            'above preferred temperature'
        )
    })

    it('does not claim comfort using stale readings', () => {
        const result = summary({
            live: {
                data: { latest: recentReading(20) },
                error: null,
            },
        })

        expect(result.room.tone).toBe('unknown')
        expect(result.room.detail).toContain(
            'historical measurements'
        )
    })

    it('reports connection failures despite cached data', () => {
        const result = summary({
            live: {
                data: { latest: recentReading() },
                error: new Error('Connection lost'),
            },
        })

        expect(result.connection.tone).toBe('watch')
        expect(result.room.tone).toBe('unknown')
    })

    it('handles missing readings and nights', () => {
        const result = summary({
            live: {
                data: { latest: null },
                error: null,
            },
            nights: { data: [] },
            alarms: { data: [] },
        })

        expect(result.night.metric).toBe('—')
        expect(result.room.tone).toBe('unknown')
        expect(result.alarm.metric).toBe('None set')
    })
})
