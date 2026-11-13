# Partly generated with Claude (Anthropic, 2026): Adrian's sensor loop (DHT22 + FSR402)
# merged with the MQTT publisher/subscriber.
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("smartbed-pi")

DEVICE_ID = os.getenv("DEVICE_ID", "pi-maureen")
# Short intervals for testing; for real use e.g. DHT22 600 s and publish 300 s.
FSR402_INTERVAL = float(os.getenv("FSR402_INTERVAL_SECONDS", "5"))
DHT22_INTERVAL = float(os.getenv("DHT22_INTERVAL_SECONDS", "30"))
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
    fsr = FSR402(channel=0)
    dht = DHT22Sensor()
    heater = HeaterLED(int(os.getenv("HEATER_LED_PIN", "17")))
    buzzer = AlarmBuzzer(int(os.getenv("BUZZER_PIN", "27")))
    last_command = time.monotonic()

    def on_connect(client, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            log.error("Broker refused the connection: %s", reason_code)
            return
        log.info("Connected as %s", DEVICE_ID)
        client.subscribe(COMMANDS, qos=1)              # (re)subscribe after every reconnect
        client.publish(STATUS, "online", qos=1, retain=True)

    def on_message(client, userdata, msg):
        nonlocal last_command
        try:
            commands = json.loads(msg.payload)
            heater.set(bool(commands["heating_led_on"]))
            buzzer.set(bool(commands["buzzer_on"]))
            last_command = time.monotonic()
            log.info("Commands: heater=%s buzzer=%s", commands["heating_led_on"], commands["buzzer_on"])
        except (ValueError, KeyError) as err:
            log.warning("Ignored bad command %r: %s", msg.payload, err)

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
    occupied = None
    pressure_percent = 0.0
    now = time.monotonic()
    next_fsr = next_dht = next_publish = now

    try:
        log.info("SmartBed hardware controller started (FSR402 + DHT22)")
        while True:
            now = time.monotonic()

            if now >= next_dht:
                reading = dht.read()                   # None if the DHT22 read failed
                if reading is None:
                    log.warning("DHT22 read failed, keeping the last reading")
                else:
                    latest_dht = reading
                next_dht = now + DHT22_INTERVAL

            if now >= next_fsr:
                raw = fsr.read_raw()
                pressure_percent = round((raw / 1023) * 100, 2)
                was_occupied = occupied
                occupied = pressure_percent >= OCCUPIED_THRESHOLD
                if was_occupied is not None and occupied != was_occupied:
                    log.info("Bed %s (pressure %s%%)", "occupied" if occupied else "empty", pressure_percent)
                    next_publish = now                 # tell the server straight away
                next_fsr = now + FSR402_INTERVAL

            if now >= next_publish and latest_dht is not None and occupied is not None:
                # The server expects one flat reading, so the nested sensor data is mapped here.
                payload = {
                    "recorded_at": get_timestamp(),
                    "occupied": occupied,
                    "temperature_c": latest_dht["temperature_c"],
                    "humidity_percent": latest_dht["humidity_percent"],
                    "light_level": LIGHT_LEVEL,
                }
                client.publish(READINGS, json.dumps(payload), qos=1)
                log.info("Published %s (pressure %s%%)", payload, pressure_percent)
                next_publish = now + PUBLISH_EVERY

            if now - last_command > COMMAND_TIMEOUT:
                heater.set(False)                      # fail-safe: heater off when out of touch
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
