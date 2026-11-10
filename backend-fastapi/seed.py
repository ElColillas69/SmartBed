# Partly generated with Claude (Anthropic, 2026): demo account and fake history added; bed seeding by Aleksy.
"""Create the beds, their devices and settings, plus some history.

    python seed.py                 beds + 3 nights of fake history
    python seed.py --demo-user     also create carer@example.com / password123 with access to every bed
    python seed.py --no-history    beds only (use this in the cloud)

Safe to run more than once.
"""
import sys
from datetime import timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.fake import fake_reading
from app.ingest import save_reading
from app.models import Bed, BedAccess, BedSettings, Device, Reading, User, now_utc
from app.schemas import ReadingIn

# (resident, pairing code, device_id, simulated?)  Only Maureen's bed has a real Pi.
BEDS = [("Maureen", "MAUREEN1", "pi-maureen", False),
        ("Patrick", "PATRICK1", "sim-patrick", True),
        ("Siobhan", "SIOBHAN1", "sim-siobhan", True)]

Base.metadata.create_all(engine)

with SessionLocal() as db:
    for name, code, device_id, simulated in BEDS:
        if db.scalar(select(Bed).where(Bed.pairing_code == code)):
            continue
        bed = Bed(resident_name=name, pairing_code=code)
        db.add(bed)
        db.flush()                                   # gives bed.id before commit
        db.add(Device(device_id=device_id, bed_id=bed.id, simulated=simulated))
        db.add(BedSettings(bed_id=bed.id))
        print(f"Created bed {name}: pairing code {code}, device {device_id}")
    db.commit()

    if "--demo-user" in sys.argv and not db.scalar(select(User).where(User.email == "carer@example.com")):
        carer = User(email="carer@example.com", display_name="Demo carer",
                     password_hash=hash_password("password123"))
        db.add(carer)
        db.flush()
        for bed in db.scalars(select(Bed)):
            db.add(BedAccess(user_id=carer.id, bed_id=bed.id))
        db.commit()
        print("Created demo account carer@example.com / password123 (development only)")

    if "--no-history" not in sys.argv and db.scalar(select(Reading).limit(1)) is None:
        tz = ZoneInfo("Europe/Dublin")
        start = now_utc() - timedelta(days=3)
        for _, _, device_id, _ in BEDS:
            temperature = 19.5
            when = start
            while when < now_utc():                  # every 5 minutes for 3 days
                data, temperature = fake_reading(when.astimezone(tz), temperature)
                save_reading(db, device_id, ReadingIn(**data, recorded_at=when))
                when += timedelta(minutes=5)
        print("Added 3 days of fake readings")
