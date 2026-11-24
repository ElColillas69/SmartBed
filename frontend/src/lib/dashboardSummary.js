
import { getMonitoringStatus } from './monitorStatus'
import { duration, nextAlarm, nightLabel } from './time'

// Accept only valid numerical measurements.
function validNumber(value) {
    return typeof value === 'number' &&
        Number.isFinite(value)
        ? value
        : null
}

export function getDashboardSummary({
    live,
    nights,
    alarms,
    care,
    now = new Date(),
}) {
    const monitoring = getMonitoringStatus(live, now)
    const latest = live?.data?.latest ?? null

    // ------------------------------------
    // 1. Latest completed night
    // ------------------------------------

    const completed = Array.isArray(nights?.data)
        ? nights.data.filter(
            (night) => night && !night.in_progress
        )
        : []

    const lastNight = completed[0] ?? null

    const minutes = validNumber(
        lastNight?.in_bed_minutes
    )

    const goal = validNumber(
        care?.sleepGoalMinutes
    )

    const progress = (
        minutes !== null &&
        goal !== null &&
        goal > 0
    )
        ? Math.round((minutes / goal) * 100)
        : null

    const night = {
        metric: minutes === null
            ? '—'
            : duration(minutes),

        label: lastNight
            ? 'Latest completed night'
            : 'No completed nights yet',

        detail: !lastNight
            ? 'A summary will appear after a night has been recorded.'
            : goal === null
                ? 'Time spent in bed, based on recorded occupancy.'
                : `${nightLabel(lastNight.night)} · Goal: ${duration(goal)} · ${lastNight.bed_exits ?? '—'} bed exits recorded.`,

        progress,

        progressLabel: progress === null
            ? null
            : `${progress}% of your time-in-bed goal`,
    }

    // ------------------------------------
    // 2. Room comfort
    // ------------------------------------

    const temperature = validNumber(
        latest?.temperature_c
    )

    const humidity = validNumber(
        latest?.humidity_percent
    )

    const lower = validNumber(care?.lowTemp)
    const upper = validNumber(care?.highTemp)
    const humidityLimit = validNumber(
        care?.humidityLimit
    )

    const roomMetric = [
        temperature === null
            ? '—°C'
            : `${temperature.toFixed(1)}°C`,

        humidity === null
            ? '—%'
            : `${Math.round(humidity)}%`,
    ].join(' · ')

    let roomTone = 'unknown'
    let roomLabel = 'Comfort not confirmed'
    let roomDetail =
        'Waiting for recent temperature and humidity measurements.'

    if (latest && monitoring.kind !== 'ok') {
        roomDetail =
            'These are historical measurements. Current room conditions cannot be confirmed.'
    } else if (
        monitoring.kind === 'ok' &&
        temperature !== null &&
        humidity !== null &&
        lower !== null &&
        upper !== null &&
        humidityLimit !== null
    ) {
        const issues = []

        if (temperature < lower) {
            issues.push('below preferred temperature')
        }

        if (temperature > upper) {
            issues.push('above preferred temperature')
        }

        if (humidity > humidityLimit) {
            issues.push('above preferred humidity')
        }

        if (issues.length) {
            roomTone = 'watch'
            roomLabel = 'Comfort needs attention'
            roomDetail = issues.join(' · ')
        } else {
            roomTone = 'good'
            roomLabel = 'Within preferred ranges'
            roomDetail =
                'The latest recorded temperature and humidity are within your saved preferences.'
        }
    } else if (monitoring.kind === 'ok') {
        roomDetail =
            'Some room readings or saved comfort preferences are unavailable.'
    }

    const room = {
        metric: roomMetric,
        label: roomLabel,
        detail: roomDetail,
        tone: roomTone,
    }

    // ------------------------------------
    // 3. Monitoring reliability
    // ------------------------------------

    const connection = {
        metric: monitoring.label,
        detail: monitoring.detail,
        tone: monitoring.kind === 'ok'
            ? 'good'
            : monitoring.kind === 'wait'
                ? 'unknown'
                : 'watch',
    }

    // ------------------------------------
    // 4. Upcoming alarm
    // ------------------------------------

    const alarmData = Array.isArray(alarms?.data)
        ? alarms.data
        : []

    const upcoming = nextAlarm(alarmData, now)

    let alarmMetric = 'None set'
    let alarmDetail =
        'No enabled alarms are currently scheduled.'

    if (alarms?.error) {
        alarmMetric = 'Unavailable'
        alarmDetail =
            'The alarm schedule could not be refreshed.'
    } else if (!alarms?.data && alarms?.loading) {
        alarmMetric = 'Loading'
        alarmDetail = 'Checking upcoming alarms.'
    } else if (upcoming) {
        alarmMetric = upcoming.time
        alarmDetail =
            'Next enabled alarm, shown in local time.'
    }

    const alarm = {
        metric: alarmMetric,
        detail: alarmDetail,
    }

    return {
        night,
        room,
        connection,
        alarm,
    }
}
