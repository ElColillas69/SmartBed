
import { describe, expect, it } from 'vitest'
import { deriveConditions, isStale } from './conditions'

const now = new Date('2026-11-24T23:00:00Z')

const care = {
    residentName: 'Maureen',
    graceMinutes: 20,
    nightStart: '21:00',
    nightEnd: '07:00',
    sleepGoalMinutes: 450,
    lowTemp: 18,
    highTemp: 26,
    humidityLimit: 70,
}

function reading(minutesAgo, occupied, extra = {}) {
    return {
        recorded_at: new Date(
            now.getTime() - minutesAgo * 60000
        ).toISOString(),
        occupied,
        temperature_c: 20,
        humidity_percent: 50,
        light_level: 0,
        light_warning: false,
        ...extra,
    }
}

function check(readings, extra = {}) {
    return deriveConditions({
        latest: readings[0] ?? null,
        readings,
        care,
        now,
        ...extra,
    })
}

describe('SmartBed sensor safety', () => {
    it('allows genuine fresh bed-exit alerts', () => {
        const result = check([
            reading(0, false),
            reading(25, false),
            reading(30, true),
        ])

        expect(result.some(
            (item) =>
                item.id === 'exit' &&
                item.level === 'critical'
        )).toBe(true)
    })

    it('prevents stale bed-exit alerts', () => {
        const result = check([
            reading(10, false),
            reading(35, false),
            reading(40, true),
        ])

        expect(result.some(
            (item) => item.id === 'stale'
        )).toBe(true)

        expect(result.some(
            (item) => item.id === 'exit'
        )).toBe(false)
    })

    it('suppresses alerts during connection failure', () => {
        const result = check(
            [
                reading(0, false),
                reading(25, false),
                reading(30, true),
            ],
            {
                connectionDown: true,
                commands: {
                    buzzer_on: true,
                    due_alarm_ids: ['alarm-1'],
                },
            }
        )

        expect(result.some(
            (item) => item.id === 'connection'
        )).toBe(true)

        expect(result.some(
            (item) => item.id === 'exit'
        )).toBe(false)

        expect(result.some(
            (item) => item.id === 'alarm'
        )).toBe(false)
    })

    it('reports missing sensor data', () => {
        const result = check([])

        expect(result[0]).toMatchObject({
            id: 'missing',
            level: 'warning',
        })
    })

    it('rejects invalid and future timestamps', () => {
        const invalid = reading(0, false, {
            recorded_at: 'not-a-date',
        })

        const future = reading(0, false, {
            recorded_at: new Date(
                now.getTime() + 5 * 60000
            ).toISOString(),
        })

        expect(isStale(invalid, now)).toBe(true)
        expect(isStale(future, now)).toBe(true)

        expect(
            check([invalid]).some(
                (item) => item.id === 'exit'
            )
        ).toBe(false)

        expect(
            check([future]).some(
                (item) => item.id === 'exit'
            )
        ).toBe(false)
    })

    it('labels stale temperature data as historical', () => {
        const result = check([
            reading(15, false, {
                temperature_c: 16,
            }),
        ])

        expect(result.find(
            (item) => item.id === 'cold'
        )).toMatchObject({
            title: 'Room was cold',
        })
    })
})
