
"""Filter FSR402 pressure readings to reduce false occupancy changes."""


class OccupancyFilter:
    def __init__(
        self,
        threshold=20.0,
        hysteresis=5.0,
        samples=2
    ):
        if not 0 < threshold <= 100:
            raise ValueError("Invalid pressure threshold")

        if not 0 <= hysteresis < threshold:
            raise ValueError("Invalid hysteresis value")

        if samples < 1:
            raise ValueError("Samples must be at least 1")

        self.threshold = threshold
        self.hysteresis = hysteresis
        self.samples = samples

        self.state = None
        self.candidate = None
        self.count = 0

    def update(self, percent):
        """
        Update occupancy using confirmed pressure readings.

        Returns:
            (occupancy_state, has_changed)
        """

        if not 0 <= percent <= 100:
            raise ValueError("Pressure must be between 0 and 100")

        # Pressure needed to recognise occupancy.
        entering = percent >= self.threshold

        # Lower threshold required to recognise an exit.
        leaving = percent < (
            self.threshold - self.hysteresis
        )

        if self.state is None:
            desired = entering

        elif entering:
            desired = True

        elif leaving:
            desired = False

        else:
            desired = self.state

        # No change required.
        if desired == self.state:
            self.candidate = None
            self.count = 0
            return self.state, False

        # Start counting consecutive matching readings.
        if self.candidate != desired:
            self.candidate = desired
            self.count = 1
        else:
            self.count += 1

        # Wait for enough readings before changing state.
        if self.count < self.samples:
            return self.state, False

        # Confirm the new occupancy state.
        self.state = desired
        self.candidate = None
        self.count = 0

        return self.state, True
