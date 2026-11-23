# Partly generated with Claude (Anthropic, 2026): Adrian's sensor loop (DHT22 + FSR402)
# merged with the MQTT publisher/subscriber.os
"""Runs on Maureen's Pi Zero.

Reads the FSR402 (bed pressure, through the MCP3008) every FSR402_INTERVAL_SECONDS and
the DHT22 every DHT22_INTERVAL_SECONDS. Every PUBLISH_EVERY_SECONDS, and straight away
whenever someone gets into or out of bed, it PUBLISHES a reading to
    smartbed/<DEVICE_ID>/readings
and it SUBSCRIBES to
    smartbed/<DEVICE_ID>/commands
to switch the heater LED and the alarm buzzer. The Pi never talks HTTP and never
knows which bed it is on: the server looks that up from DEVICE_ID.

Setup on the Pi (once):
    sudo systemctl enable --now pigpiod        # the DHT22 code needs the pigpio daemon
    pip install -r requirements.txt
    cp .env.example .env                       # then fill in the broker details
    python main.py
"""
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from actuators.buzzer import AlarmBuzzer  # noqa: E402
from actuators.leds import HeaterLED      # noqa: E402
from sensors.dht22 import DHT22Sensor     # noqa: E402
from sensors.fsr402 import FSR402         # noqa: E402
from sensors.occupancy import OccupancyFilter
from commands import decode_command

from sensors.dht_freshness import (
    valid_dht_reading,
    dht_reading_is_fresh
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("smartbed-pi")

DEVICE_ID = os.getenv("DEVICE_ID", "pi-maureen")
# Short intervals for testing; for real use e.g. DHT22 600 s and publish 300 s.
FSR402_INTERVAL = float(os.getenv("FSR402_INTERVAL_SECONDS", "5"))
DHT22_INTERVAL = float(os.getenv("DHT22_INTERVAL_SECONDS", "30"))
# Stop reusing DHT22 readings after three sampling intervals.
DHT_MAX_AGE = float(
    os.getenv(
        "DHT_MAX_AGE_SECONDS",
        str(DHT22_INTERVAL * 3)
    )
)

if DHT_MAX_AGE <= 0:
    raise ValueError("DHT_MAX_AGE_SECONDS must be positive")
PUBLISH_EVERY = float(os.getenv("PUBLISH_EVERY_SECONDS", "30"))
# Pressure signal (0-100 %) above which we count the bed as occupied. Tune it on the real bed.
OCCUPIED_THRESHOLD = float(os.getenv("OCCUPIED_THRESHOLD_PERCENT", "20"))
# There is no light sensor on the build, so this stays fixed.
LIGHT_LEVEL = 0
# Fail-safe: if the server goes quiet, don't leave the heater on forever.
COMMAND_TIMEOUT = float(os.getenv("COMMAND_TIMEOUT_SECONDS", "300"))

READINGS = f"smartbed/{DEVICE_ID}/readings"
COMMANDS = f"smartbed/{DEVICE_ID}/commands"
STATUS = f"smartbed/{DEVICE_ID}/status"


def get_timestamp():
    return datetime.now(timezone.utc).isoformat()


def main() -> None:

    pressure_filter = OccupancyFilter(
        threshold=OCCUPIED_THRESHOLD,
        hysteresis=float(
            os.getenv("OCCUPANCY_HYSTERESIS", "5")
        ),
        samples=int(
            os.getenv("OCCUPANCY_CONFIRM_SAMPLES", "2")
        )
    )

    fsr = FSR402(channel=0)
    dht = DHT22Sensor()
    heater = HeaterLED(int(os.getenv("HEATER_LED_PIN", "17")))
    buzzer = AlarmBuzzer(int(os.getenv("BUZZER_PIN", "27")))
    last_command = time.monotonic()

    # Track the newest command accepted by the Pi.
    latest_command_issued = None

    # Track when the accepted command expires.
    command_expires_at = None

    def on_connect(client, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            log.error("Broker refused the connection: %s", reason_code)
            return
        log.info("Connected as %s", DEVICE_ID)
        client.subscribe(COMMANDS, qos=1)              # (re)subscribe after every reconnect
        client.publish(STATUS, "online", qos=1, retain=True)

    
    def on_message(client, userdata, msg):
        nonlocal last_command
        nonlocal latest_command_issued
        nonlocal command_expires_at

        try:
            # Validate command before touching GPIO.
            commands, issued, expires = decode_command(
                msg.payload,
                previous_issued=latest_command_issued
            )

            # Only validated booleans reach the actuators.
            heater.set(commands["heating_led_on"])
            buzzer.set(commands["buzzer_on"])

            # Save accepted command information.
            latest_command_issued = issued
            command_expires_at = expires
            last_command = time.monotonic()

            log.info(
                "Validated MQTT command: heater=%s buzzer=%s",
                commands["heating_led_on"],
                commands["buzzer_on"]
            )

        except ValueError as err:
            log.warning(
                "Rejected unsafe MQTT command: %s",
                err
            )


    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=DEVICE_ID)
    client.username_pw_set(os.getenv("MQTT_USERNAME", DEVICE_ID), os.getenv("MQTT_PASSWORD"))
    if os.getenv("MQTT_TLS", "false").lower() == "true":
        client.tls_set()
    # "Last will": if the Pi drops off without saying goodbye, the broker announces it.
    client.will_set(STATUS, "offline", qos=1, retain=True)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect_async(os.environ["MQTT_HOST"], int(os.getenv("MQTT_PORT", "1883")))
    client.loop_start()

    latest_dht = None          # {"temperature_c": .., "humidity_percent": ..}
    last_good_dht_at = None
    occupied = None
    pressure_percent = 0.0
    now = time.monotonic()
    next_fsr = next_dht = next_publish = now

    try:
        log.info("SmartBed hardware controller started (FSR402 + DHT22)")
        while True:
            now = time.monotonic()

            if now >= next_dht:

                # Was the previous measurement already stale?
                previously_stale = not dht_reading_is_fresh(
                    last_good_dht_at,
                    now,
                    DHT_MAX_AGE
                )

                # Read temperature and humidity.
                reading = dht.read()

                if valid_dht_reading(reading):

                    latest_dht = reading

                    # Record the actual successful read time.
                    last_good_dht_at = time.monotonic()

                    log.info(
                        "DHT22: temperature=%s°C humidity=%s%%",
                        reading["temperature_c"],
                        reading["humidity_percent"]
                    )

                    # Resume publishing promptly after recovery.
                    if previously_stale:
                        next_publish = now

                else:
                    log.warning(
                        "DHT22 reading failed or returned "
                        "invalid data"
                    )

                next_dht = now + DHT22_INTERVAL


           
            if now >= next_fsr:
                # Step 1: Read the FSR402 pressure sensor.
                raw = fsr.read_raw()

                # Step 2: Convert the raw ADC reading
                # into a percentage (0-100%).
                pressure_percent = round(
                    (raw / 1023) * 100,
                    2
                )

                # Step 3: Apply hysteresis and confirmation
                # sampling to reduce false occupancy changes.
                occupied, changed = pressure_filter.update(
                    pressure_percent
                )

                # Step 4: Only publish immediately when
                # a new occupancy state has been confirmed.
                if changed and occupied is not None:
                    log.info(
                        "Bed %s (pressure %.2f%%)",
                        "occupied" if occupied else "empty",
                        pressure_percent
                    )

                    next_publish = now

                # Step 5: Schedule the next pressure reading.
                next_fsr = now + FSR402_INTERVAL


           
            if now >= next_publish:

                dht_fresh = dht_reading_is_fresh(
                    last_good_dht_at,
                    now,
                    DHT_MAX_AGE
                )

                if occupied is None:
                    log.debug(
                        "Skipping publish: occupancy not confirmed"
                    )

                elif latest_dht is None or not dht_fresh:
                    log.warning(
                        "Skipping MQTT publish: DHT22 "
                        "temperature/humidity data is stale"
                    )

                else:
                    payload = {
                        "recorded_at": get_timestamp(),
                        "occupied": occupied,
                        "temperature_c": latest_dht[
                            "temperature_c"
                        ],
                        "humidity_percent": latest_dht[
                            "humidity_percent"
                        ],
                        "light_level": LIGHT_LEVEL,
                    }

                    client.publish(
                        READINGS,
                        json.dumps(payload),
                        qos=1
                    )

                    log.info(
                        "Published %s (pressure %.2f%%)",
                        payload,
                        pressure_percent
                    )

                # Schedule the next attempt even if data is stale.
                # This prevents repeated warnings every 0.1 seconds.
                next_publish = now + PUBLISH_EVERY


          
            # Turn outputs off if the server stops sending commands
            # or the last accepted command has expired.
            timed_out = (
                now - last_command > COMMAND_TIMEOUT
            )

            expired = (
                command_expires_at is not None
                and datetime.now(timezone.utc)
                >= command_expires_at
            )

            if timed_out or expired:
                heater.set(False)
                buzzer.set(False)

            time.sleep(0.1)
    except KeyboardInterrupt:
        log.info("SmartBed hardware controller stopped")
    finally:
        client.publish(STATUS, "offline", qos=1, retain=True)
        client.loop_stop()
        client.disconnect()
        heater.set(False)
        buzzer.set(False)
        heater.close()
        buzzer.close()
        fsr.close()
        dht.close()
        log.info("Hardware connections closed")


if __name__ == "__main__":
    main()
