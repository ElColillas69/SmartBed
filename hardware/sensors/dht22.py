
import board
import adafruit_dht


class DHT22Sensor:

    def __init__(self):
        self.sensor = adafruit_dht.DHT22(
            board.D4,
            use_pulseio=False
        )

    def read(self):
        try:
            temperature = self.sensor.temperature
            humidity = self.sensor.humidity

            return {
                "temperature_c": round(temperature, 1),
                "humidity_percent": round(humidity, 1)
            }

        except RuntimeError as error:
            print(f"DHT22 reading error: {error}")
            return None

    def close(self):
        self.sensor.exit()
