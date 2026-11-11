
import spidev


class FSR402:
    def __init__(self, channel=0):
        self.channel = channel
        self.spi = spidev.SpiDev()
        self.spi.open(0, 0)
        self.spi.max_speed_hz = 1000000
        self.spi.mode = 0

    def read_raw(self):
        result = self.spi.xfer2([1, (8 + self.channel) << 4, 0])
        value = ((result[1] & 3) << 8) | result[2]
        return value

    def read_percentage(self):
        raw_value = self.read_raw()
        percentage = (raw_value / 1023) * 100
        return round(percentage, 2)

    def close(self):
        self.spi.close()
