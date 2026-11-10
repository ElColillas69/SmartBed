from datetime import datetime, timezone, timedelta

#copied from smartbed\__init__.py
def utc(value):
    """SQLite drops timezone info; stored values are always UTC."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value

#copied from smartbed\__init__.py
def decide(pref, occupied, temperature, light_level):
    heating = pref.heating_enabled and occupied and temperature < pref.target_temperature_c
    return heating, light_level > pref.light_warning_threshold


RING_LIMIT = timedelta(minutes=30)


def latest_occurrence(hhmm, local_now):
    hour, minute = map(int, hhmm.split(":"))
    at = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return at if at <= local_now else at - timedelta(days=1)


def alarm_ringing(alarm, local_now):
    snoozed = utc(alarm.snoozed_until)
    if snoozed and local_now < snoozed:
        return False
    if snoozed and local_now < snoozed + RING_LIMIT:
        return True
    at = latest_occurrence(alarm.time, local_now)
    return alarm.last_triggered_date != at.date().isoformat() and local_now < at + RING_LIMIT


MAX_SAMPLE_GAP = timedelta(minutes=10)


def summarise_nights(rows, tz):
    nights = {}
    for row in rows:
        local = utc(row.recorded_at).astimezone(tz)
        nights.setdefault((local - timedelta(hours=12)).date(), []).append(row)
    latest = max(nights, default=None)
    fresh = bool(rows) and datetime.now(timezone.utc) - utc(rows[-1].recorded_at) < 3 * MAX_SAMPLE_GAP
    result = []
    for night, samples in sorted(nights.items(), reverse=True):
        occupied = [r for r in samples if r.occupied]
        if not occupied:
            continue
        asleep = timedelta()
        exits = 0
        for prev, cur in zip(samples, samples[1:]):
            gap = utc(cur.recorded_at) - utc(prev.recorded_at)
            if prev.occupied:
                asleep += min(gap, MAX_SAMPLE_GAP)
                if not cur.occupied and cur.recorded_at < occupied[-1].recorded_at:
                    exits += 1
        result.append({
            "night": night.isoformat(),
            "bedtime": utc(occupied[0].recorded_at).isoformat(),
            "wake": utc(occupied[-1].recorded_at).isoformat(),
            "in_bed_minutes": round(asleep.total_seconds() / 60),
            "bed_exits": exits,
            "avg_temperature_c": round(sum(r.temperature_c for r in occupied) / len(occupied), 1),
            "in_progress": night == latest and samples[-1].occupied and fresh,
        })
    return result
#
#