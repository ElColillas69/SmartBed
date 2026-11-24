
import { assessNight } from './sleepQuality.js'
import { analyseSleepHistory } from './sleepInsights.js'

const DAY_MS = 24 * 60 * 60 * 1000

// Check that each date is a real calendar date.
function calendarDay(dateText) {
    if (
        typeof dateText !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateText)
    ) {
        return null
    }

    const [year, month, day] = dateText
        .split('-')
        .map(Number)

    const date = Date.UTC(year, month - 1, day)

    if (
        !Number.isFinite(date) ||
        new Date(date).toISOString().slice(0, 10) !== dateText
    ) {
        return null
    }

    return date / DAY_MS
}

// Do not count duplicate dates or nights still in progress.
function completedUniqueNights(nights) {
    const unique = new Map()

    for (const night of Array.isArray(nights) ? nights : []) {
        if (
            !night ||
            night.in_progress === true ||
            calendarDay(night.night) === null
        ) {
            continue
        }

        if (!unique.has(night.night)) {
            unique.set(night.night, night)
        }
    }

    return [...unique.values()].sort((a, b) =>
        b.night.localeCompare(a.night)
    )
}

// Calculate consecutive Good nights.
// Dates must be adjacent calendar days.
function latestGoodStreak(completed, care) {
    let streak = 0
    let previousDay = null

    for (const night of completed) {
        const today = calendarDay(night.night)

        if (assessNight(night, care).status !== 'good') {
            break
        }

        if (
            previousDay !== null &&
            previousDay - today !== 1
        ) {
            break
        }

        streak += 1
        previousDay = today
    }

    return streak
}

// Every badge has a clear, measurable requirement.
const BADGES = [
    {
        id: 'first-good-night',
        name: 'First Good Night',
        description:
            'Your first recorded night meeting the SmartBed comfort rules.',
        criteria:
            'Have 1 completed night rated Good night by SmartBed.',
        metric: 'goodNights',
        target: 1,
    },
    {
        id: 'rest-builder',
        name: 'Rest Builder',
        description:
            'You are building a more consistent bedtime routine.',
        criteria:
            'Have 3 completed nights rated Good night in the loaded history.',
        metric: 'goodNights',
        target: 3,
    },
    {
        id: 'rest-champion',
        name: 'Rest Champion',
        description:
            'Five recorded nights have met your chosen comfort goals.',
        criteria:
            'Have 5 completed nights rated Good night in the loaded history.',
        metric: 'goodNights',
        target: 5,
    },
    {
        id: 'goal-keeper',
        name: 'Goal Keeper',
        description:
            'You have made time for your chosen time-in-bed goal.',
        criteria:
            'Meet or exceed your time-in-bed goal on 5 completed nights, regardless of recorded bed exits.',
        metric: 'goalNights',
        target: 5,
    },
    {
        id: 'peaceful-run',
        name: 'Peaceful Run',
        description:
            'Three consecutive recorded nights without a bed exit.',
        criteria:
            'Have 3 consecutive calendar nights with zero recorded bed exits, ending with the latest completed night.',
        metric: 'noExitStreak',
        target: 3,
    },
    {
        id: 'steady-rest',
        name: 'Steady Rest',
        description:
            'Three consecutive recorded nights rated Good night.',
        criteria:
            'Have 3 consecutive calendar nights rated Good night, ending with the latest completed night.',
        metric: 'goodStreak',
        target: 3,
    },
]

// Shared badge evaluation function.
// The Dashboard and Nights pages use the same results.
export function evaluateSleepBadges(nights, care) {
    const completed = completedUniqueNights(nights)

    // Reuse the rating rules from Commit 4.
    const goodNights = completed.filter(
        (night) =>
            assessNight(night, care).status === 'good'
    ).length

    // Count nights meeting the configured time-in-bed goal.
    const goal = care?.sleepGoalMinutes

    const goalNights =
        typeof goal === 'number' &&
            Number.isFinite(goal) &&
            goal > 0
            ? completed.filter(
                (night) =>
                    typeof night.in_bed_minutes === 'number' &&
                    Number.isFinite(night.in_bed_minutes) &&
                    night.in_bed_minutes >= goal
            ).length
            : 0

    // Reuse the uninterrupted-night engine from Commit 5.
    const insights = analyseSleepHistory(completed, care)

    const counts = {
        goodNights,
        goalNights,
        noExitStreak: insights.latestStreak,
        goodStreak: latestGoodStreak(completed, care),
    }

    // Determine progress and unlock status for each badge.
    const badges = BADGES.map((definition) => {
        const current = counts[definition.metric]

        const earned = current >= definition.target

        const remaining = Math.max(
            0,
            definition.target - current
        )

        const consecutive =
            definition.metric.endsWith('Streak')

        return {
            ...definition,
            current,
            earned,
            remaining,

            progressPercent: Math.min(
                100,
                Math.round(
                    (current / definition.target) * 100
                )
            ),

            progressText: earned
                ? 'Unlocked in the currently loaded history'
                : `${remaining} more ${consecutive ? 'consecutive ' : ''
                }qualifying night${remaining === 1 ? '' : 's'
                } needed`,
        }
    })

    return {
        badges,

        unlockedCount: badges.filter(
            (badge) => badge.earned
        ).length,

        totalCount: badges.length,
        completedCount: completed.length,
        counts,
    }
}
