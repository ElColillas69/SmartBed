
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

import {
    AlarmClock,
    BedDouble,
    CalendarDays,
    LogOut,
    Moon,
    RefreshCw,
    SlidersHorizontal,
    Sun,
    UserRound,
} from 'lucide-react'

import { BedMark } from './ui'
import { useBed } from '../lib/BedData'
import { useSession } from '../lib/Session'
import { getMonitoringStatus } from '../lib/monitorStatus'
import { useTheme } from '../lib/theme'

// Shared navigation for desktop and mobile.
export const PRIMARY_NAV = [
    {
        to: '/',
        label: 'Dashboard',
        mobileLabel: 'Home',
        icon: BedDouble,
    },
    {
        to: '/sleep',
        label: 'Nights',
        mobileLabel: 'Nights',
        icon: CalendarDays,
    },
    {
        to: '/alarms',
        label: 'Alarms',
        mobileLabel: 'Alarms',
        icon: AlarmClock,
    },
    {
        to: '/settings',
        label: 'Settings',
        mobileLabel: 'Settings',
        icon: SlidersHorizontal,
    },
]

// Read the operating system's appearance preference.
function prefersDark() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function'
    )
        ? window.matchMedia(
            '(prefers-color-scheme: dark)'
        ).matches
        : true
}

// Decorative day/night sky.
// No external images are required.
function SkyArtwork() {
    return (
        <div
            className="comfort-sky"
            aria-hidden="true"
        >
            {/* Sun during the day; moon at night */}
            <span className="comfort-sky__disc">
                <span
                    className="
            comfort-sky__crater
            comfort-sky__crater--one
          "
                />
                <span
                    className="
            comfort-sky__crater
            comfort-sky__crater--two
          "
                />
            </span>

            {/* Clouds appear in daytime */}
            <span
                className="
          comfort-sky__cloud
          comfort-sky__cloud--one
        "
            />
            <span
                className="
          comfort-sky__cloud
          comfort-sky__cloud--two
        "
            />

            {/* Stars appear at night */}
            {Array.from({ length: 9 }, (_, i) => (
                <span
                    key={i}
                    className={
                        `comfort-sky__star ` +
                        `comfort-sky__star--${i + 1}`
                    }
                >
                    ✦
                </span>
            ))}
        </div>
    )
}

export default function ComfortHeader({
    urgentCount = 0,
}) {
    const { live, care } = useBed()

    const {
        beds,
        bed,
        chooseBed,
        logout,
    } = useSession()

    // Reuse SmartBed's existing theme system.
    const [theme, setTheme] = useTheme()
    const [systemDark, setSystemDark] =
        useState(prefersDark)

    // Track OS colour mode if the user selected Auto.
    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            !window.matchMedia
        ) {
            return undefined
        }

        const media = window.matchMedia(
            '(prefers-color-scheme: dark)'
        )

        const update = (event) => {
            setSystemDark(event.matches)
        }

        media.addEventListener('change', update)

        return () => {
            media.removeEventListener('change', update)
        }
    }, [])

    const isNight =
        theme === 'dark' ||
        (theme === 'auto' && systemDark)

    const status = getMonitoringStatus(live)

    const resident =
        care?.residentName ||
        bed?.resident_name ||
        'your resident'

    return (
        <header
            className={
                `comfort-hero comfort-hero--${isNight ? 'night' : 'day'
                }`
            }
        >
            <SkyArtwork />

            {/* Top header */}
            <div className="comfort-hero__top">

                {/* Brand */}
                <NavLink
                    to="/"
                    className="comfort-brand"
                    aria-label="SmartBed home"
                >
                    <BedMark className="comfort-brand__mark" />

                    <span>
                        smartbed
                        <span className="comfort-brand__dot">
                            .
                        </span>
                    </span>
                </NavLink>

                {/* Header controls */}
                <div className="comfort-hero__actions">

                    {/* Monitoring status */}
                    <div
                        className={
                            `comfort-monitor ` +
                            `comfort-monitor--${status.kind}`
                        }
                        role="status"
                        aria-live="polite"
                        title={status.detail}
                    >
                        <span
                            className="comfort-monitor__dot"
                            aria-hidden="true"
                        />

                        <span>{status.label}</span>
                    </div>

                    {/* Refresh sensor readings */}
                    <button
                        className="comfort-icon-button"
                        type="button"
                        aria-label="Refresh monitoring readings"
                        title="Refresh readings"
                        onClick={() => void live.refresh()}
                    >
                        <RefreshCw
                            size={18}
                            aria-hidden="true"
                        />
                    </button>

                    {/* Day/Night toggle */}
                    <div
                        className="comfort-theme-toggle"
                        role="group"
                        aria-label="Day or night appearance"
                    >
                        <button
                            type="button"
                            aria-label="Use day appearance"
                            aria-pressed={!isNight}
                            className={
                                !isNight ? 'is-selected' : ''
                            }
                            onClick={() => setTheme('light')}
                        >
                            <Sun
                                size={17}
                                aria-hidden="true"
                            />
                            <span>Day</span>
                        </button>

                        <button
                            type="button"
                            aria-label="Use night appearance"
                            aria-pressed={isNight}
                            className={
                                isNight ? 'is-selected' : ''
                            }
                            onClick={() => setTheme('dark')}
                        >
                            <Moon
                                size={17}
                                aria-hidden="true"
                            />
                            <span>Night</span>
                        </button>
                    </div>

                    {/* Resident profile */}
                    <div className="comfort-profile">
                        <UserRound
                            size={17}
                            aria-hidden="true"
                        />

                        {beds?.length > 1 ? (
                            <select
                                aria-label="Choose resident's bed"
                                value={bed?.id ?? ''}
                                onChange={(event) =>
                                    chooseBed(event.target.value)
                                }
                            >
                                {beds.map((item) => (
                                    <option
                                        key={item.id}
                                        value={item.id}
                                    >
                                        {item.resident_name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span>{resident}</span>
                        )}
                    </div>

                    {/* Sign out */}
                    <button
                        className="comfort-signout"
                        type="button"
                        onClick={logout}
                        aria-label="Sign out"
                        title="Sign out"
                    >
                        <LogOut
                            size={17}
                            aria-hidden="true"
                        />
                        <span>Sign out</span>
                    </button>

                </div>
            </div>

            {/* Welcoming message */}
            <div className="comfort-hero__intro">
                <p className="comfort-hero__eyebrow">
                    {isNight
                        ? 'YOUR EVENING OF COMFORT'
                        : 'YOUR DAY OF COMFORT'}
                </p>

                <h1>
                    {isNight
                        ? 'A calmer night starts here.'
                        : 'Feel good. Rest easier.'}
                </h1>

                <p>
                    A welcoming place to follow{' '}
                    {resident}’s sleep, comfort and care.
                </p>
            </div>

            {/* Main navigation */}
            <nav
                className="comfort-nav"
                aria-label="Main navigation"
            >
                {PRIMARY_NAV.map(({
                    to,
                    label,
                    icon: Icon,
                }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/' || to === '/sleep'}
                    >
                        <Icon
                            size={19}
                            strokeWidth={2}
                            aria-hidden="true"
                        />

                        <span>{label}</span>

                        {to === '/' && urgentCount > 0 && (
                            <span
                                className="comfort-nav__count"
                                aria-label={`${urgentCount} notices`}
                            >
                                {urgentCount}
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

        </header>
    )
}
