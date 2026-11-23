
"""Tests for FSR402 sensor validation and recovery."""

from pathlib import Path
import sys

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1])
)

from sensors.fsr_quality import (
    valid_fsr_raw,
    fsr_is_fresh
)
from sensors.occupancy import OccupancyFilter


def test_pressure_validation():
    # Valid MCP3008 readings
    assert valid_fsr_raw(0)
    assert valid_fsr_raw(512)
    assert valid_fsr_raw(1023)

    # Invalid readings
    assert not valid_fsr_raw(None)
    assert not valid_fsr_raw(-1)
    assert not valid_fsr_raw(1024)
    assert not valid_fsr_raw("500")
    assert not valid_fsr_raw(True)


def test_pressure_freshness():
    # Fresh sensor measurements
    assert fsr_is_fresh(100, 110, 30)
    assert fsr_is_fresh(100, 130, 30)

    # Expired or invalid measurements
    assert not fsr_is_fresh(100, 131, 30)
    assert not fsr_is_fresh(None, 110, 30)
    assert not fsr_is_fresh(120, 110, 30)


def test_occupancy_recovery():
    sensor = OccupancyFilter(
        threshold=20,
        hysteresis=5,
        samples=2
    )

    # Confirm occupied state
    sensor.update(25)
    assert sensor.update(25) == (True, True)

    # Simulate pressure sensor failure
    sensor.reset()

    assert sensor.state is None

    # Require fresh confirmation after recovery
    assert sensor.update(0) == (None, False)
    assert sensor.update(0) == (False, True)


if __name__ == "__main__":
    test_pressure_validation()
    test_pressure_freshness()
    test_occupancy_recovery()

    print("FSR402 reliability checks passed")
