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

if __name__ == "__main__":
    import os
    from pathlib import Path
    from time import sleep
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    pin = int(os.getenv("HEATER_LED_PIN", "17"))
    heater = HeaterLED(pin)
    print(f"Blinking the heater LED on GPIO {pin}. Press CTRL+C to stop.")
    try:
        while True:
            heater.set(True)
            sleep(0.5)
            heater.set(False)
            sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        heater.close()