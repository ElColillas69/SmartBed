
import { parseTime } from './time'

// A pressure reading remains valid for at most 10 minutes.
export const OCCUPANCY_MAX_AGE_MS = 10 * 60_000

export function buildOccupancySegments(
    readings,
    end,
    hours = 8
) {
    const start = end - hours * 3600_000

    // Validate and sort readings chronologically.
    // Include readings just before the visible window
    // if they are still fresh at its start.
    const samples = (Array.isArray(readings) ? readings : [])
        .map((reading) => ({
            t: parseTime(reading?.recorded_at)?.getTime(),
            occupied: reading?.occupied,
        }))
        .filter((reading) =>
            Number.isFinite(reading.t) &&
            typeof reading.occupied === 'boolean' &&
            reading.t <= end &&
            reading.t + OCCUPANCY_MAX_AGE_MS > start
        )
        .sort((a, b) => a.t - b.t)

    const segments = []

    function addSegment(kind, from, to) {
        if (to <= from) return

        const previous = segments.at(-1)

        // Combine neighbouring segments with the same state.
        if (previous?.kind === kind && previous.to === from) {
            previous.to = to
        } else {
            segments.push({ kind, from, to })
        }
    }

    let cursor = start

    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]

        const from = Math.max(
            start,
            cursor,
            sample.t
        )

        // Missing readings become an explicit gap.
        if (from > cursor) {
            addSegment('gap', cursor, from)
        }

        // Never extend occupancy beyond the reading's
        // validity, the next reading, or the chart end.
        const to = Math.min(
            end,
            sample.t + OCCUPANCY_MAX_AGE_MS,
            samples[i + 1]?.t ?? end
        )

        addSegment(
            sample.occupied ? 'in' : 'out',
            from,
            to
        )

        cursor = Math.max(cursor, from, to)
    }

    // Include missing data after the final reading.
    if (cursor < end) {
        addSegment('gap', cursor, end)
    }

    return segments
}
