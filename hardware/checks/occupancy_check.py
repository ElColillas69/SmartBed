
"""Tests for SmartBed pressure sensor filtering."""

from pathlib import Path
import sys

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1])
)

from sensors.occupancy import OccupancyFilter


def test_filter():
    sensor = OccupancyFilter(
        threshold=20,
        hysteresis=5,
        samples=2
    )

    # Initial empty reading is not yet confirmed.
    assert sensor.update(0) == (None, False)

    # Two empty readings confirm an empty bed.
    assert sensor.update(0) == (False, True)

    # First high reading: no change yet.
    assert sensor.update(23) == (False, False)

    # Second high reading: occupied.
    assert sensor.update(23) == (True, True)

    # Slight pressure drop: remain occupied.
    assert sensor.update(18) == (True, False)

    # First low reading: don't change yet.
    assert sensor.update(13) == (True, False)

    # Second low reading: bed becomes empty.
    assert sensor.update(13) == (False, True)

    # Brief pressure spike must not confirm occupancy.
    assert sensor.update(21) == (False, False)

    # Back to low pressure: remain empty.
    assert sensor.update(10) == (False, False)

    print("FSR402 occupancy filtering tests passed")


if __name__ == "__main__":
    test_filter()
