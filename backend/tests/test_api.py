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
