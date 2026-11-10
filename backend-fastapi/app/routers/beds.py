from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..database import get_db
from ..models import Bed, BedAccess, User

router = APIRouter(prefix="/api/beds", tags=["beds"])

class BedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    resident_name: str
    timezone: str

class ClaimIn(BaseModel):
    pairing_code: str

@router.get("", response_model=list[BedOut])
def my_beds(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Bed).join(BedAccess, BedAccess.bed_id == Bed.id).where(BedAccess.user_id == user.id)
    return db.scalars(query).all()

@router.post("/claim", response_model=BedOut)
def claim_bed(body: ClaimIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bed = db.scalar(select(Bed).where(Bed.pairing_code == body.pairing_code))
    if bed is None:
        raise HTTPException(404, "No bed with that code")
    if db.get(BedAccess, (user.id, bed.id)) is None:
        db.add(BedAccess(user_id=user.id, bed_id=bed.id))
        db.commit()
    return bed