
import { describe, expect, it } from 'vitest'
import { buildOccupancySegments } from './occupancy'

const end = Date.parse('2026-11-24T12:00:00Z')
const start = end - 3600_000

function reading(minute, occupied) {
    return {
        recorded_at: new Date(
            start + minute * 60_000
        ).toISOString(),
        occupied,
    }
}

function timeline(readings) {
    return buildOccupancySegments(readings, end, 1)
        .map((segment) => ({
            kind: segment.kind,
            from: (segment.from - start) / 60_000,
            to: (segment.to - start) / 60_000,
        }))
}

describe('SmartBed occupancy timeline', () => {
    it('shows gaps between distant readings', () => {
        expect(timeline([
            reading(35, false),
            reading(5, true),
        ])).toEqual([
            { kind: 'gap', from: 0, to: 5 },
            { kind: 'in', from: 5, to: 15 },
            { kind: 'gap', from: 15, to: 35 },
            { kind: 'out', from: 35, to: 45 },
            { kind: 'gap', from: 45, to: 60 },
        ])
    })

    it('shows no data when there are no readings', () => {
        expect(timeline([])).toEqual([
            { kind: 'gap', from: 0, to: 60 },
        ])
    })

    it('includes valid readings before the window', () => {
        expect(timeline([
            reading(-5, true),
        ])).toEqual([
            { kind: 'in', from: 0, to: 5 },
            { kind: 'gap', from: 5, to: 60 },
        ])
    })

    it('joins consecutive occupancy readings', () => {
        expect(timeline([
            reading(5, true),
            reading(8, true),
            reading(11, false),
        ])).toEqual([
            { kind: 'gap', from: 0, to: 5 },
            { kind: 'in', from: 5, to: 11 },
            { kind: 'out', from: 11, to: 21 },
            { kind: 'gap', from: 21, to: 60 },
        ])
    })

    it('rejects invalid and future readings', () => {
        expect(timeline([
            { recorded_at: 'invalid', occupied: true },
            reading(5, 'false'),
            reading(70, true),
        ])).toEqual([
            { kind: 'gap', from: 0, to: 60 },
        ])
    })

    it('produces ordered, non-overlapping segments', () => {
        const segments = buildOccupancySegments([
            reading(60, false),
            reading(25, true),
            reading(12, false),
            reading(40, true),
            reading(5, true),
        ], end, 1)

        expect(segments[0].from).toBe(start)
        expect(segments.at(-1).to).toBe(end)

        segments.forEach((segment, i) => {
            expect(segment.to).toBeGreaterThan(segment.from)

            if (i > 0) {
                expect(segments[i - 1].to).toBe(segment.from)
            }
        })
    })
})
