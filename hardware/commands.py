
"""Validate MQTT actuator commands before applying them to GPIO outputs."""

import json
from datetime import datetime, timedelta, timezone


def _utc_timestamp(value):
    """Parse a timezone-aware ISO timestamp into UTC."""

    if not isinstance(value, str):
        raise ValueError("Missing command timestamp")

    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
    except ValueError as exc:
        raise ValueError("Invalid command timestamp") from exc

    if parsed.tzinfo is None:
        raise ValueError(
            "Command timestamps must include a timezone"
        )

    return parsed.astimezone(timezone.utc)


def decode_command(payload, now=None, previous_issued=None):
    """
    Validate an MQTT command before using its values.

    Reject:
    - Invalid JSON
    - Non-boolean actuator values
    - Expired commands
    - Excessively future-dated commands
    - Commands with excessive lifetimes
    - Previously accepted or older commands

    Returns:
        (command, issued_at, expires_at)
    """

    now = now if now is not None else datetime.now(timezone.utc)

    if now.tzinfo is None:
        raise ValueError("Current time must be timezone-aware")

    now = now.astimezone(timezone.utc)

    # Step 1: Parse JSON safely.
    try:
        data = json.loads(payload)
    except (TypeError, ValueError, UnicodeDecodeError) as exc:
        raise ValueError("Malformed command JSON") from exc

    if not isinstance(data, dict):
        raise ValueError("Command must be a JSON object")

    # Step 2: Require actual JSON boolean values.
    for field in ("heating_led_on", "buzzer_on"):
        if type(data.get(field)) is not bool:
            raise ValueError(
                f"{field} must be a JSON boolean"
            )

    # Step 3: Validate command timestamps.
    issued = _utc_timestamp(data.get("issued_at"))
    expires = _utc_timestamp(data.get("expires_at"))

    if issued > now + timedelta(seconds=30):
        raise ValueError("Command issued in the future")

    if expires <= now or expires <= issued:
        raise ValueError("Command has expired")

    if expires > issued + timedelta(seconds=120):
        raise ValueError(
            "Command expiry is too far from issue time"
        )

    # Step 4: Reject duplicate and out-of-order commands.
    if (
        previous_issued is not None
        and issued <= previous_issued
    ):
        raise ValueError("Replayed or older command")

    return data, issued, expires
