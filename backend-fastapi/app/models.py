from datetime import datetime, timezone
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

def now_utc():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "user"
    id: Mapped[str] = mapped_column(default_factory=uuid.uuid4, primary_key=True, init=False)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str]
    display_name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(20)) # resident or caretaker

class Bed(Base):
    __tablename__ = "bed"
    id: Mapped[str] = mapped_column(default_factory=uuid.uuid4, primary_key=True, init=False)
    resident_name: Mapped[str] = mapped_column(String(80))
    timezone: Mapped[str] = mapped_column(String(64)), default="Europe/Dublin")

class BedAccess(Base):
    __tablename__ = "bed_access"
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id"), primary_key=True)
    bed_id: Mapped[str] = mapped_column(ForeignKey("bed.id"), primary_key=True)

class Device(Base):
    __tablename__ = "device"
    id: Mapped[str] = mapped_column(default_factory=uuid.uuid4, primary_key=True, init=False)
    device_id: Mapped[str] = mapped_column(String(64), unique=True)
    bed_id: Mapped[str] = mapped_column(ForeignKey("bed.id"))
    simulated: Mapped[bool] = mapped_column(default=False)

class Reading(Base):
    __tablename__ = "reading"
    id: Mapped[str] = mapped_column(default_factory=uuid.uuid4, primary_key=True, init=False)
    bed_id: Mapped[str] = mapped_column(ForeignKey("bed.id"))
    recorded_at: Mapped[Datetime] = mapped_column(Datetime(timezone=True, server_default=func.now()))
    occupied: Mapped[bool] = mapped_column(default=False)
    temperature_c: Mapped[float]
    humidity_percent: Mapped[int]
    light_level: Mapped[int]
    heating_led_on: Mapped[bool]
    light_warning: Mapped[bool]

class BedSettings(Base):
    __tablename__ = "bed_setting"
    id: Mapped[str] = mapped_column(ForeignKey("bed.id")) # each bed gets one row only
    target_temperature_c: Mapped[float] = mapped_column(default=21.0, nullable=False)
    light_warning_threshold: Mapped[int] = mapped_column(default=800, nullable=False)
    heating_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)

class Alarm(Base):
    id: Mapped[str] = mapped_column(default_factory=uuid.uuid4, primary_key=True, init=False)
    bed_id: Mapped[str] = mapped_column(ForeignKey("bed.id"))
    time: Mapped[str] = mapped_column(String(5), nullable=False) # local hh:mm
    label: Mapped[str] = mapped_column(String(80), nullable=False, default=True)
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    snooze_minutes: Mapped[int] = mapped_column(default=5 ,nullable=False)
    last_triggered_date = Mapped[str] = mapped_column(String(10), nullable=True)
    snoozed_until: Mapped[datetime] = mapped_column(Datetime(timezone=True, server_default=func.now()))

