# Generated with Claude (Anthropic, 2026).
"""Runs on Maureen's Pi Zero.

Every READ_EVERY_SECONDS it reads the DHT22 and PUBLISHES the reading to
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
from pathlib import Path

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from actuators.buzzer import AlarmBuzzer  # noqa: E402
from actuators.leds import HeaterLED      # noqa: E402
from sensors.dht22 import DHT22Sensor     # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("smartbed-pi")

DEVICE_ID = os.getenv("DEVICE_ID", "pi-maureen")
READ_EVERY = int(os.getenv("READ_EVERY_SECONDS", "30"))
# The build has no bed (pressure) sensor or light sensor yet, so these are fixed
# values. Replace them with real readings when an FSR/LDR is wired up.
ASSUME_OCCUPIED = os.getenv("ASSUME_OCCUPIED", "true").lower() == "true"
LIGHT_LEVEL = 0
# Fail-safe: if the server goes quiet, don't leave the heater on forever.
COMMAND_TIMEOUT = int(os.getenv("COMMAND_TIMEOUT_SECONDS", "300"))

READINGS = f"smartbed/{DEVICE_ID}/readings"
COMMANDS = f"smartbed/{DEVICE_ID}/commands"
STATUS = f"smartbed/{DEVICE_ID}/status"


def main() -> None:
    sensor = DHT22Sensor()
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

    try:
        while True:
            reading = sensor.read()                    # None if the DHT22 read failed
            if reading is None:
                log.warning("DHT22 read failed, trying again next cycle")
            else:
                payload = {**reading, "occupied": ASSUME_OCCUPIED, "light_level": LIGHT_LEVEL}
                client.publish(READINGS, json.dumps(payload), qos=1)
                log.info("Published %s", payload)
            if time.monotonic() - last_command > COMMAND_TIMEOUT:
                heater.set(False)                      # fail-safe: heater off when out of touch
                buzzer.set(False)
            time.sleep(READ_EVERY)
    except KeyboardInterrupt:
        pass
    finally:
        client.publish(STATUS, "offline", qos=1, retain=True)
        client.loop_stop()
        client.disconnect()
        heater.set(False)
        buzzer.set(False)
        heater.close()
        buzzer.close()
        sensor.close()


if __name__ == "__main__":
    main()
