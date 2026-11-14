# Deploying SmartBed to a cloud VM

Generated with Claude (Anthropic, 2026). The full stack below was run end to end with
Docker (Pi-style MQTT publish on 8883 with TLS -> API -> PostgreSQL -> HTTPS API, and commands
back to the Pi).

What runs where:

| Container  | What it is                                        | Reachable from the internet |
|------------|---------------------------------------------------|-----------------------------|
| caddy      | builds the React app; HTTPS for it and `/api/*`   | 80, 443                     |
| mqtt       | Mosquitto broker (TLS, login + per-device ACL)    | 8883 (1883 only inside Docker) |
| api        | FastAPI + the MQTT subscriber                     | no (only via Caddy)         |
| simulator  | fake Pis for Patrick's and Siobhan's beds         | no                          |
| db         | PostgreSQL                                        | no                          |

## 1. VM and domain

Any small Ubuntu VM (we use AWS EC2). Open ports 22, 80, 443 and 8883 in its security
group. Point the domain (`smartbed.ksander.online`, Cloudflare "DNS only") at the VM's
Elastic IP. Install Docker: https://docs.docker.com/engine/install/ubuntu/

Only Docker is needed on the VM: the frontend is built inside the caddy image.

## 2. Code and secrets

```bash
git clone https://github.com/ElColillas69/SmartBed.git && cd SmartBed
cp deploy/.env.example deploy/.env      # fill every value; JWT_SECRET from:
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## 3. MQTT passwords (one per account in `aclfile`)

```bash
cd deploy
docker run --rm -v "$PWD/mosquitto:/m" eclipse-mosquitto:2 sh -c '
  touch /m/passwords && chmod 0700 /m/passwords &&
  mosquitto_passwd -b /m/passwords smartbed-server    "<MQTT_SERVER_PASSWORD>" &&
  mosquitto_passwd -b /m/passwords smartbed-simulator "<MQTT_SIMULATOR_PASSWORD>" &&
  mosquitto_passwd -b /m/passwords pi-maureen         "<a password for the Pi>" &&
  chown 1883:1883 /m/passwords'
```

The first two passwords must match `deploy/.env`. The `chown` matters: Mosquitto runs as
user 1883 and won't start if it can't read the file. The Pi uses `pi-maureen` and its
password in `hardware/.env` (see `hardware/.env.example`).

## 4. Start

```bash
cd deploy
docker compose up -d --build
docker compose exec api python seed.py --no-history    # beds, devices, settings
docker compose ps                                       # all five "Up"
docker compose logs -f api                              # expect "Connected to MQTT broker"
```

Then open `https://<DOMAIN>`, create an account and claim a bed with its pairing code.

## Updating after a `git pull`

```bash
cd deploy && docker compose up -d --build
```

## Before showing it to anyone

- The seed's pairing codes (`MAUREEN1`...) are guessable. On a public server, change them
  in the database or in `seed.py` to random ones.
- Don't run `seed.py --demo-user` in the cloud (it makes a known password).
- MQTT from the internet is TLS on 8883, with Caddy's Let's Encrypt certificate
  (`mosquitto/start.sh` copies it in). Caddy renews it before it expires; run
  `docker compose restart mqtt` after a renewal so Mosquitto loads the new one.
  The API and simulator use plain 1883 on the private Docker network, which is not published.
