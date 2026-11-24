
import {
    Activity,
    CalendarCheck2,
    CheckCircle2,
    Info,
    MoonStar,
} from 'lucide-react'

import {
    analyseSleepHistory,
} from '../lib/sleepInsights'

import { duration, nightLabel } from '../lib/time'

import './SleepInsightsPanel.css'

export default function SleepInsightsPanel({
    nights,
    care,
    compact = false,
}) {
    const insights = analyseSleepHistory(nights, care)

    const sectionId = compact
        ? 'dashboard-sleep-insights'
        : 'history-sleep-insights'

    return (
        <section
            className="sleep-insights"
            aria-labelledby={sectionId}
        >
            <header className="sleep-insights__header">
                <div>
                    <p className="sleep-insights__eyebrow">
                        YOUR RESTING PROGRESS
                    </p>

                    <h2 id={sectionId}>
                        Uninterrupted-night tracker
                    </h2>

                    <p>
                        Celebrate nights with no recorded bed
                        exits and discover patterns in your
                        recent history.
                    </p>
                </div>

                <span className="sleep-insights__header-icon">
                    <MoonStar size={25} aria-hidden="true" />
                </span>
            </header>

            {/* Three connected progress statistics */}
            <dl className="sleep-insights__metrics">

                <div
                    className="sleep-insights__metric
                     sleep-insights__metric--positive"
                    title="Completed nights with zero recorded bed exits"
                >
                    <dt>
                        <CheckCircle2 size={19} aria-hidden="true" />
                        No recorded exits
                    </dt>

                    <dd>{insights.uninterruptedCount}</dd>

                    <p>
                        Of {insights.completedCount} completed
                        recorded nights
                    </p>
                </div>

                <div
                    className="sleep-insights__metric"
                    title="Consecutive nights with zero exits, ending at the latest completed record"
                >
                    <dt>
                        <CalendarCheck2
                            size={19}
                            aria-hidden="true"
                        />
                        Latest recorded streak
                    </dt>

                    <dd>
                        {insights.latestStreak}
                        <small>
                            {insights.latestStreak === 1
                                ? ' night'
                                : ' nights'}
                        </small>
                    </dd>

                    <p>
                        Consecutive calendar nights with
                        no recorded bed exits
                    </p>
                </div>

                <div
                    className="sleep-insights__metric"
                    title="Longest consecutive run within the available records"
                >
                    <dt>
                        <MoonStar size={19} aria-hidden="true" />
                        Longest recorded streak
                    </dt>

                    <dd>
                        {insights.longestStreak}
                        <small>
                            {insights.longestStreak === 1
                                ? ' night'
                                : ' nights'}
                        </small>
                    </dd>

                    <p>
                        Your longest uninterrupted run in
                        the currently loaded history
                    </p>
                </div>

            </dl>

            {/* Explain coverage instead of implying all-time data. */}
            <p className="sleep-insights__coverage">
                <Info size={15} aria-hidden="true" />

                {insights.completedCount === 0
                    ? 'No completed night records are available yet.'
                    : `Based on ${insights.completedCount} completed nights in the currently loaded history.`}

                {insights.unknownExitCount > 0 &&
                    ` ${insights.unknownExitCount} night(s) had unavailable bed-exit data and were not counted as uninterrupted.`}
            </p>

            {/* Night-by-night tracker, expanded on Nights page */}
            {!compact && (
                <div className="sleep-insights__history">
                    <h3>
                        Nights with no recorded bed exits
                    </h3>

                    {insights.uninterruptedNights.length === 0 ? (
                        <p className="sleep-insights__empty">
                            No uninterrupted nights have been
                            identified in the available records.
                        </p>
                    ) : (
                        <ul className="sleep-insights__night-list">
                            {insights.uninterruptedNights.map(
                                (night) => (
                                    <li key={night.date}>
                                        <div className="sleep-insights__night-date">
                                            <CheckCircle2
                                                size={18}
                                                aria-hidden="true"
                                            />

                                            <time dateTime={night.date}>
                                                {nightLabel(night.date)}
                                            </time>
                                        </div>

                                        <div className="sleep-insights__night-info">
                                            <span>
                                                {night.minutes === null
                                                    ? 'Time in bed unavailable'
                                                    : `${duration(night.minutes)} in bed`}
                                            </span>

                                            <span
                                                className={
                                                    `sleep-insights__quality ` +
                                                    `sleep-insights__quality--${night.rating.status}`
                                                }
                                                title={night.rating.reasons.join(' ')}
                                            >
                                                {night.rating.label}
                                            </span>
                                        </div>
                                    </li>
                                )
                            )}
                        </ul>
                    )}

                    <p className="sleep-insights__explanation">
                        A night can have no recorded bed exits
                        but still miss your time-in-bed goal.
                        Good-night ratings and uninterrupted-night
                        counts therefore use different criteria.
                    </p>
                </div>
            )}

            {/* Rule-based pattern recognition */}
            <div className="sleep-insights__patterns">
                <div className="sleep-insights__patterns-heading">
                    <Activity size={21} aria-hidden="true" />

                    <h3>Sleep pattern insights</h3>
                </div>

                <p className="sleep-insights__pattern-intro">
                    We compare your most recent completed nights
                    to identify repeated changes in bed occupancy
                    and room conditions.
                </p>

                {insights.patterns.length > 0 ? (
                    <ul className="sleep-insights__pattern-list">
                        {insights.patterns
                            .slice(0, compact ? 2 : undefined)
                            .map((pattern) => (
                                <li key={pattern.id}>
                                    <div>
                                        <strong>{pattern.title}</strong>
                                        <p>{pattern.description}</p>
                                    </div>

                                    <span className="sleep-insights__pattern-count">
                                        {pattern.affected}/{pattern.considered}
                                    </span>
                                </li>
                            ))}
                    </ul>
                ) : (
                    <p className="sleep-insights__no-patterns">
                        {insights.insightMessage}
                    </p>
                )}

                {insights.patterns.length > 0 && (
                    <p className="sleep-insights__pattern-note">
                        {insights.insightMessage}
                    </p>
                )}
            </div>

            <p className="sleep-insights__disclaimer">
                Zero recorded bed exits does not prove continuous
                sleep. Pattern findings are descriptive and cannot
                establish the cause of sleep disturbances.
            </p>
        </section>
    )
}
