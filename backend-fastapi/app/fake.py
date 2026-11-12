# Generated with Claude (Anthropic, 2026).
"""Believable fake readings for the simulated beds (and for Maureen when the Pi is off).

Shared by seed.py (history) and simulate.py (live), so both look the same.
Nothing here touches hardware, so it runs fine on Windows.
"""
import random
from datetime import datetime, time


def in_bed_at(local: datetime, bedtime: time = time(22, 30), wake: time = time(7, 0)) -> bool:
    t = local.time()
    asleep = t >= bedtime or t < wake
    # A short trip out of bed around 03:00 each night.
    if time(3, 0) <= t < time(3, 12):
        return False
    return asleep


def fake_reading(local: datetime, temperature: float) -> tuple[dict, float]:
    """Return (reading dict, next temperature). Temperature drifts slowly like a real room."""
    temperature = min(24.0, max(16.0, temperature + random.uniform(-0.15, 0.15)))
    dark = local.hour >= 21 or local.hour < 7
    return {
        "occupied": in_bed_at(local),
        "temperature_c": round(temperature, 1),
        "humidity_percent": round(random.uniform(42, 55), 1),
        "light_level": random.randint(0, 60) if dark else random.randint(300, 700),
    }, temperature
