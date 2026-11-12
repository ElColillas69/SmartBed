# Generated with Claude (Anthropic, 2026).
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import allowed_bed
from ..database import get_db
from ..models import BedSettings
from ..mqtt import push_commands
from ..schemas import SettingsOut, SettingsPatch

router = APIRouter(prefix="/api/beds/{bed_id}", tags=["settings"])


def settings_for(db: Session, bed_id: str) -> BedSettings:
    """Every bed should have a settings row (seed.py makes one); create it if not."""
    settings = db.get(BedSettings, bed_id)
    if settings is None:
        settings = BedSettings(bed_id=bed_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/settings", response_model=SettingsOut)
def get_settings(bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db)):
    return settings_for(db, bed_id)


@router.patch("/settings", response_model=SettingsOut)
def update_settings(body: SettingsPatch, bed_id: str = Depends(allowed_bed),
                    db: Session = Depends(get_db)):
    settings = settings_for(db, bed_id)
    # exclude_unset: only the fields the client actually sent.
    # Docs: https://fastapi.tiangolo.com/tutorial/body-updates/
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    push_commands(db, bed_id)        # heater may need to switch now, not at the next reading
    return settings
