# Partly generated with Claude (Anthropic, 2026): save_reading by Aleksy (typos fixed); commands_for_bed added.
"""Everything that happens when a device sends a reading, and what we tell it back.

These are plain functions, not routes: readings arrive over MQTT (see mqtt.py),
not HTTP, because the Pi never logs in. seed.py and simulate.py reuse them too.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session


from .models import Alarm, Bed, BedSettings, Device, Reading, now_utc
from .schemas import Commands, ReadingIn
from .logic import alarm_ringing, decide, heater_reading_is_fresh


def save_reading(
    db: Session,
    device_id: str,
    data: ReadingIn
) -> Reading | None:
    """
    Save sensor readings from a registered device.

    Prevent duplicate MQTT deliveries from creating
    multiple records with the same bed and timestamp.
    """

    # Step 1: Find the registered device
    device = db.scalar(
        select(Device).where(
            Device.device_id == device_id
        )
    )

    if device is None:
        return None

    # Step 2: Check for duplicate sensor readings
    if data.recorded_at is not None:

        timestamp = data.recorded_at

        # Normalise timestamps to UTC before comparison.
        if timestamp.tzinfo is not None:
            timestamp = timestamp.astimezone(timezone.utc)
        else:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        existing = db.scalar(
            select(Reading)
            .where(
                Reading.bed_id == device.bed_id,
                Reading.recorded_at == timestamp
            )
            .limit(1)
        )

        # Return the existing record instead of inserting.
        if existing is not None:
            return existing

    else:
        timestamp = now_utc()

    # Step 3: Retrieve bed settings
    settings = db.get(
        BedSettings,
        device.bed_id
    )

    # Step 4: Calculate heating and light warnings
    heating, light_warning = decide(
        settings,
        data.occupied,
        data.temperature_c,
        data.light_level
    )

    # Step 5: Create a new reading
    reading = Reading(
        bed_id=device.bed_id,
        recorded_at=timestamp,
        occupied=data.occupied,
        temperature_c=data.temperature_c,
        humidity_percent=data.humidity_percent,
        light_level=data.light_level,
        heating_led_on=heating,
        light_warning=light_warning
    )

    # Step 6: Save the reading
    db.add(reading)
    db.commit()
    db.refresh(reading)

    return reading




def commands_for_bed(db: Session, bed_id: str) -> Commands:
    """
    Decide what commands should be sent to the bed.

    Heating is disabled when the latest sensor reading
    is missing or too old.
    """

    bed = db.get(Bed, bed_id)

    local_now = datetime.now(timezone.utc).astimezone(
        ZoneInfo(bed.timezone)
    )

    alarms = db.scalars(
        select(Alarm).where(
            Alarm.bed_id == bed_id,
            Alarm.enabled
        )
    ).all()

    due = [
        a.id for a in alarms
        if alarm_ringing(a, local_now)
    ]

    last = db.scalar(
        select(Reading)
        .where(Reading.bed_id == bed_id)
        .order_by(Reading.recorded_at.desc())
        .limit(1)
    )

    if (
        last is None
        or not heater_reading_is_fresh(last.recorded_at)
    ):
        heating = False
        light_warning = False

    else:
        settings = db.get(BedSettings, bed_id)

        if settings:
            heating, light_warning = decide(
                settings,
                last.occupied,
                last.temperature_c,
                last.light_level
            )
        else:
            heating = False
            light_warning = False

    return Commands(
        heating_led_on=heating,
        light_warning=light_warning,
        buzzer_on=bool(due),
        due_alarm_ids=due
    )