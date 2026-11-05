
import pigpio
import pigpio_dht.dhtxx as dhtxx
from pigpio_dht import DHT22


def _edge_callback_60us(self, gpio, level, tick):
    hl_text = "HIGH" if level == 1 else "LOW"

    if self._edge_count <= 1:
        dhtxx._debug(self._edge_count, "RPI->DHT", "Request Data", hl_text)

    elif self._edge_count <= 3:
        self.sensor_responded = True
        dhtxx._debug(self._edge_count, "RPI<-DHT", "Transmission Starting", hl_text)

    elif self._edge_count <= 4:
        dhtxx._debug(self._edge_count, "RPI<-DHT", "Data (Initial LOW)", hl_text)

    elif self._edge_count <= 84:
        dhtxx._debug(self._edge_count, "RPI<-DHT", "Data", hl_text)

        elapsed = tick - self._last_tick
        self._last_tick = tick

        if level == 0:
            bit = 1 if elapsed >= 60 else 0
            self.data.append(bit)
            dhtxx._debug(
                "  Elapsed microseconds={}, so data[{}]={}".format(
                    elapsed, self._bit_count, bit
                )
            )
            self._bit_count += 1

    else:
        dhtxx._debug(
            self._edge_count,
            "RPI<-DHT",
            "Data (Transmission Complete)",
            hl_text
        )
        self._edge_callback_fn.cancel()
        self.read_success = len(self.data) == dhtxx.DHTXX.EXPECTED_DATA_BITS
        self._c1 = self._pi.get_current_tick()

        assert level == pigpio.HIGH
        assert self._edge_count == dhtxx.DHTXX.SUCCESS_EDGE_COUNT - 1

    self._last_tick = tick
    self._edge_count += 1


dhtxx.DHTXX._edge_callback = _edge_callback_60us


class DHT22Sensor:

    def __init__(self):
        self.sensor = DHT22(4)

    def read(self):
        try:
            reading = self.sensor.read()

            if not reading["valid"]:
                return None

            return {
                "temperature_c": round(reading["temp_c"], 1),
                "humidity_percent": round(reading["humidity"], 1)
            }

        except RuntimeError as error:
            print(f"DHT22 reading error: {error}")
            return None

    def close(self):
        self.sensor._pi.stop()
