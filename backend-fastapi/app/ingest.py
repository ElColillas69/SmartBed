# Partly generated with Claude (Anthropic, 2026): save_reading by Aleksy (typos fixed); commands_for_bed added.
"""Everything that happens when a device sends a reading, and what we tell it back.

These are plain functions, not routes: readings arrive over MQTT (see mqtt.py),
not HTTP, because the Pi never logs in. seed.py and simulate.py reuse them too.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .logic import alarm_ringing, decide
from .models import Alarm, Bed, BedSettings, Device, Reading, now_utc
from .schemas import Commands, ReadingIn


def save_reading(db: Session, device_id: str, data: ReadingIn) -> Reading | None:
    """Store one reading on the bed that this device belongs to."""
    device = db.scalar(select(Device).where(Device.device_id == device_id))
    if device is None:
        return None                                  # unknown device: ignore it
    settings = db.get(BedSettings, device.bed_id)
    heating, light_warning = decide(settings, data.occupied, data.temperature_c, data.light_level)
    reading = Reading(
        bed_id=device.bed_id,                        # <- the Pi-to-bed link
        recorded_at=data.recorded_at or now_utc(),
        occupied=data.occupied,
        temperature_c=data.temperature_c,
        humidity_percent=data.humidity_percent,
        light_level=data.light_level,
        heating_led_on=heating,
        light_warning=light_warning,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


def commands_for_bed(db: Session, bed_id: str) -> Commands:
    """Work out what the bed's Pi should be doing *now*: heater LED and buzzer.

    Re-evaluated against the current settings, so a settings change takes effect
    straight away instead of waiting for the next reading.
    """
    bed = db.get(Bed, bed_id)
    local_now = datetime.now(timezone.utc).astimezone(ZoneInfo(bed.timezone))
    alarms = db.scalars(select(Alarm).where(Alarm.bed_id == bed_id, Alarm.enabled)).all()
    due = [a.id for a in alarms if alarm_ringing(a, local_now)]
    last = db.scalar(select(Reading).where(Reading.bed_id == bed_id)
                     .order_by(Reading.recorded_at.desc()).limit(1))
    if last is None:
        heating, light_warning = False, False
    else:
        heating, light_warning = decide(db.get(BedSettings, bed_id), last.occupied,
                                        last.temperature_c, last.light_level)
    return Commands(heating_led_on=heating, light_warning=light_warning,
                    buzzer_on=bool(due), due_alarm_ids=due)
