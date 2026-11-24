
import {
    Award,
    CheckCircle2,
    LockKeyhole,
    Medal,
    MoonStar,
    Star,
    Target,
    ThumbsUp,
    Trophy,
} from 'lucide-react'

import { Link } from 'react-router-dom'
import { evaluateSleepBadges } from '../lib/sleepBadges'

import './SleepBadgesPanel.css'

// Each achievement gets its own recognisable icon.
const BADGE_ICONS = {
    'first-good-night': ThumbsUp,
    'rest-builder': Star,
    'rest-champion': Trophy,
    'goal-keeper': Target,
    'peaceful-run': MoonStar,
    'steady-rest': Medal,
}

function BadgeCard({ badge }) {
    const Icon = BADGE_ICONS[badge.id] ?? Award

    return (
        <article
            className={
                `sleep-badge ` +
                `${badge.earned ? 'sleep-badge--earned' : 'sleep-badge--locked'}`
            }
            title={`${badge.name}: ${badge.criteria}`}
        >
            <div className="sleep-badge__top">
                <div className="sleep-badge__icon">
                    <Icon
                        size={27}
                        strokeWidth={1.8}
                        aria-hidden="true"
                    />
                </div>

                <span
                    className={
                        `sleep-badge__status ` +
                        `${badge.earned ? 'is-earned' : 'is-locked'}`
                    }
                >
                    {badge.earned ? (
                        <CheckCircle2
                            size={15}
                            aria-hidden="true"
                        />
                    ) : (
                        <LockKeyhole
                            size={15}
                            aria-hidden="true"
                        />
                    )}

                    {badge.earned ? 'Unlocked' : 'Locked'}
                </span>
            </div>

            <h3>{badge.name}</h3>

            <p className="sleep-badge__description">
                {badge.description}
            </p>

            {/* Actual progress toward the badge */}
            <div className="sleep-badge__progress-heading">
                <span>Reward progress</span>

                <strong>
                    {Math.min(badge.current, badge.target)}
                    /{badge.target}
                </strong>
            </div>

            <progress
                className="sleep-badge__progress"
                max={badge.target}
                value={Math.min(
                    badge.current,
                    badge.target
                )}
                aria-label={`${badge.name}: ${badge.progressText}`}
            />

            <p className="sleep-badge__progress-text">
                {badge.progressText}
            </p>

            {/* Accessible on hover, click and keyboard */}
            <details className="sleep-badge__details">
                <summary>
                    How to earn this badge
                </summary>

                <p>{badge.criteria}</p>
            </details>
        </article>
    )
}

export default function SleepBadgesPanel({
    nights,
    care,
    compact = false,
}) {
    const rewards = evaluateSleepBadges(nights, care)

    // Show the first three achievement milestones
    // on the Dashboard; all six on the Nights page.
    const displayedBadges = compact
        ? rewards.badges.slice(0, 3)
        : rewards.badges

    const nextBadge = rewards.badges
        .filter((badge) => !badge.earned)
        .sort(
            (a, b) =>
                b.progressPercent - a.progressPercent
        )[0]

    return (
        <section
            id={compact ? 'dashboard-badges' : 'sleep-badges'}
            className={
                `sleep-badges ${compact ? 'sleep-badges--compact' : ''
                }`
            }
            aria-labelledby={
                compact
                    ? 'dashboard-badges-title'
                    : 'sleep-badges-title'
            }
        >
            <div className="sleep-badges__heading">
                <div>
                    <p className="sleep-badges__eyebrow">
                        CELEBRATE YOUR PROGRESS
                    </p>

                    <h2
                        id={
                            compact
                                ? 'dashboard-badges-title'
                                : 'sleep-badges-title'
                        }
                    >
                        Your sleep rewards
                    </h2>

                    <p>
                        Small milestones can make building a
                        comfortable bedtime routine feel rewarding.
                    </p>
                </div>

                <span className="sleep-badges__heading-icon">
                    <Trophy size={25} aria-hidden="true" />
                </span>
            </div>

            {/* Total unlocked rewards */}
            <div className="sleep-badges__summary">
                <div>
                    <strong>{rewards.unlockedCount}</strong>
                    <span>
                        of {rewards.totalCount} badges unlocked
                    </span>
                </div>

                <div className="sleep-badges__summary-track">
                    <progress
                        max={rewards.totalCount}
                        value={rewards.unlockedCount}
                        aria-label="Total badges unlocked"
                    />
                </div>
            </div>

            {/* A motivating, but evidence-based message */}
            <p className="sleep-badges__encouragement">
                {rewards.completedCount === 0
                    ? 'Your first reward is waiting. Record a completed night to get started.'
                    : rewards.unlockedCount === rewards.totalCount
                        ? 'All six milestones are unlocked in your current recorded history!'
                        : nextBadge
                            ? `Next challenge: ${nextBadge.name}. ${nextBadge.progressText}.`
                            : 'Keep building your resting routine.'}
            </p>

            {/* Badge gallery */}
            <div className="sleep-badges__grid">
                {displayedBadges.map((badge) => (
                    <BadgeCard
                        key={badge.id}
                        badge={badge}
                    />
                ))}
            </div>

            {compact && (
                <Link
                    to="/sleep"
                    className="sleep-badges__view-all"
                >
                    Explore all six badges on the Nights page
                </Link>
            )}

            <p className="sleep-badges__disclaimer">
                These are recent-history achievements based on
                currently loaded SmartBed records. Unlock status
                can change as older nights leave the available
                history or preferences change. Permanent
                achievements are not stored yet. Ratings are
                not clinical measurements of sleep quality.
            </p>
        </section>
    )
}

