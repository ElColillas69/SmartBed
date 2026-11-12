# Generated with Claude (Anthropic, 2026).
"""Run with:  python -m pytest -q   (from backend-fastapi)

Docs: https://fastapi.tiangolo.com/tutorial/testing/
"""
import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.ingest import save_reading
from app.main import app
from app.models import Bed, BedSettings, Device
from app.schemas import ReadingIn


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        for name, code, device in [("Maureen", "MAUREEN1", "pi-maureen"), ("Patrick", "PATRICK1", "sim-patrick")]:
            bed = Bed(resident_name=name, pairing_code=code)
            db.add(bed)
            db.flush()
            db.add(Device(device_id=device, bed_id=bed.id))
            db.add(BedSettings(bed_id=bed.id))
        db.commit()
    with TestClient(app) as c:
        yield c


def login(client, email="carer@example.com"):
    client.post("/api/auth/register", json={"email": email, "password": "password123", "display_name": "Carer"})
    token = client.post("/api/auth/login", data={"username": email, "password": "password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def claim(client, headers, code="MAUREEN1"):
    return client.post("/api/beds/claim", json={"pairing_code": code}, headers=headers).json()["id"]


def reading(**changes):
    data = {"occupied": True, "temperature_c": 19.0, "humidity_percent": 50.0, "light_level": 10}
    return ReadingIn(**{**data, **changes})


def test_login_required(client):
    assert client.get("/api/beds").status_code == 401


def test_wrong_password(client):
    login(client)
    r = client.post("/api/auth/login", data={"username": "carer@example.com", "password": "nope-nope"})
    assert r.status_code == 401


def test_claim_and_list_beds(client):
    h = login(client)
    assert client.get("/api/beds", headers=h).json() == []
    assert client.post("/api/beds/claim", json={"pairing_code": "WRONG123"}, headers=h).status_code == 404
    bed_id = claim(client, h)
    assert [b["id"] for b in client.get("/api/beds", headers=h).json()] == [bed_id]


def test_cannot_see_unclaimed_bed(client):
    h = login(client)
    mine = claim(client, h)
    other_user = login(client, "someone@example.com")
    assert client.get(f"/api/beds/{mine}/readings/latest", headers=other_user).status_code == 404


def test_reading_goes_to_the_devices_bed(client):
    h = login(client)
    bed_id = claim(client, h)
    with SessionLocal() as db:
        assert save_reading(db, "pi-maureen", reading(temperature_c=18.0)) is not None
        assert save_reading(db, "not-a-device", reading()) is None
    latest = client.get(f"/api/beds/{bed_id}/readings/latest", headers=h).json()
    assert latest["temperature_c"] == 18.0
    assert latest["heating_led_on"] is True            # 18 < default target 21, and in bed
    assert latest["recorded_at"].endswith(("Z", "+00:00"))
    patrick = claim(client, h, "PATRICK1")
    assert client.get(f"/api/beds/{patrick}/readings/latest", headers=h).json() is None


def test_reading_validation():
    with pytest.raises(ValueError):
        reading(humidity_percent=140)
    with pytest.raises(ValueError):
        reading(occupied="yes")


def test_settings_patch_and_heater(client):
    h = login(client)
    bed_id = claim(client, h)
    with SessionLocal() as db:
        save_reading(db, "pi-maureen", reading(temperature_c=19.0))
    assert client.get(f"/api/beds/{bed_id}/device/commands", headers=h).json()["heating_led_on"] is True
    r = client.patch(f"/api/beds/{bed_id}/settings", json={"target_temperature_c": 18.5}, headers=h)
    assert r.status_code == 200 and r.json()["target_temperature_c"] == 18.5
    assert r.json()["heating_enabled"] is True          # untouched field kept
    assert client.get(f"/api/beds/{bed_id}/device/commands", headers=h).json()["heating_led_on"] is False
    assert client.patch(f"/api/beds/{bed_id}/settings", json={"target_temperature_c": 99}, headers=h).status_code == 422
    assert client.patch(f"/api/beds/{bed_id}/settings", json={"colour": "red"}, headers=h).status_code == 422


def test_alarm_crud_and_ownership(client):
    h = login(client)
    maureen = claim(client, h)
    patrick = claim(client, h, "PATRICK1")
    r = client.post(f"/api/beds/{maureen}/alarms", json={"time": "07:30"}, headers=h)
    assert r.status_code == 201
    alarm = r.json()
    assert alarm["label"] == "Wake up" and alarm["snoozed_until"] is None
    assert client.post(f"/api/beds/{maureen}/alarms", json={"time": "25:00"}, headers=h).status_code == 422
    # The alarm belongs to Maureen's bed, so it can't be reached through Patrick's.
    assert client.patch(f"/api/beds/{patrick}/alarms/{alarm['id']}", json={"label": "x"}, headers=h).status_code == 404
    r = client.patch(f"/api/beds/{maureen}/alarms/{alarm['id']}", json={"label": "Breakfast"}, headers=h)
    assert r.json()["label"] == "Breakfast" and r.json()["time"] == "07:30"
    assert client.post(f"/api/beds/{maureen}/alarms/{alarm['id']}/snooze", headers=h).json()["snoozed_until"]
    assert client.post(f"/api/beds/{maureen}/alarms/{alarm['id']}/dismiss", headers=h).json()["snoozed_until"] is None
    assert client.delete(f"/api/beds/{maureen}/alarms/{alarm['id']}", headers=h).status_code == 204
    assert client.get(f"/api/beds/{maureen}/alarms", headers=h).json() == []


def test_nights_summary(client):
    from datetime import timedelta
    from app.models import now_utc
    h = login(client)
    bed_id = claim(client, h)
    start = now_utc() - timedelta(hours=2)
    with SessionLocal() as db:
        for i in range(24):                              # 2 hours, one exit in the middle
            save_reading(db, "pi-maureen", reading(occupied=not 10 <= i < 12,
                                                    recorded_at=start + timedelta(minutes=5 * i)))
    nights = client.get(f"/api/beds/{bed_id}/sleep/nights", headers=h).json()
    assert len(nights) == 1 and nights[0]["bed_exits"] == 1


def test_claim_with_generated_code(client):
    # Added in review (Claude, 2026): beds made without seed.py get a lowercase
    # token_hex code from models.py; claiming must still work whatever the case.
    with SessionLocal() as db:
        bed = Bed(resident_name="New")
        db.add(bed)
        db.commit()
        code = bed.pairing_code
    h = login(client)
    assert client.post("/api/beds/claim", json={"pairing_code": code}, headers=h).status_code == 200
