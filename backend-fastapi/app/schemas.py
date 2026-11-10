# Partly generated with Claude (Anthropic, 2026): bed, settings, alarm and command schemas added; reading schemas by Aleksy, reviewed.
"""Pydantic schemas: the shape of data coming IN to the API and going OUT of it.

Think of these as DTOs with validation attributes (like [Required]/[Range] in C#).
The SQLAlchemy classes in models.py are the database rows; these are the JSON.
Docs: https://docs.pydantic.dev/latest/concepts/models/
"""
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StrictBool, field_validator

from .logic import utc

# "HH:MM" in 24-hour time, e.g. "07:30". Reused by AlarmIn and AlarmPatch.
# Docs: https://docs.pydantic.dev/latest/concepts/types/#composing-types-via-annotated
TimeHHMM = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


# ---------- accounts ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=80)

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True) # reads SQLAlchemy objs instead of needing to directly translate it from dict
    id: str
    email: EmailStr
    display_name: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- beds ----------

class BedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    resident_name: str
    timezone: str


class ClaimIn(BaseModel):
    pairing_code: str = Field(min_length=4, max_length=16)


# ---------- readings ----------

class ReadingIn(BaseModel):
    """What a Pi (or the simulator) publishes. Only what the device can measure."""
    occupied: StrictBool                       # only true/false; "yes" or 1 is rejected
    temperature_c: float = Field(ge=-20, le=60)
    humidity_percent: float = Field(ge=0, le=100)
    light_level: int = Field(ge=0, le=1023)    # MCP3008 raw range
    recorded_at: datetime | None = None        # optional: the server stamps "now"


class ReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    recorded_at: datetime
    occupied: bool
    temperature_c: float
    humidity_percent: float
    light_level: int
    heating_led_on: bool
    light_warning: bool

    @field_validator("recorded_at")
    @classmethod
    def assume_utc(cls, value):                # SQLite forgets the timezone; put UTC back
        return utc(value)


# ---------- settings (one row per bed) ----------

class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    target_temperature_c: float
    light_warning_threshold: int
    heating_enabled: bool


class SettingsPatch(BaseModel):
    """Every field optional: PATCH only changes what was sent."""
    model_config = ConfigDict(extra="forbid")  # unknown fields -> 422, like the old Flask check
    target_temperature_c: float | None = Field(None, ge=15, le=30)
    light_warning_threshold: int | None = Field(None, ge=0, le=1023)
    heating_enabled: StrictBool | None = None


# ---------- alarms ----------

class AlarmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    time: TimeHHMM
    label: str = Field("Wake up", min_length=1, max_length=80)
    enabled: StrictBool = True
    snooze_minutes: int = Field(5, ge=1, le=30)


class AlarmPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    time: TimeHHMM | None = None
    label: str | None = Field(None, min_length=1, max_length=80)
    enabled: StrictBool | None = None
    snooze_minutes: int | None = Field(None, ge=1, le=30)


class AlarmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    time: str
    label: str
    enabled: bool
    snooze_minutes: int
    snoozed_until: datetime | None

    @field_validator("snoozed_until")
    @classmethod
    def assume_utc(cls, value):
        return utc(value)


# ---------- what the Pi should do right now ----------

class Commands(BaseModel):
    heating_led_on: bool
    light_warning: bool
    buzzer_on: bool
    due_alarm_ids: list[str]
