from datetime import datetime, timezone
from sqlalchemy import ForeignKey, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base
import secrets # for pairing code
from uuid import UUID, uuid4

def now_utc():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "user" # raw sql will have to use "user" instead of user
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str]
    display_name: Mapped[str] = mapped_column(String(80))

class Bed(Base):
    __tablename__ = "bed"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    resident_name: Mapped[str] = mapped_column(String(80))
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Dublin")
    pairing_code: Mapped[str] = mapped_column(String(16),unique=True, default=lambda: secrets.token_hex(4))

class BedAccess(Base):
    __tablename__ = "bed_access"
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id"), primary_key=True)
    bed_id: Mapped[str] = mapped_column(ForeignKey("bed.id"), primary_key=True)

class Device(Base):
    __tablename__ = "device"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    device_id: Mapped[str] = mapped_column(String(64), unique=True)
    bed_id: Mapped[str] = mapped_column(ForeignKey("bed.id"))
    simulated: Mapped[bool] = mapped_column(default=False)

class Reading(Base):
    __tablename__ = "reading"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    bed_id: Mapped[str] = mapped_column(ForeignKey("bed.id"), index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    occupied: Mapped[bool]
    temperature_c: Mapped[float]
    humidity_percent: Mapped[float]
    light_level: Mapped[int]
    heating_led_on: Mapped[bool]
    light_warning: Mapped[bool]

class BedSettings(Base):
    __tablename__ = "bed_setting"
    bed_id: Mapped[str] = mapped_column(ForeignKey("bed.id"), primary_key=True) # each bed gets one row only
    target_temperature_c: Mapped[float] = mapped_column(default=21.0, nullable=False)
    light_warning_threshold: Mapped[int] = mapped_column(default=800, nullable=False)
    heating_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)


class BedCareSettings(Base):
    """
    Care preferences shared by authorised carers.

    Each bed has one row containing its care thresholds
    and display preferences.
    """

    __tablename__ = "bed_care_setting"

    bed_id: Mapped[str] = mapped_column(
        ForeignKey("bed.id"),
        primary_key=True
    )

    resident_name: Mapped[str] = mapped_column(
        String(40),
        nullable=False
    )

    grace_minutes: Mapped[int] = mapped_column(
        default=20,
        nullable=False
    )

    night_start: Mapped[str] = mapped_column(
        String(5),
        default="21:00",
        nullable=False
    )

    night_end: Mapped[str] = mapped_column(
        String(5),
        default="07:00",
        nullable=False
    )

    sleep_goal_minutes: Mapped[int] = mapped_column(
        default=450,
        nullable=False
    )

    low_temp: Mapped[float] = mapped_column(
        default=18.0,
        nullable=False
    )

    high_temp: Mapped[float] = mapped_column(
        default=26.0,
        nullable=False
    )

    humidity_limit: Mapped[int] = mapped_column(
        default=70,
        nullable=False
    )


class Alarm(Base):
    __tablename__ = "alarm"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    bed_id: Mapped[str] = mapped_column(ForeignKey("bed.id"), index=True)
    time: Mapped[str] = mapped_column(String(5), nullable=False) # local hh:mm
    label: Mapped[str] = mapped_column(String(80), nullable=False, default="Wake up")
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    snooze_minutes: Mapped[int] = mapped_column(default=5 ,nullable=False)
    last_triggered_date: Mapped[str | None] = mapped_column(String(10))
    snoozed_until: Mapped[datetime | None ] = mapped_column(DateTime(timezone=True))

