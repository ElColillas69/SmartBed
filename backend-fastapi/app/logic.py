
from datetime import datetime, timezone, timedelta


# ============================================================
# 1. DATE AND TIME UTILITIES
# ============================================================

def utc(value):
    """SQLite drops timezone info; stored values are always UTC."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


# ============================================================
# 2. HEATING AND LIGHT CONTROL
# ============================================================

def decide(pref, occupied, temperature, light_level):
    """
    Determine heating and light warning states
    using the bed's configured preferences.
    """
    heating = (
        pref.heating_enabled
        and occupied
        and temperature < pref.target_temperature_c
    )

    light_warning = (
        light_level > pref.light_warning_threshold
    )

    return heating, light_warning


# ============================================================
# 3. HEATING SENSOR SAFETY - COMMITS 3 AND 4
# ============================================================

HEATER_READING_MAX_AGE = timedelta(minutes=5)


def heater_reading_is_fresh(recorded_at, now=None):
    """
    Accept sensor readings up to five minutes old.

    Reject:
    - Missing timestamps
    - Readings older than five minutes
    - Readings more than 60 seconds in the future

    This prevents outdated sensor information from
    being used to request heating.
    """
    now = now or datetime.now(timezone.utc)

    if recorded_at is None:
        return False

    age = now - utc(recorded_at)

    return (
        timedelta(seconds=-60)
        <= age
        <= HEATER_READING_MAX_AGE
    )


# ============================================================
# 4. MQTT READING VALIDATION - COMMIT 5
# ============================================================

MQTT_MAX_DELAY = timedelta(minutes=10)


def is_live_mqtt_timestamp(recorded_at, now=None):
    """
    Validate timestamps received from MQTT devices.

    Accept:
    - Readings up to 10 minutes old
    - Readings up to 60 seconds in the future
    - Missing timestamps from legacy devices

    Reject:
    - Readings older than 10 minutes
    - Readings more than 60 seconds in the future
    """
    if recorded_at is None:
        return True

    now = now or datetime.now(timezone.utc)

    age = now - utc(recorded_at)

    return (
        timedelta(seconds=-60)
        <= age
        <= MQTT_MAX_DELAY
    )


# ============================================================
# 5. ALARM SCHEDULING
# ============================================================

RING_LIMIT = timedelta(minutes=30)


def latest_occurrence(hhmm, local_now):
    """
    Find the latest occurrence of an alarm's scheduled time.
    """
    hour, minute = map(int, hhmm.split(":"))

    at = local_now.replace(
        hour=hour,
        minute=minute,
        second=0,
        microsecond=0
    )

    return at if at <= local_now else at - timedelta(days=1)


def alarm_ringing(alarm, local_now):
    """
    Determine whether an alarm should currently be ringing.
    """
    snoozed = utc(alarm.snoozed_until)

    if snoozed and local_now < snoozed:
        return False

    if snoozed and local_now < snoozed + RING_LIMIT:
        return True

    at = latest_occurrence(alarm.time, local_now)

    return (
        alarm.last_triggered_date != at.date().isoformat()
        and local_now < at + RING_LIMIT
    )


# ============================================================
# 6. SLEEP HISTORY AND NIGHTLY SUMMARIES
# ============================================================

MAX_SAMPLE_GAP = timedelta(minutes=10)


def summarise_nights(rows, tz):
    """
    Generate nightly summaries from recorded bed readings.

    Calculates:
    - Time spent in bed
    - Bed exits
    - Average temperature
    - Average humidity
    - Whether a night is still in progress
    """
    nights = {}

    for row in rows:
        local = utc(row.recorded_at).astimezone(tz)

        night = (
            local - timedelta(hours=12)
        ).date()

        nights.setdefault(night, []).append(row)

    latest = max(nights, default=None)

    fresh = (
        bool(rows)
        and datetime.now(timezone.utc)
        - utc(rows[-1].recorded_at)
        < 3 * MAX_SAMPLE_GAP
    )

    result = []

    for night, samples in sorted(
        nights.items(),
        reverse=True
    ):
        occupied = [
            r for r in samples if r.occupied
        ]

        if not occupied:
            continue

        asleep = timedelta()
        exits = 0

        for prev, cur in zip(
            samples,
            samples[1:]
        ):
            gap = (
                utc(cur.recorded_at)
                - utc(prev.recorded_at)
            )

            if prev.occupied:
                asleep += min(
                    gap,
                    MAX_SAMPLE_GAP
                )

                if (
                    not cur.occupied
                    and cur.recorded_at
                    < occupied[-1].recorded_at
                ):
                    exits += 1

        result.append({
            "night": night.isoformat(),
            "bedtime": utc(
                occupied[0].recorded_at
            ).isoformat(),
            "wake": utc(
                occupied[-1].recorded_at
            ).isoformat(),
            "in_bed_minutes": round(
                asleep.total_seconds() / 60
            ),
            "bed_exits": exits,
            "avg_temperature_c": round(
                sum(
                    r.temperature_c
                    for r in occupied
                ) / len(occupied),
                1
            ),
            "avg_humidity_percent": round(
                sum(
                    r.humidity_percent
                    for r in occupied
                ) / len(occupied),
                1
            ),
            "in_progress": (
                night == latest
                and samples[-1].occupied
                and fresh
            ),
        })

    return result
