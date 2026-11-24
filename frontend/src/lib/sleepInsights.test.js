
import { describe, expect, it } from 'vitest'
import { analyseSleepHistory } from './sleepInsights'

const care = {
    sleepGoalMinutes: 450,
    lowTemp: 18,
    highTemp: 26,
    humidityLimit: 70,
}

const night = (date, exits, overrides = {}) => ({
    night: date,
    bed_exits: exits,
    in_bed_minutes: 480,
    avg_temperature_c: 21,
    avg_humidity_percent: 55,
    in_progress: false,
    ...overrides,
})

describe('SmartBed uninterrupted-night tracking', () => {
    it('counts nights with zero recorded exits', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', 0),
            night('2026-11-22', 2),
            night('2026-11-21', 0),
        ], care)

        expect(result.uninterruptedCount).toBe(2)
    })

    it('excludes unfinished nights', () => {
        const result = analyseSleepHistory([
            night('2026-11-24', 0, {
                in_progress: true,
            }),
            night('2026-11-23', 0),
        ], care)

        expect(result.completedCount).toBe(1)
        expect(result.uninterruptedCount).toBe(1)
    })

    it('does not count missing exit data as zero', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', null),
            night('2026-11-22', 0),
        ], care)

        expect(result.uninterruptedCount).toBe(1)
        expect(result.unknownExitCount).toBe(1)
    })

    it('calculates consecutive calendar-day streaks', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', 0),
            night('2026-11-22', 0),
            night('2026-11-21', 0),
            night('2026-11-20', 1),
        ], care)

        expect(result.latestStreak).toBe(3)
        expect(result.longestStreak).toBe(3)
    })

    it('breaks a streak when a date is missing', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', 0),
            night('2026-11-22', 0),
            night('2026-11-20', 0),
        ], care)

        expect(result.latestStreak).toBe(2)
        expect(result.longestStreak).toBe(2)
    })

    it('reports zero latest streak after a bed exit', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', 1),
            night('2026-11-22', 0),
            night('2026-11-21', 0),
        ], care)

        expect(result.latestStreak).toBe(0)
        expect(result.longestStreak).toBe(2)
    })

    it('keeps uninterrupted and good ratings separate', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', 0, {
                in_bed_minutes: 300,
            }),
        ], care)

        expect(result.uninterruptedCount).toBe(1)
        expect(
            result.uninterruptedNights[0].rating.status
        ).toBe('poor')
    })

    it('detects repeated recorded bed exits', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', 2),
            night('2026-11-22', 1),
            night('2026-11-21', 1),
            night('2026-11-20', 0),
        ], care)

        expect(
            result.patterns.some(
                (pattern) => pattern.id === 'exits'
            )
        ).toBe(true)
    })

    it('detects repeated high room temperature', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', 0, {
                avg_temperature_c: 29,
            }),
            night('2026-11-22', 0, {
                avg_temperature_c: 28,
            }),
            night('2026-11-21', 0, {
                avg_temperature_c: 22,
            }),
            night('2026-11-20', 0, {
                avg_temperature_c: 21,
            }),
        ], care)

        expect(
            result.patterns.some(
                (pattern) => pattern.id === 'warm'
            )
        ).toBe(true)
    })

    it('does not declare patterns with too little data', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', 2),
            night('2026-11-22', 1),
            night('2026-11-21', 2),
        ], care)

        expect(result.patterns).toHaveLength(0)
        expect(result.insightMessage).toContain(
            'four completed recorded nights'
        )
    })

    it('does not double-count duplicate night dates', () => {
        const result = analyseSleepHistory([
            night('2026-11-23', 0),
            night('2026-11-23', 0),
            night('2026-11-22', 0),
        ], care)

        expect(result.completedCount).toBe(2)
        expect(result.uninterruptedCount).toBe(2)
    })
})
