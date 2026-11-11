import time
import json
from datetime import datetime, timezone

from sensors.fsr402 import FSR402
from sensors.dht22 import DHT22Sensor


DHT22_INTERVAL = 600
FSR402_INTERVAL = 5


def get_timestamp():
    return datetime.now(timezone.utc).isoformat()


def main():
    fsr = None
    dht = None

    latest_dht_reading = None

    try:
        print("Starting SmartBed hardware controller...")
        
        fsr = FSR402(channel=0)
        dht = DHT22Sensor()

        print("FSR402 initialised.")
        print("DHT22 initialised.")
        print("Both sensors are ready.\n")

        current_time = time.monotonic()

        next_fsr_reading = current_time
        next_dht_reading = current_time

        while True:
            current_time = time.monotonic()

            if current_time >= next_dht_reading:
                print("Reading DHT22...")

                reading = dht.read()

                if reading is not None:
                    latest_dht_reading = reading
                    print("DHT22 reading successful.")
                else:
                    print("DHT22 reading unavailable.")

                next_dht_reading = current_time + DHT22_INTERVAL

            if current_time >= next_fsr_reading:
                raw_pressure = fsr.read_raw()

                pressure_percentage = round(
                    (raw_pressure / 1023) * 100, 2
                )

                sensor_data = {
                    "timestamp": get_timestamp(),
                    "sensors": {
                        "fsr402": {
                            "raw": raw_pressure,
                            "signal_percent": pressure_percentage
                        },
                        "dht22": latest_dht_reading
                    }
                }

                print(json.dumps(sensor_data))

                next_fsr_reading = current_time + FSR402_INTERVAL

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\nSmartBed hardware controller stopped.")

    finally:
        if fsr is not None:
            fsr.close()

        if dht is not None:
            dht.close()

        print("Hardware connections closed.")


if __name__ == "__main__":
    main()
