# Generated with Claude (Anthropic, 2026).
"""Pretend to be the Pis of the simulated beds, publishing over MQTT.

    python simulate.py                    publish for sim-patrick and sim-siobhan
    python simulate.py --include-maureen  also fake pi-maureen (when the real Pi is off)

It goes through exactly the same path as the real Pi (broker -> server -> database),
which is what makes it a fair demo. Uses the same MQTT_* settings as the server's .env.
"""
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env", encoding="utf-8-sig")

from app.fake import fake_reading  # noqa: E402  (after load_dotenv on purpose)

DEVICES = ["sim-patrick", "sim-siobhan"] + (["pi-maureen"] if "--include-maureen" in sys.argv else [])
INTERVAL = int(os.getenv("SIM_INTERVAL_SECONDS", "10"))
TZ = ZoneInfo("Europe/Dublin")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="smartbed-simulator")
if os.getenv("SIM_MQTT_USERNAME") or os.getenv("MQTT_USERNAME"):
    client.username_pw_set(os.getenv("SIM_MQTT_USERNAME") or os.getenv("MQTT_USERNAME"),
                           os.getenv("SIM_MQTT_PASSWORD") or os.getenv("MQTT_PASSWORD"))
if os.getenv("MQTT_TLS", "false").lower() == "true":
    client.tls_set()
client.on_message = lambda c, u, msg: print(f"  <- {msg.topic}: {msg.payload.decode()}")
client.connect(os.getenv("MQTT_HOST", "localhost"), int(os.getenv("MQTT_PORT", "1883")))
for device_id in DEVICES:
    client.subscribe(f"smartbed/{device_id}/commands", qos=1)   # see what the server says back
client.loop_start()

temperatures = {d: 19.0 for d in DEVICES}
print(f"Publishing for {', '.join(DEVICES)} every {INTERVAL}s. Ctrl+C to stop.")
try:
    while True:
        for device_id in DEVICES:
            data, temperatures[device_id] = fake_reading(datetime.now(TZ), temperatures[device_id])
            client.publish(f"smartbed/{device_id}/readings", json.dumps(data), qos=1)
            print(f"-> {device_id}: {data}")
        time.sleep(INTERVAL)
except KeyboardInterrupt:
    pass
finally:
    client.loop_stop()
    client.disconnect()
