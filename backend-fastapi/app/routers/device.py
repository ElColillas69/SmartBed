# Generated with Claude (Anthropic, 2026).
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import allowed_bed
from ..database import get_db
from ..ingest import commands_for_bed
from ..schemas import Commands

router = APIRouter(prefix="/api/beds/{bed_id}", tags=["device"])


@router.get("/device/commands", response_model=Commands)
def commands(bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db)):
    """What the bed's Pi has been told to do (the web app shows this as 'heating on' etc.)."""
    return commands_for_bed(db, bed_id)
