
import {
    ThumbsUp,
    ThumbsDown,
    CircleHelp,
} from 'lucide-react'

import { nightLabel, duration } from '../lib/time'
import {
    summariseSleepQuality,
} from '../lib/sleepQuality'

import './SleepQualityPanel.css'

// Choose the correct icon for each rating.
function QualityIcon({ status, size = 19 }) {
    if (status === 'good') {
        return (
            <ThumbsUp
                size={size}
                strokeWidth={2.2}
                aria-hidden="true"
            />
        )
    }

    if (status === 'poor') {
        return (
            <ThumbsDown
                size={size}
                strokeWidth={2.2}
                aria-hidden="true"
            />
        )
    }

    return (
        <CircleHelp
            size={size}
            aria-hidden="true"
        />
    )
}

// A single completed or ongoing night.
function NightRating({ night, assessment }) {
    const minutes = night.in_bed_minutes
    const exits = night.bed_exits

    return (
        <article
            className={
                `sleep-quality__night ` +
                `sleep-quality__night--${assessment.status}`
            }
            title={assessment.reasons.join(' ')}
        >
            <div className="sleep-quality__night-top">
                <div>
                    <h4>
                        {night.night
                            ? nightLabel(night.night)
                            : 'Unknown night'}
                    </h4>

                    <p>
                        {typeof minutes === 'number' &&
                            Number.isFinite(minutes)
                            ? duration(minutes)
                            : '—'}{' '}
                        in bed
                    </p>
                </div>

                <span
                    className={
                        `sleep-quality__rating ` +
                        `sleep-quality__rating--${assessment.status}`
                    }
                >
                    <QualityIcon status={assessment.status} />
                    {assessment.label}
                </span>
            </div>

            <p className="sleep-quality__exits">
                {Number.isInteger(exits) && exits >= 0
                    ? `${exits} bed exit${exits === 1 ? '' : 's'} recorded`
                    : 'Bed exits unavailable'}
            </p>

            {/* Works on desktop, touchscreens and keyboards. */}
            <details className="sleep-quality__details">
                <summary>
                    Why this rating?
                </summary>

                <ul>
                    {assessment.reasons.map((reason, index) => (
                        <li key={index}>{reason}</li>
                    ))}
                </ul>
            </details>
        </article>
    )
}

export default function SleepQualityPanel({
    nights,
    care,
}) {
    const summary = summariseSleepQuality(
        nights,
        care
    )

    return (
        <section
            className="sleep-quality"
            aria-labelledby="sleep-quality-heading"
        >
            <header className="sleep-quality__header">
                <div>
                    <p className="sleep-quality__eyebrow">
                        YOUR RESTING PATTERNS
                    </p>

                    <h2 id="sleep-quality-heading">
                        How were your recent nights?
                    </h2>

                    <p>
                        See which recorded nights met your goals
                        and which ones may need attention.
                    </p>
                </div>
            </header>

            {/* Overview counters */}
            <div className="sleep-quality__totals">

                <div className="sleep-quality__total sleep-quality__total--good">
                    <ThumbsUp
                        size={27}
                        aria-hidden="true"
                    />

                    <strong>{summary.good}</strong>
                    <span>Good nights</span>
                </div>

                <div className="sleep-quality__total sleep-quality__total--poor">
                    <ThumbsDown
                        size={27}
                        aria-hidden="true"
                    />

                    <strong>{summary.poor}</strong>
                    <span>Needs attention</span>
                </div>

                <div className="sleep-quality__total sleep-quality__total--unrated">
                    <CircleHelp
                        size={27}
                        aria-hidden="true"
                    />

                    <strong>{summary.unrated}</strong>
                    <span>Completed but unrated</span>
                </div>

            </div>

            <p className="sleep-quality__context">
                Based on {summary.completed} completed night
                {summary.completed === 1 ? '' : 's'} available
                in your recent history. Ongoing nights are
                not included in these totals.
            </p>

            {/* Detailed rating for every available night */}
            <div className="sleep-quality__history">
                <h3>Night-by-night ratings</h3>

                {summary.results.length === 0 ? (
                    <p className="sleep-quality__empty">
                        No night records are available yet.
                    </p>
                ) : (
                    <div className="sleep-quality__night-grid">
                        {summary.results.map(
                            ({ night, assessment }, index) => (
                                <NightRating
                                    key={`${night.night ?? 'unknown'}-${index}`}
                                    night={night}
                                    assessment={assessment}
                                />
                            )
                        )}
                    </div>
                )}
            </div>

            <p className="sleep-quality__disclaimer">
                Ratings are estimates based on time in bed,
                bed exits and available room measurements.
                They do not measure actual sleep quality.
            </p>
        </section>
    )
}
