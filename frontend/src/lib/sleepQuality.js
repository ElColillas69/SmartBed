
import { duration } from './time.js'

const validNumber = (value) =>
    typeof value === 'number' && Number.isFinite(value)

const validNonNegative = (value) =>
    validNumber(value) && value >= 0

/*
 * Rule-based assessment of a recorded night.
 *
 * This estimates how well the night met the
 * resident's goals. It does NOT measure actual
 * sleep quality or diagnose sleep problems.
 */
export function assessNight(night, care) {
    const unrated = (reason) => ({
        status: 'unrated',
        label: 'Not rated',
        reasons: [reason],
    })

    if (!night || typeof night !== 'object') {
        return unrated('No night record was available.')
    }

    // Never judge an unfinished night.
    if (night.in_progress) {
        return unrated(
            'This night is still in progress. A rating will appear when it is complete.'
        )
    }

    const minutes = night.in_bed_minutes
    const exits = night.bed_exits
    const goal = care?.sleepGoalMinutes

    // Essential data must be valid.
    if (
        !validNonNegative(minutes) ||
        !Number.isInteger(exits) ||
        exits < 0 ||
        !validNumber(goal) ||
        goal <= 0
    ) {
        return unrated(
            'Not enough reliable time-in-bed, bed-exit or goal information to rate this night.'
        )
    }

    const concerns = []

    // 1. Did the resident meet the time-in-bed goal?
    if (minutes < goal) {
        concerns.push(
            `Time in bed was ${duration(minutes)}, below your ${duration(goal)} goal.`
        )
    }

    // 2. Were any bed exits recorded?
    if (exits > 0) {
        concerns.push(
            `${exits} bed exit${exits === 1 ? ' was' : 's were'} recorded during the night.`
        )
    }

    // 3. Check environmental comfort when available.
    const temp = night.avg_temperature_c
    const humidity = night.avg_humidity_percent

    const low = care?.lowTemp
    const high = care?.highTemp
    const humidityLimit = care?.humidityLimit

    const temperatureComparable =
        validNumber(temp) &&
        validNumber(low) &&
        validNumber(high) &&
        low <= high

    const humidityComparable =
        validNumber(humidity) &&
        validNumber(humidityLimit)

    if (temperatureComparable && temp < low) {
        concerns.push(
            `Average room temperature was ${temp.toFixed(1)}°C, below your ${low}°C preference.`
        )
    } else if (temperatureComparable && temp > high) {
        concerns.push(
            `Average room temperature was ${temp.toFixed(1)}°C, above your ${high}°C preference.`
        )
    }

    if (
        humidityComparable &&
        humidity > humidityLimit
    ) {
        concerns.push(
            `Average humidity was ${Math.round(humidity)}%, above your ${humidityLimit}% preference.`
        )
    }

    // Any unmet goal means the night needs attention.
    if (concerns.length > 0) {
        return {
            status: 'poor',
            label: 'Needs attention',
            reasons: concerns,
        }
    }

    // The recorded night met all available criteria.
    const reasons = [
        `Time in bed met your ${duration(goal)} goal.`,
        'No bed exits were recorded.',
    ]

    if (
        temperatureComparable &&
        humidityComparable
    ) {
        reasons.push(
            'Recorded average temperature and humidity were within your preferences.'
        )
    } else {
        reasons.push(
            'Some room comfort measurements were unavailable and were not included in this rating.'
        )
    }

    return {
        status: 'good',
        label: 'Good night',
        reasons,
    }
}

/*
 * Use the exact same assessment for every
 * night and for the summary counters.
 *
 * This will also power future badges,
 * uninterrupted-night tracking and insights.
 */
export function summariseSleepQuality(nights, care) {
    const records = Array.isArray(nights)
        ? nights.filter(Boolean)
        : []

    const results = records
        .map((night) => ({
            night,
            assessment: assessNight(night, care),
        }))
        .sort((a, b) =>
            String(b.night.night ?? '').localeCompare(
                String(a.night.night ?? '')
            )
        )

    const completed = results.filter(
        ({ night }) => !night.in_progress
    )

    const good = completed.filter(
        ({ assessment }) =>
            assessment.status === 'good'
    ).length

    const poor = completed.filter(
        ({ assessment }) =>
            assessment.status === 'poor'
    ).length

    const unrated = completed.filter(
        ({ assessment }) =>
            assessment.status === 'unrated'
    ).length

    return {
        results,
        good,
        poor,
        unrated,
        completed: completed.length,
    }
}
