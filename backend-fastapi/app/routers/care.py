
"""Shared care preferences endpoints for SmartBed."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import allowed_bed
from ..database import get_db
from ..models import Bed, BedCareSettings
from ..schemas import CarePreferences


router = APIRouter(
    prefix="/api/beds/{bed_id}",
    tags=["care preferences"]
)


# Map the React field names to database columns.
FIELDS = {
    "residentName": "resident_name",
    "graceMinutes": "grace_minutes",
    "nightStart": "night_start",
    "nightEnd": "night_end",
    "sleepGoalMinutes": "sleep_goal_minutes",
    "lowTemp": "low_temp",
    "highTemp": "high_temp",
    "humidityLimit": "humidity_limit",
}


def settings_for_bed(
    db: Session,
    bed_id: str
) -> BedCareSettings:
    """
    Retrieve existing preferences or create defaults
    for a bed that has no care-settings record.
    """

    settings = db.get(BedCareSettings, bed_id)

    if settings is None:
        bed = db.get(Bed, bed_id)

        settings = BedCareSettings(
            bed_id=bed_id,
            resident_name=bed.resident_name[:40]
        )

        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


def settings_payload(settings: BedCareSettings):
    """
    Convert database column names to the field names
    expected by the React dashboard.
    """

    return {
        frontend_name: getattr(settings, database_name)
        for frontend_name, database_name in FIELDS.items()
    }


@router.get(
    "/care",
    response_model=CarePreferences
)
def get_care_preferences(
    bed_id: str = Depends(allowed_bed),
    db: Session = Depends(get_db)
):
    """
    Return shared preferences for an authorised bed.
    """

    settings = settings_for_bed(db, bed_id)

    return settings_payload(settings)


@router.put(
    "/care",
    response_model=CarePreferences
)
def update_care_preferences(
    body: CarePreferences,
    bed_id: str = Depends(allowed_bed),
    db: Session = Depends(get_db)
):
    """
    Update all care preferences for an authorised bed.

    Validation happens before data is saved.
    """

    settings = settings_for_bed(db, bed_id)

    # Copy validated values into the database.
    for frontend_name, database_name in FIELDS.items():
        setattr(
            settings,
            database_name,
            getattr(body, frontend_name)
        )

    db.commit()
    db.refresh(settings)

    return settings_payload(settings)
