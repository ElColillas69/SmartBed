# Generated with Claude (Anthropic, 2026).
"""The red LED that stands in for the bed's heating pad."""
from gpiozero import LED


class HeaterLED:
    def __init__(self, pin: int = 17):
        self.led = LED(pin)

    def set(self, on: bool) -> None:
        self.led.on() if on else self.led.off()

    def close(self) -> None:
        self.led.close()
