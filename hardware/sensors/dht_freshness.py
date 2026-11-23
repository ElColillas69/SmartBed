"""Validate DHT22 readings and prevent stale sensor data.""" 

from math import isfinite

def valid_dht_reading(reading):
    """
    Return True only when temperature and humidity
    contain valid, finite values.
    """

    if not isinstance(reading, dict):
        return False

    temperature = reading.get("temperature_c")
    humidity = reading.get("humidity_percent")

    values = (temperature, humidity)

    if not all(
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and isfinite(value)
        for value in values
    ):
        return False

    return (
        -40 <= temperature <= 80
        and 0 <= humidity <= 100
    )


def dht_reading_is_fresh(
    last_success_at,
    now,
    max_age_seconds
):
    """
    Check whether the most recent successful
    sensor reading is still fresh.

    Times use time.monotonic() seconds.
    """

    return (
        last_success_at is not None
        and max_age_seconds > 0
        and 0 <= now - last_success_at <= max_age_seconds
    )
