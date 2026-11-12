# Generated with Claude (Anthropic, 2026).
import math
from datetime import timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import allowed_bed
from ..database import get_db
from ..logic import summarise_nights
from ..models import Bed, Reading, now_utc
from ..schemas import ReadingOut

# {bed_id} in the prefix: every route here gets it from the URL, and allowed_bed
# checks the logged-in account may see that bed before the route body runs.
router = APIRouter(prefix="/api/beds/{bed_id}", tags=["readings"])


def newest_first(bed_id: str):
    return (select(Reading).where(Reading.bed_id == bed_id)
            .order_by(Reading.recorded_at.desc(), Reading.id.desc()))


@router.get("/readings/latest", response_model=ReadingOut | None)
def latest(bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db)):
    return db.scalar(newest_first(bed_id).limit(1))


@router.get("/readings", response_model=list[ReadingOut])
def readings(bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db),
             minutes: int | None = Query(None, ge=1, le=1440),
             limit: int = Query(50, ge=1, le=500)):
    query = newest_first(bed_id)
    if minutes is None:
        return db.scalars(query.limit(limit)).all()
    since = now_utc() - timedelta(minutes=minutes)
    rows = db.scalars(query.where(Reading.recorded_at >= since)).all()
    step = max(1, math.ceil(len(rows) / limit))      # thin out to at most `limit`
    return rows[::step] or db.scalars(query.limit(1)).all()


@router.get("/sleep/nights")
def nights(bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db),
           days: int = Query(7, ge=1, le=31)):
    bed = db.get(Bed, bed_id)
    since = now_utc() - timedelta(days=days + 1)
    rows = db.scalars(select(Reading)
                      .where(Reading.bed_id == bed_id, Reading.recorded_at >= since)
                      .order_by(Reading.recorded_at)).all()
    return summarise_nights(rows, ZoneInfo(bed.timezone))[:days]
