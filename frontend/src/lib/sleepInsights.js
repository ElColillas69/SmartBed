
import { assessNight } from './sleepQuality.js'

const DAY_MS = 24 * 60 * 60 * 1000

const isFiniteNumber = (value) =>
    typeof value === 'number' &&
    Number.isFinite(value)

const validCount = (value) =>
    Number.isInteger(value) && value >= 0

// Use calendar days, not array positions,
// when calculating consecutive-night streaks.
function dayIndex(dateText) {
    if (
        typeof dateText !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateText)
    ) {
        return null
    }

    const [year, month, day] = dateText
        .split('-')
        .map(Number)

    const utc = Date.UTC(year, month - 1, day)

    if (
        !Number.isFinite(utc) ||
        new Date(utc).toISOString().slice(0, 10) !== dateText
    ) {
        return null
    }

    return utc / DAY_MS
}

// Exclude ongoing nights and duplicate dates.
// Sort newest night first.
function completedNights(nights) {
    const unique = new Map()

    for (const night of Array.isArray(nights) ? nights : []) {
        if (
            !night ||
            night.in_progress === true ||
            dayIndex(night.night) === null
        ) {
            continue
        }

        if (!unique.has(night.night)) {
            unique.set(night.night, night)
        }
    }

    return [...unique.values()].sort(
        (a, b) => b.night.localeCompare(a.night)
    )
}

// Recognise repeated observations only when
// enough records exist to support the message.
function repeatedPattern({
    id,
    title,
    affected,
    considered,
    observation,
}) {
    if (
        considered < 4 ||
        affected < 2 ||
        affected * 2 < considered
    ) {
        return null
    }

    return {
        id,
        title,
        affected,
        considered,
        description:
            `${affected} of ${considered} recorded nights ` +
            `${observation}.`,
    }
}

/*
 * Shared analysis for:
 * - Uninterrupted nights
 * - Consecutive-night streaks
 * - Recognised sleep/environment patterns
 *
 * Future rewards and tips will use these results.
 */
export function analyseSleepHistory(nights, care) {
    const completed = completedNights(nights)

    // Only the latest seven recorded nights are used
    // for pattern recognition.
    const recent = completed.slice(0, 7)

    // -----------------------------------
    // UNINTERRUPTED-NIGHT TRACKER
    // -----------------------------------

    const uninterruptedNights = completed
        .filter((night) => night.bed_exits === 0)
        .map((night) => ({
            date: night.night,

            minutes: isFiniteNumber(
                night.in_bed_minutes
            )
                ? night.in_bed_minutes
                : null,

            // Reuse Commit 4's classification.
            rating: assessNight(night, care),
        }))

    // Latest streak starts at the newest
    // completed night and ends at the first
    // recorded interruption or missing date.
    let latestStreak = 0

    for (let index = 0; index < completed.length; index++) {
        const night = completed[index]

        if (night.bed_exits !== 0) break

        if (index > 0) {
            const previousDay = dayIndex(
                completed[index - 1].night
            )

            const currentDay = dayIndex(night.night)

            if (previousDay - currentDay !== 1) break
        }

        latestStreak++
    }

    // Longest consecutive uninterrupted streak
    // within the available records.
    let longestStreak = 0
    let run = 0
    let previousDay = null

    for (const night of completed) {
        const currentDay = dayIndex(night.night)

        const consecutive =
            previousDay !== null &&
            previousDay - currentDay === 1

        if (night.bed_exits === 0) {
            run = consecutive ? run + 1 : 1
        } else {
            run = 0
        }

        longestStreak = Math.max(longestStreak, run)
        previousDay = currentDay
    }

    // -----------------------------------
    // PATTERN RECOGNITION
    // -----------------------------------

    const exitsMeasured = recent.filter(
        (night) => validCount(night.bed_exits)
    )

    const hadExits = exitsMeasured.filter(
        (night) => night.bed_exits > 0
    )

    // Time-in-bed goal
    const goal = care?.sleepGoalMinutes

    const goalMeasured =
        isFiniteNumber(goal) && goal > 0
            ? recent.filter(
                (night) =>
                    isFiniteNumber(night.in_bed_minutes) &&
                    night.in_bed_minutes >= 0
            )
            : []

    const underGoal = goalMeasured.filter(
        (night) => night.in_bed_minutes < goal
    )

    // Temperature patterns
    const low = care?.lowTemp
    const high = care?.highTemp

    const tempMeasured =
        isFiniteNumber(low) &&
            isFiniteNumber(high) &&
            low <= high
            ? recent.filter(
                (night) =>
                    isFiniteNumber(
                        night.avg_temperature_c
                    )
            )
            : []

    const tooWarm = tempMeasured.filter(
        (night) => night.avg_temperature_c > high
    )

    const tooCool = tempMeasured.filter(
        (night) => night.avg_temperature_c < low
    )

    // Humidity patterns
    const humLimit = care?.humidityLimit

    const humidityMeasured = isFiniteNumber(humLimit)
        ? recent.filter(
            (night) =>
                isFiniteNumber(
                    night.avg_humidity_percent
                )
        )
        : []

    const humid = humidityMeasured.filter(
        (night) =>
            night.avg_humidity_percent > humLimit
    )

    const patterns = [
        repeatedPattern({
            id: 'exits',
            title: 'Repeated nighttime bed exits',
            affected: hadExits.length,
            considered: exitsMeasured.length,
            observation:
                'included at least one recorded bed exit',
        }),

        repeatedPattern({
            id: 'short',
            title: 'Time-in-bed goal often missed',
            affected: underGoal.length,
            considered: goalMeasured.length,
            observation:
                'were below your time-in-bed goal',
        }),

        repeatedPattern({
            id: 'warm',
            title: 'Room frequently above preferred temperature',
            affected: tooWarm.length,
            considered: tempMeasured.length,
            observation:
                'had average temperatures above your preference',
        }),

        repeatedPattern({
            id: 'cool',
            title: 'Room frequently below preferred temperature',
            affected: tooCool.length,
            considered: tempMeasured.length,
            observation:
                'had average temperatures below your preference',
        }),

        repeatedPattern({
            id: 'humidity',
            title: 'Humidity frequently above preference',
            affected: humid.length,
            considered: humidityMeasured.length,
            observation:
                'had average humidity above your preference',
        }),
    ].filter(Boolean)

    // -----------------------------------
    // FINAL SHARED RESULTS
    // -----------------------------------

    return {
        completedCount: completed.length,

        uninterruptedCount:
            uninterruptedNights.length,

        unknownExitCount: completed.filter(
            (night) => !validCount(night.bed_exits)
        ).length,

        latestStreak,
        longestStreak,

        latestUninterruptedDate:
            uninterruptedNights[0]?.date ?? null,

        uninterruptedNights,

        recentCount: recent.length,
        patterns,

        insightMessage:
            recent.length < 4
                ? 'At least four completed recorded nights are needed before SmartBed highlights repeated patterns.'
                : patterns.length === 0
                    ? 'No repeated concerns met the pattern threshold in the available recent nights.'
                    : `Patterns compare your latest ${recent.length} completed recorded nights. They show observations, not causes.`,
    }
}
