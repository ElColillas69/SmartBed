from sqlalchemy.orm import Session
from sqlalchemy import select
from .logic import decide
from .models import Reading, BedSetting, Device, now_utc
from .schemas import ReadingIn


def save_reading(db: Session, device_id: str, data: ReadingIn) -> Reading | None:
    d = db.scalar(select(Device).where(Device.device_id == device_id))
    if d is None:
        return None
    b_settings = db.get(BedSettings, d.bed_id)
    heating, light_warning = decide(b_settings, data.occupied, data.temperature_c, data.light_level)
    reading = Reading(
                bed_id=d.bed_id,
                recorded_at=data.recorded_at or now_utc(),
                occupied=data.occupied,
                temperature_c=data.temperature_c,
                humidity_percent=data.humidity_percent,
                light_level=data.light_level,
                heating_led_on=heating,
                light_warning=light_warning
                )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading