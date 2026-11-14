#!/bin/sh
# Generated with Claude (Anthropic, 2026).
# Starts Mosquitto with the Let's Encrypt certificate that Caddy already got for $DOMAIN,
# so the Pi can check the broker with the normal public CAs (no custom CA to copy around).
# Caddy keeps its certs in the caddy-data volume (mounted read-only at /caddy):
#   https://caddyserver.com/docs/conventions#data-directory
# They are copied into the container so the mosquitto user (uid 1883) can read the key.
# Caddy renews the cert about 30 days before it expires; "docker compose restart mqtt"
# picks up the new one.
set -e
until crt=$(find /caddy/caddy/certificates -name "$DOMAIN.crt" 2>/dev/null | head -n 1) && [ -n "$crt" ]; do
  echo "Waiting for Caddy to get a certificate for $DOMAIN..."
  sleep 5
done
dir=$(dirname "$crt")
mkdir -p /mosquitto/certs
cp "$dir/$DOMAIN.crt" /mosquitto/certs/server.crt
cp "$dir/$DOMAIN.key" /mosquitto/certs/server.key
chown -R mosquitto:mosquitto /mosquitto/certs
chmod 600 /mosquitto/certs/server.key
echo "Using certificate $crt"
exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
