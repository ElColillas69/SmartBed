
"""Tests for shared SmartBed care preferences."""

import pytest

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Bed


@pytest.fixture
def client():
    # Use the temporary test database configured in conftest.py.
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        db.add(
            Bed(
                resident_name="Maureen",
                pairing_code="MAUREEN1"
            )
        )
        db.commit()

    with TestClient(app) as test_client:
        yield test_client


def auth_headers(client, email):
    register = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "password123",
            "display_name": "Carer"
        }
    )

    assert register.status_code == 201

    login = client.post(
        "/api/auth/login",
        data={
            "username": email,
            "password": "password123"
        }
    )

    assert login.status_code == 200

    return {
        "Authorization":
            f"Bearer {login.json()['access_token']}"
    }


def claim_bed(client, headers):
    response = client.post(
        "/api/beds/claim",
        json={"pairing_code": "MAUREEN1"},
        headers=headers
    )

    assert response.status_code == 200
    return response.json()["id"]


def test_care_preferences_shared_between_carers(client):
    carer_a = auth_headers(
        client,
        "carera@example.com"
    )

    bed_id = claim_bed(client, carer_a)
    path = f"/api/beds/{bed_id}/care"

    initial = client.get(path, headers=carer_a)

    assert initial.status_code == 200
    assert initial.json()["residentName"] == "Maureen"
    assert initial.json()["graceMinutes"] == 20

    carer_b = auth_headers(
        client,
        "carerb@example.com"
    )

    # Access must be denied before the second carer
    # is authorised to monitor the bed.
    assert client.get(
        path,
        headers=carer_b
    ).status_code == 404

    # The second carer claims the same bed.
    assert claim_bed(client, carer_b) == bed_id

    updated = {
        **initial.json(),
        "graceMinutes": 15,
        "humidityLimit": 65
    }

    response = client.put(
        path,
        json=updated,
        headers=carer_a
    )

    assert response.status_code == 200

    # Carer B sees what Carer A saved.
    shared = client.get(path, headers=carer_b)

    assert shared.status_code == 200
    assert shared.json()["graceMinutes"] == 15
    assert shared.json()["humidityLimit"] == 65


def test_invalid_care_preferences_rejected(client):
    headers = auth_headers(
        client,
        "carer@example.com"
    )

    bed_id = claim_bed(client, headers)
    path = f"/api/beds/{bed_id}/care"

    original = client.get(
        path,
        headers=headers
    ).json()

    invalid = {
        **original,
        "lowTemp": 30
    }

    assert client.put(
        path,
        json=invalid,
        headers=headers
    ).status_code == 422

    invalid = {
        **original,
        "nightStart": "07:00",
        "nightEnd": "07:00"
    }

    assert client.put(
        path,
        json=invalid,
        headers=headers
    ).status_code == 422

    # Invalid requests must not overwrite stored settings.
    current = client.get(
        path,
        headers=headers
    )

    assert current.json() == original
