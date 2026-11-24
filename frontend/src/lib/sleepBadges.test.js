
import { describe, expect, it } from 'vitest'
import { evaluateSleepBadges } from './sleepBadges'

const care = {
    sleepGoalMinutes: 450,
    lowTemp: 18,
    highTemp: 26,
    humidityLimit: 70,
}

const dates = [
    '2026-11-23',
    '2026-11-22',
    '2026-11-21',
    '2026-11-20',
    '2026-11-19',
]

function night(date, overrides = {}) {
    return {
        night: date,
        in_bed_minutes: 480,
        bed_exits: 0,
        avg_temperature_c: 21,
        avg_humidity_percent: 55,
        in_progress: false,
        ...overrides,
    }
}

function badge(result, id) {
    return result.badges.find(
        (item) => item.id === id
    )
}

describe('SmartBed sleep rewards', () => {

    it('starts with all badges locked', () => {
        const result = evaluateSleepBadges([], care)

        expect(result.unlockedCount).toBe(0)
        expect(result.totalCount).toBe(6)
    })

    it('unlocks the first good night badge', () => {
        const result = evaluateSleepBadges([
            night(dates[0]),
        ], care)

        expect(
            badge(result, 'first-good-night').earned
        ).toBe(true)
    })

    it('unlocks Rest Builder after three good nights', () => {
        const result = evaluateSleepBadges(
            dates.slice(0, 3).map((date) => night(date)),
            care
        )

        expect(
            badge(result, 'rest-builder').earned
        ).toBe(true)
    })

    it('unlocks Rest Champion after five good nights', () => {
        const result = evaluateSleepBadges(
            dates.map((date) => night(date)),
            care
        )

        expect(
            badge(result, 'rest-champion').earned
        ).toBe(true)
    })

    it('tracks progress before a badge is unlocked', () => {
        const result = evaluateSleepBadges([
            night(dates[0]),
        ], care)

        const reward = badge(result, 'rest-builder')

        expect(reward.earned).toBe(false)
        expect(reward.current).toBe(1)
        expect(reward.remaining).toBe(2)
        expect(reward.progressPercent).toBe(33)
    })

    it('unlocks Goal Keeper after five nights meeting the goal', () => {
        const result = evaluateSleepBadges(
            dates.map((date) =>
                night(date, { bed_exits: 2 })
            ),
            care
        )

        expect(
            badge(result, 'goal-keeper').earned
        ).toBe(true)

        // Meeting the time goal alone is not
        // enough for a Good night rating.
        expect(result.counts.goodNights).toBe(0)
    })

    it('unlocks Peaceful Run for three consecutive nights with zero exits', () => {
        const result = evaluateSleepBadges(
            dates.slice(0, 3).map((date) =>
                night(date, { in_bed_minutes: 300 })
            ),
            care
        )

        expect(
            badge(result, 'peaceful-run').earned
        ).toBe(true)

        expect(
            badge(result, 'steady-rest').earned
        ).toBe(false)
    })

    it('unlocks Steady Rest for three consecutive good nights', () => {
        const result = evaluateSleepBadges(
            dates.slice(0, 3).map((date) => night(date)),
            care
        )

        expect(
            badge(result, 'steady-rest').earned
        ).toBe(true)
    })

    it('does not count separated dates as consecutive nights', () => {
        const result = evaluateSleepBadges([
            night('2026-11-23'),
            night('2026-11-21'),
            night('2026-11-20'),
        ], care)

        expect(result.counts.goodStreak).toBe(1)

        expect(
            badge(result, 'steady-rest').earned
        ).toBe(false)
    })

    it('resets the latest good streak when the latest night missed its goal', () => {
        const result = evaluateSleepBadges([
            night(dates[0], {
                in_bed_minutes: 200,
            }),
            night(dates[1]),
            night(dates[2]),
        ], care)

        expect(result.counts.goodStreak).toBe(0)
    })

    it('does not double count duplicate nights', () => {
        const result = evaluateSleepBadges([
            night(dates[0]),
            night(dates[0]),
        ], care)

        expect(result.completedCount).toBe(1)
        expect(result.counts.goodNights).toBe(1)
    })

    it('excludes ongoing nights from rewards', () => {
        const result = evaluateSleepBadges([
            night(dates[0], {
                in_progress: true,
            }),
        ], care)

        expect(result.completedCount).toBe(0)
        expect(result.unlockedCount).toBe(0)
    })

    it('does not award Good night badges when essential records are missing', () => {
        const result = evaluateSleepBadges([
            night(dates[0], {
                bed_exits: null,
            }),
        ], care)

        expect(result.counts.goodNights).toBe(0)

        expect(
            badge(result, 'first-good-night').earned
        ).toBe(false)
    })

})
