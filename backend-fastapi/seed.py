from sqlalchemy import select
from app.database import Base, engine, SessionLocal
from app.models import Bed, BedSettings, Device

Base.metadata.create_all(engine)
BEDS = [("Maureen", "MAUREEN1", "pi-maureen", False),
        ("Patrick", "PATRICK1", "sim-patrick", True),
        ("Siobhan", "SIOBHAN1", "sim-siobhan", True)]
with SessionLocal() as db:
    for name, code, device_id, simulated in BEDS:
        if db.scalar(select(Bed).where(Bed.pairing_code == code)):
            continue
        bed = Bed(resident_name=name, pairing_code=code)
        db.add(bed)
        db.flush()
        db.add(Device(device_id=device_id, bed_id=bed.id, simulated=simulated))
        db.add(BedSettings(bed_id=bed.id))
    db.commit()