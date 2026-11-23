
"""Tests for SmartBed DHT22 validation and freshness."""

from pathlib import Path
import sys

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1])
)

from sensors.dht_freshness import (
    valid_dht_reading,
    dht_reading_is_fresh
)


def test_dht_validation():

    # Valid measurements should be accepted.
    assert valid_dht_reading({
        "temperature_c": 21.3,
        "humidity_percent": 47.5
    })

    # Missing readings must be rejected.
    assert not valid_dht_reading(None)
    assert not valid_dht_reading({})

    # Invalid temperatures must be rejected.
    assert not valid_dht_reading({
        "temperature_c": 95,
        "humidity_percent": 50
    })

    # Invalid humidity must be rejected.
    assert not valid_dht_reading({
        "temperature_c": 21,
        "humidity_percent": -2
    })

    # NaN and infinity must be rejected.
    assert not valid_dht_reading({
        "temperature_c": float("nan"),
        "humidity_percent": 50
    })

    assert not valid_dht_reading({
        "temperature_c": 21,
        "humidity_percent": float("inf")
    })


def test_dht_freshness():

    now = 1000
    max_age = 90

    # Recent reading: accepted.
    assert dht_reading_is_fresh(
        950, now, max_age
    )

    # Exactly 90 seconds old: accepted.
    assert dht_reading_is_fresh(
        910, now, max_age
    )

    # Expired reading: rejected.
    assert not dht_reading_is_fresh(
        800, now, max_age
    )

    # Missing successful reading: rejected.
    assert not dht_reading_is_fresh(
        None, now, max_age
    )

    # A future monotonic timestamp is invalid.
    assert not dht_reading_is_fresh(
        1100, now, max_age
    )


if __name__ == "__main__":

    test_dht_validation()
    test_dht_freshness()

    print("DHT22 validation and freshness checks passed")
