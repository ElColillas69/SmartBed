
import {
    AlarmClock,
    BedDouble,
    Heart,
    ShieldCheck,
    ThermometerSun,
} from 'lucide-react'

import { useBed } from '../lib/BedData'
import { getDashboardSummary } from '../lib/dashboardSummary'
import './DashboardOverview.css'
import SleepInsightsPanel from './SleepInsightsPanel'

export default function DashboardOverview() {
    const {
        live,
        nights,
        alarms,
        care,
    } = useBed()

    const summary = getDashboardSummary({
        live,
        nights,
        alarms,
        care,
    })

    return (
        <section
            className="comfort-glance"
            aria-labelledby="comfort-glance-heading"
        >
            <div className="comfort-glance__heading">
                <div>
                    <p className="comfort-glance__eyebrow">
                        YOUR SLEEP & COMFORT
                    </p>

                    <h2 id="comfort-glance-heading">
                        At a glance
                    </h2>

                    <p>
                        A clearer view of your bed,
                        room and nighttime routine.
                    </p>
                </div>

                <span className="comfort-glance__intro-icon">
                    <Heart size={23} aria-hidden="true" />
                </span>
            </div>

            <div className="comfort-glance__grid">

                {/* Night summary */}
                <article className="comfort-glance__card">
                    <div className="comfort-glance__card-heading">
                        <BedDouble size={21} aria-hidden="true" />
                        <h3>Time in bed</h3>
                    </div>

                    <p className="comfort-glance__metric">
                        {summary.night.metric}
                    </p>

                    <p className="comfort-glance__subtitle">
                        {summary.night.label}
                    </p>

                    {summary.night.progress !== null && (
                        <div className="comfort-glance__progress">
                            <progress
                                value={Math.min(
                                    100,
                                    Math.max(0, summary.night.progress)
                                )}
                                max={100}
                                aria-label={summary.night.progressLabel}
                            />

                            <span>
                                {summary.night.progressLabel}
                            </span>
                        </div>
                    )}

                    <p className="comfort-glance__detail">
                        {summary.night.detail}
                    </p>
                </article>

                {/* Room environment */}
                <article
                    className={
                        `comfort-glance__card ` +
                        `comfort-glance__card--${summary.room.tone}`
                    }
                    title={summary.room.detail}
                >
                    <div className="comfort-glance__card-heading">
                        <ThermometerSun
                            size={21}
                            aria-hidden="true"
                        />
                        <h3>Room comfort</h3>
                    </div>

                    <p className="comfort-glance__metric comfort-glance__metric--room">
                        {summary.room.metric}
                    </p>

                    <p className="comfort-glance__subtitle">
                        {summary.room.label}
                    </p>

                    <p className="comfort-glance__detail">
                        {summary.room.detail}
                    </p>
                </article>

                {/* Monitoring status */}
                <article
                    className={
                        `comfort-glance__card ` +
                        `comfort-glance__card--${summary.connection.tone}`
                    }
                    title={summary.connection.detail}
                >
                    <div className="comfort-glance__card-heading">
                        <ShieldCheck size={21} aria-hidden="true" />
                        <h3>Monitoring</h3>
                    </div>

                    <p className="comfort-glance__metric comfort-glance__metric--text">
                        {summary.connection.metric}
                    </p>

                    <p className="comfort-glance__detail">
                        {summary.connection.detail}
                    </p>
                </article>

                {/* Next alarm */}
                <article className="comfort-glance__card">
                    <div className="comfort-glance__card-heading">
                        <AlarmClock size={21} aria-hidden="true" />
                        <h3>Next alarm</h3>
                    </div>

                    <p className="comfort-glance__metric">
                        {summary.alarm.metric}
                    </p>

                    <p className="comfort-glance__detail">
                        {summary.alarm.detail}
                    </p>
                </article>

            </div>

            <p className="comfort-glance__footnote">
                Monitoring summaries are based on recorded sensor
                information. Time in bed is not the same as
                measured sleep duration.
            </p>
            <SleepInsightsPanel nights={nights?.data} care={care} compact />
        </section>
    )
}
