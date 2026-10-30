import pytest
from smartbed import create_app, db

@pytest.fixture()
def client(tmp_path):
    app = create_app({"TESTING": True,
                      "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
                      "API_KEY": "test-secret"})
    return app.test_client()

@pytest.fixture()
def auth():
    return {"X-API-Key": "test-secret"}


def test_health(client):
    assert client.get("/api/health").json["status"] == "ok"


def test_authentication_required(client):
    assert client.get("/api/readings/latest").status_code == 401


def test_reading_triggers_heating(client, auth):
    payload = {"occupied": True, "temperature_c": 18.5, "humidity_percent": 52.0, "light_level": 100}
    r = client.post("/api/readings", headers=auth, json=payload)
    assert r.status_code == 201
    assert r.json["heating_led_on"] is True
    assert client.get("/api/readings/latest", headers=auth).json["occupied"] is True
    assert client.get("/api/device/commands", headers=auth).json["heating_led_on"] is True


def test_unoccupied_disables_heating(client, auth):
    r = client.post("/api/readings", headers=auth, json={"occupied": False, "temperature_c": 16, "humidity_percent": 45, "light_level": 900})
    assert r.json["heating_led_on"] is False
    assert r.json["light_warning"] is True


def test_input_validation(client, auth):
    r = client.post("/api/readings", headers=auth, json={"occupied": "yes", "temperature_c": 20, "humidity_percent": 50, "light_level": 200})
    assert r.status_code == 400


def test_alarm_lifecycle(client, auth):
    r = client.post("/api/alarms", headers=auth, json={"time": "07:30", "label": "Morning", "snooze_minutes": 5})
    assert r.status_code == 201
    alarm_id = r.json["id"]
    assert len(client.get("/api/alarms", headers=auth).json) == 1
    assert client.post(f"/api/alarms/{alarm_id}/snooze", headers=auth).json["snoozed_until"] is not None
    assert client.post(f"/api/alarms/{alarm_id}/dismiss", headers=auth).status_code == 200
    assert client.delete(f"/api/alarms/{alarm_id}", headers=auth).status_code == 204


def test_timestamps_are_utc(client, auth):
    client.post("/api/readings", headers=auth, json={"occupied": True, "temperature_c": 20, "humidity_percent": 50, "light_level": 10})
    assert client.get("/api/readings/latest", headers=auth).json["recorded_at"].endswith("+00:00")


def test_sleep_nights_summary(client, auth):
    from datetime import datetime, timedelta, timezone
    from smartbed import Reading, db
    start = datetime.now(timezone.utc).replace(hour=22, minute=0, second=0, microsecond=0) - timedelta(days=2)
    with client.application.app_context():
        for i in range(0, 8 * 60, 5):  # 22:00 to 06:00 UTC, one sample per 5 min
            occupied = not (120 <= i < 135)  # one 15-minute bed exit
            db.session.add(Reading(recorded_at=start + timedelta(minutes=i), occupied=occupied,
                                   temperature_c=19.0, humidity_percent=50, light_level=10,
                                   heating_led_on=False, light_warning=False))
        db.session.commit()
    client.application.config["BED_TIMEZONE"] = "UTC"
    nights = client.get("/api/sleep/nights?days=7", headers=auth).json
    assert len(nights) == 1
    assert nights[0]["bed_exits"] == 1
    assert nights[0]["in_bed_minutes"] == 8 * 60 - 15 - 5
    assert nights[0]["avg_temperature_c"] == 19.0
    assert client.get("/api/sleep/nights?days=0", headers=auth).status_code == 400


def test_commands_follow_preference_changes(client, auth):
    client.post("/api/readings", headers=auth, json={"occupied": True, "temperature_c": 18, "humidity_percent": 50, "light_level": 500})
    before = client.get("/api/device/commands", headers=auth).json
    assert before["heating_led_on"] is True and before["light_warning"] is False
    client.patch("/api/preferences", headers=auth, json={"heating_enabled": False, "light_warning_threshold": 400})
    after = client.get("/api/device/commands", headers=auth).json
    assert after["heating_led_on"] is False and after["light_warning"] is True


def test_latest_is_newest_by_time_not_insert_order(client, auth):
    from datetime import datetime, timedelta, timezone
    from smartbed import Reading
    client.post("/api/readings", headers=auth, json={"occupied": True, "temperature_c": 20, "humidity_percent": 50, "light_level": 10})
    with client.application.app_context():  # what seed_demo.py does: backdated rows inserted later
        db.session.add(Reading(recorded_at=datetime.now(timezone.utc) - timedelta(hours=3), occupied=False,
                               temperature_c=18, humidity_percent=50, light_level=10,
                               heating_led_on=False, light_warning=False))
        db.session.commit()
    assert client.get("/api/readings/latest", headers=auth).json["occupied"] is True
    assert [r["occupied"] for r in client.get("/api/readings", headers=auth).json] == [True, False]


def test_readings_time_window_is_thinned(client, auth):
    from datetime import datetime, timedelta, timezone
    from smartbed import Reading
    now = datetime.now(timezone.utc)
    with client.application.app_context():
        for i in range(600):  # one every 5 s for 50 minutes, plus one older row
            db.session.add(Reading(recorded_at=now - timedelta(seconds=5 * i), occupied=i == 0, temperature_c=20,
                                   humidity_percent=50, light_level=10, heating_led_on=False, light_warning=False))
        db.session.add(Reading(recorded_at=now - timedelta(hours=2), occupied=True, temperature_c=20,
                               humidity_percent=50, light_level=10, heating_led_on=False, light_warning=False))
        db.session.commit()
    rows = client.get("/api/readings?minutes=60&limit=100", headers=auth).json
    assert 50 <= len(rows) <= 100
    assert rows[0]["occupied"] is True  # newest kept
    assert client.get("/api/readings?minutes=0", headers=auth).status_code == 400


def test_alarm_rings_until_answered(client, auth):
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    from smartbed import Alarm, alarm_ringing
    tz = ZoneInfo("Europe/Dublin")
    now = datetime.now(tz)
    alarm = Alarm(time=(now - timedelta(minutes=3)).strftime("%H:%M"), enabled=True, snooze_minutes=5)
    assert alarm_ringing(alarm, now)  # missed the exact minute, still rings
    assert not alarm_ringing(alarm, now + timedelta(minutes=40))  # gives up after RING_LIMIT
    alarm.last_triggered_date = (now - timedelta(minutes=3)).date().isoformat()
    assert not alarm_ringing(alarm, now)  # dismissed


def test_new_alarm_for_a_time_just_passed_stays_quiet(client, auth):
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    past = (datetime.now(ZoneInfo("Europe/Dublin")) - timedelta(minutes=2)).strftime("%H:%M")
    client.post("/api/alarms", headers=auth, json={"time": past})
    assert client.get("/api/device/commands", headers=auth).json["buzzer_on"] is False


def test_readings_window_still_returns_latest_when_quiet(client, auth):
    from datetime import datetime, timedelta, timezone
    from smartbed import Reading
    with client.application.app_context():
        db.session.add(Reading(recorded_at=datetime.now(timezone.utc) - timedelta(hours=12), occupied=True, temperature_c=20,
                               humidity_percent=50, light_level=10, heating_led_on=False, light_warning=False))
        db.session.commit()
    assert len(client.get("/api/readings?minutes=60", headers=auth).json) == 1
