
import spidev
import time


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


if __name__ == "__main__":
    sensor = FSR402()

    print("Reading FSR402...")
    print("Press the sensor to see the readings change.")
    print("Press CTRL+C to stop.\n")

    try:
        while True:
            raw = sensor.read_raw()
            percentage = round((raw / 1023) * 100, 2)

            print(f"Pressure: {raw}/1023 | Signal: {percentage}%")

            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\nTest stopped.")

    finally:
        sensor.close()
