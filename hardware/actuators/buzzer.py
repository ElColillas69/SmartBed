# Generated with Claude (Anthropic, 2026).
"""The buzzer used for alarms. Beeps on and off while an alarm is ringing."""
from gpiozero import Buzzer


class AlarmBuzzer:
    def __init__(self, pin: int = 27):
        self.buzzer = Buzzer(pin)
        self.ringing = False

    def set(self, ringing: bool) -> None:
        if ringing and not self.ringing:
            self.buzzer.beep(on_time=0.5, off_time=0.5)   # runs in the background
        elif not ringing and self.ringing:
            self.buzzer.off()
        self.ringing = ringing

    def close(self) -> None:
        self.buzzer.close()
