# Deploying SmartBed to a cloud VM

Generated with Claude (Anthropic, 2026). Not yet tried on a real VM; the pieces were
tested locally (Mosquitto with this `aclfile`, the API on PostgreSQL, the simulator).

What runs where:

| Container  | What it is                                   | Reachable from the internet |
|------------|----------------------------------------------|-----------------------------|
| caddy      | HTTPS for the web app and `/api/*`           | 80, 443                     |
| mqtt       | Mosquitto broker                             | 8883 (TLS only)             |
| api        | FastAPI + the MQTT subscriber                | no (only via Caddy)         |
| simulator  | fake Pis for Patrick's and Siobhan's beds    | no                          |
| db         | PostgreSQL                                   | no                          |

## 1. VM and domain

Any small Ubuntu VM (Azure, AWS, DigitalOcean...). Open ports 22, 80, 443 and 8883 in its
firewall. Point a domain or free subdomain (e.g. DuckDNS) at the VM's public IP.
Install Docker: https://docs.docker.com/engine/install/ubuntu/

## 2. Code and secrets

```bash
git clone <repo> && cd SmartBed
cp deploy/.env.example deploy/.env      # fill every value; JWT_SECRET from:
python3 -c "import secrets; print(secrets.token_hex(32))"
```

In `deploy/mosquitto/mosquitto.conf`, replace both `example.com` in the cert paths with
your DOMAIN.

## 3. MQTT passwords (one per account in `aclfile`)

```bash
cd deploy
docker run --rm -v "$PWD/mosquitto:/m" eclipse-mosquitto:2 sh -c '
  touch /m/passwords && chmod 0700 /m/passwords &&
  mosquitto_passwd -b /m/passwords smartbed-server    "<MQTT_SERVER_PASSWORD>" &&
  mosquitto_passwd -b /m/passwords smartbed-simulator "<MQTT_SIMULATOR_PASSWORD>" &&
  mosquitto_passwd -b /m/passwords pi-maureen         "<a password for the Pi>"'
```

The Pi uses `pi-maureen` / that password in `hardware/.env` (with `MQTT_TLS=true`,
`MQTT_PORT=8883`, `MQTT_HOST=<DOMAIN>`).

## 4. Frontend build

```bash
cd frontend && npm ci && npm run build     # makes frontend/dist, served by Caddy
```

## 5. Start

```bash
cd deploy
docker compose up -d --build
docker compose exec api python seed.py --no-history    # beds, devices, settings
docker compose logs -f api                              # expect "Connected to MQTT broker"
```

On the very first start Mosquitto may restart a few times until Caddy has fetched the
certificate; after that, `docker compose restart mqtt`. Then open `https://<DOMAIN>`,
create an account and claim a bed with its pairing code.

## Before showing it to anyone

- The seed's pairing codes (`MAUREEN1`...) are guessable. On a public server, change them
  in the database or in `seed.py` to random ones.
- Don't run `seed.py --demo-user` in the cloud (it makes a known password).
