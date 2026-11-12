# Generated with Claude (Anthropic, 2026).
"""MQTT bridge: the pub-sub link between the bed devices and this server.

Topics (one pair per device; device_id is e.g. "pi-maureen"):
    smartbed/<device_id>/readings   device -> server   JSON matching schemas.ReadingIn
    smartbed/<device_id>/commands   server -> device   JSON matching schemas.Commands (retained)

The server subscribes to smartbed/+/readings ("+" = any one topic level), saves each
reading on the bed that device belongs to, and replies with what the device should do.

Docs: paho-mqtt client  https://eclipse.dev/paho/files/paho.mqtt.python/html/client.html
      MQTT topics/wildcards  https://www.hivemq.com/blog/mqtt-essentials-part-5-mqtt-topics-best-practices/
"""
import logging
import os

import paho.mqtt.client as mqtt
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import SessionLocal
from .ingest import commands_for_bed, save_reading
from .models import Device
from .schemas import Commands, ReadingIn

log = logging.getLogger("smartbed.mqtt")

READINGS_TOPIC = "smartbed/+/readings"

_client: mqtt.Client | None = None      # None when MQTT is switched off (e.g. in tests)


def commands_topic(device_id: str) -> str:
    return f"smartbed/{device_id}/commands"


def start() -> None:
    """Connect to the broker in the background. Called once from main.py's lifespan."""
    global _client
    host = os.getenv("MQTT_HOST")
    if not host:
        log.warning("MQTT_HOST is not set, so the MQTT bridge is off")
        return
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                         client_id=os.getenv("MQTT_CLIENT_ID", "smartbed-server"))
    if os.getenv("MQTT_USERNAME"):
        client.username_pw_set(os.getenv("MQTT_USERNAME"), os.getenv("MQTT_PASSWORD"))
    if os.getenv("MQTT_TLS", "false").lower() == "true":
        client.tls_set()                 # encrypt, and check the broker's certificate
    client.on_connect = _on_connect
    client.on_message = _on_message
    # connect_async + loop_start: paho runs its own background thread and keeps
    # reconnecting, so the web server still starts if the broker is down.
    client.connect_async(host, int(os.getenv("MQTT_PORT", "1883")))
    client.loop_start()
    _client = client


def stop() -> None:
    global _client
    if _client is not None:
        _client.loop_stop()
        _client.disconnect()
        _client = None


def push_commands(db: Session, bed_id: str) -> None:
    """Tell a bed's device(s) what to do now. HTTP routes call this after a change
    (settings saved, alarm snoozed...) so the Pi reacts without waiting for a reading."""
    if _client is None:
        return
    commands = commands_for_bed(db, bed_id)
    for device in db.scalars(select(Device).where(Device.bed_id == bed_id)):
        _publish(_client, device.device_id, commands)


def _publish(client: mqtt.Client, device_id: str, commands: Commands) -> None:
    # retain=True: the broker keeps the last command, so a Pi that reboots gets it
    # immediately on subscribing. qos=1: delivered at least once.
    client.publish(commands_topic(device_id), commands.model_dump_json(), qos=1, retain=True)


def _on_connect(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        log.error("MQTT connection refused: %s", reason_code)
        return
    log.info("Connected to MQTT broker, subscribing to %s", READINGS_TOPIC)
    # Subscribe here (not in start) so it happens again after every reconnect.
    client.subscribe(READINGS_TOPIC, qos=1)


def _on_message(client, userdata, msg):
    # This runs on paho's thread, not FastAPI's, so it opens its own DB session.
    # Any uncaught exception here would kill the MQTT thread, hence the broad except.
    try:
        parts = msg.topic.split("/")             # ["smartbed", "<device_id>", "readings"]
        if len(parts) != 3:
            return
        device_id = parts[1]
        try:
            data = ReadingIn.model_validate_json(msg.payload)
        except ValidationError as err:
            log.warning("Rejected reading from %s: %s", device_id, err.errors())
            return
        with SessionLocal() as db:
            reading = save_reading(db, device_id, data)
            if reading is None:
                log.warning("Reading from unknown device %r ignored", device_id)
                return
            _publish(client, device_id, commands_for_bed(db, reading.bed_id))
    except Exception:
        log.exception("Failed to handle MQTT message on %s", msg.topic)
