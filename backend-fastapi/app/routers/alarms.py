# Generated with Claude (Anthropic, 2026).
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import allowed_bed
from ..database import get_db
from ..logic import latest_occurrence
from ..models import Alarm, Bed
from ..mqtt import push_commands
from ..schemas import AlarmIn, AlarmOut, AlarmPatch

router = APIRouter(prefix="/api/beds/{bed_id}/alarms", tags=["alarms"])


def get_alarm(db: Session, bed_id: str, alarm_id: str) -> Alarm:
    """Load an alarm AND check it belongs to this bed.

    Without the bed check, someone with access to bed A could edit bed B's alarm
    just by guessing its id (an "IDOR" bug, OWASP API Security #1).
    """
    alarm = db.get(Alarm, alarm_id)
    if alarm is None or alarm.bed_id != bed_id:
        raise HTTPException(404, "Alarm not found")
    return alarm


def mark_handled(db: Session, alarm: Alarm) -> None:
    """Treat today's occurrence as already dealt with, so it doesn't ring right away."""
    bed = db.get(Bed, alarm.bed_id)
    local_now = datetime.now(ZoneInfo(bed.timezone))
    alarm.last_triggered_date = latest_occurrence(alarm.time, local_now).date().isoformat()


@router.get("", response_model=list[AlarmOut])
def list_alarms(bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db)):
    return db.scalars(select(Alarm).where(Alarm.bed_id == bed_id).order_by(Alarm.time)).all()


@router.post("", response_model=AlarmOut, status_code=201)
def create_alarm(body: AlarmIn, bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db)):
    alarm = Alarm(bed_id=bed_id, **body.model_dump())   # ** unpacks the dict into keyword args
    alarm.label = alarm.label.strip()
    mark_handled(db, alarm)
    db.add(alarm)
    db.commit()
    db.refresh(alarm)
    return alarm


@router.patch("/{alarm_id}", response_model=AlarmOut)
def update_alarm(alarm_id: str, body: AlarmPatch, bed_id: str = Depends(allowed_bed),
                 db: Session = Depends(get_db)):
    alarm = get_alarm(db, bed_id, alarm_id)
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "time" in changes:
        alarm.time = changes["time"]
        mark_handled(db, alarm)
    if "label" in changes:
        alarm.label = changes["label"].strip()
    if "enabled" in changes:
        if changes["enabled"] and not alarm.enabled:
            mark_handled(db, alarm)       # re-enabling shouldn't ring for a time already past
        alarm.enabled = changes["enabled"]
    if "snooze_minutes" in changes:
        alarm.snooze_minutes = changes["snooze_minutes"]
    db.commit()
    db.refresh(alarm)
    push_commands(db, bed_id)
    return alarm


@router.delete("/{alarm_id}", status_code=204)
def delete_alarm(alarm_id: str, bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db)):
    db.delete(get_alarm(db, bed_id, alarm_id))
    db.commit()
    push_commands(db, bed_id)
    return Response(status_code=204)


@router.post("/{alarm_id}/snooze", response_model=AlarmOut)
def snooze_alarm(alarm_id: str, bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db)):
    alarm = get_alarm(db, bed_id, alarm_id)
    alarm.snoozed_until = datetime.now(timezone.utc) + timedelta(minutes=alarm.snooze_minutes)
    db.commit()
    db.refresh(alarm)
    push_commands(db, bed_id)         # buzzer off now, not in 30 seconds
    return alarm


@router.post("/{alarm_id}/dismiss", response_model=AlarmOut)
def dismiss_alarm(alarm_id: str, bed_id: str = Depends(allowed_bed), db: Session = Depends(get_db)):
    alarm = get_alarm(db, bed_id, alarm_id)
    mark_handled(db, alarm)
    alarm.snoozed_until = None
    db.commit()
    db.refresh(alarm)
    push_commands(db, bed_id)
    return alarm
