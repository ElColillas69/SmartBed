
import { describe, expect, it } from 'vitest'

import {
    assessNight,
    summariseSleepQuality,
} from './sleepQuality'

const care = {
    sleepGoalMinutes: 450,
    lowTemp: 18,
    highTemp: 26,
    humidityLimit: 70,
}

const goodNight = {
    night: '2026-11-23',
    in_bed_minutes: 480,
    bed_exits: 0,
    avg_temperature_c: 21,
    avg_humidity_percent: 55,
    in_progress: false,
}

describe('SmartBed sleep quality assessment', () => {

    it('rates a completed goal-meeting night as good', () => {
        const result = assessNight(goodNight, care)

        expect(result.status).toBe('good')
        expect(result.label).toBe('Good night')
    })

    it('flags a night below the sleep goal', () => {
        const result = assessNight({
            ...goodNight,
            in_bed_minutes: 360,
        }, care)

        expect(result.status).toBe('poor')
        expect(result.reasons[0]).toContain('below')
    })

    it('flags recorded bed exits', () => {
        const result = assessNight({
            ...goodNight,
            bed_exits: 2,
        }, care)

        expect(result.status).toBe('poor')
        expect(result.reasons.join(' ')).toContain(
            '2 bed exits'
        )
    })

    it('flags high average temperature', () => {
        const result = assessNight({
            ...goodNight,
            avg_temperature_c: 29,
        }, care)

        expect(result.status).toBe('poor')
        expect(result.reasons.join(' ')).toContain(
            'above'
        )
    })

    it('flags low average temperature', () => {
        const result = assessNight({
            ...goodNight,
            avg_temperature_c: 15,
        }, care)

        expect(result.status).toBe('poor')
        expect(result.reasons.join(' ')).toContain(
            'below'
        )
    })

    it('flags humidity above preference', () => {
        const result = assessNight({
            ...goodNight,
            avg_humidity_percent: 82,
        }, care)

        expect(result.status).toBe('poor')
    })

    it('does not rate an ongoing night', () => {
        const result = assessNight({
            ...goodNight,
            in_progress: true,
        }, care)

        expect(result.status).toBe('unrated')
    })

    it('does not punish missing room measurements', () => {
        const result = assessNight({
            ...goodNight,
            avg_temperature_c: null,
            avg_humidity_percent: null,
        }, care)

        expect(result.status).toBe('good')
        expect(result.reasons.join(' ')).toContain(
            'unavailable'
        )
    })

    it('does not rate missing essential data', () => {
        const result = assessNight({
            ...goodNight,
            bed_exits: null,
        }, care)

        expect(result.status).toBe('unrated')
    })

    it('correctly counts good and concerning nights', () => {
        const result = summariseSleepQuality([
            goodNight,
            {
                ...goodNight,
                night: '2026-11-22',
                bed_exits: 2,
            },
            {
                ...goodNight,
                night: '2026-11-21',
                in_bed_minutes: 300,
            },
            {
                ...goodNight,
                night: '2026-11-24',
                in_progress: true,
            },
        ], care)

        expect(result.good).toBe(1)
        expect(result.poor).toBe(2)
        expect(result.unrated).toBe(0)
        expect(result.completed).toBe(3)
        expect(result.results).toHaveLength(4)
    })

})
