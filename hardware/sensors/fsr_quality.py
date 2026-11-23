
"""Validate FSR402 pressure readings and freshness."""


def valid_fsr_raw(value):
    """
    MCP3008 returns integer readings from 0 to 1023.
    Reject missing, incorrect or out-of-range values.
    """
    return type(value) is int and 0 <= value <= 1023


def fsr_is_fresh(last_success_at, now, max_age_seconds):
    """
    Check the age of the last successful pressure reading.

    Timestamps are from time.monotonic().
    """
    return (
        last_success_at is not None
        and max_age_seconds > 0
        and 0 <= now - last_success_at <= max_age_seconds
    )
