"""Fill the development database with a week of realistic nights.

Usage:  python seed_demo.py          (adds to the database in .env)
        python seed_demo.py --reset  (clears readings first)

For demos only: it writes straight to the database, bypassing the API.
"""
import random
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from smartbed import create_app, db, Reading, Preference, Alarm

STEP = timedelta(minutes=2)


def night_readings(bed_local, wake_local, exits, base_temp, pref, now):
    """Readings from 30 min before bed to 30 min after waking (or until now)."""
    t = bed_local - timedelta(minutes=30)
    exit_windows = []
    for _ in range(exits):
        start = bed_local + (wake_local - bed_local) * random.uniform(0.2, 0.8)
        exit_windows.append((start, start + timedelta(minutes=random.randint(4, 14))))
    while t <= min(wake_local + timedelta(minutes=30), now - STEP):
        occupied = bed_local <= t <= wake_local and not any(a <= t < b for a, b in exit_windows)
        hours_in = (t - bed_local).total_seconds() / 3600
        temp = round(base_temp - 0.25 * max(hours_in, 0) + random.uniform(-0.2, 0.2), 1)
        light = random.randint(20, 60) if bed_local <= t <= wake_local else random.randint(350, 600)
        yield Reading(recorded_at=t.astimezone(timezone.utc), occupied=occupied, temperature_c=temp,
                      humidity_percent=round(random.uniform(48, 60), 1), light_level=light,
                      heating_led_on=pref.heating_enabled and occupied and temp < pref.target_temperature_c,
                      light_warning=light > pref.light_warning_threshold)
        t += STEP


def main():
    app = create_app()
    tz = ZoneInfo(app.config["BED_TIMEZONE"])
    with app.app_context():
        if "--reset" in sys.argv:
            db.session.query(Reading).delete()
        pref = db.session.get(Preference, 1)
        today = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
        count = 0
        for days_ago in range(7, 0, -1):
            evening = today - timedelta(days=days_ago)
            bed = evening + timedelta(hours=22, minutes=random.randint(15, 75))
            wake = evening + timedelta(days=1, hours=5, minutes=random.randint(45, 100))
            rows = list(night_readings(bed, wake, random.randint(0, 2), random.uniform(19.5, 21), pref, datetime.now(tz)))
            db.session.add_all(rows)
            count += len(rows)
        if not db.session.query(Alarm).count():
            db.session.add(Alarm(time="07:30", label="Morning"))
        db.session.commit()
        print(f"Added {count} readings across the last 7 nights (tonight runs up to now).")


if __name__ == "__main__":
    main()
