# SmartBed — Flask Starter Backend

Prototype API aligned with SmartBed's pitch-deck hardware: **Raspberry Pi Zero W, FSR402, DHT22, LDR, MCP3008, buzzer and heating-simulation LED**. Intended data path: **Pi → PubNub → Flask → PostgreSQL → web dashboard**.

## 1. Install and run (Windows PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python run.py
```

macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp .env.example .env && python run.py`.

The starter defaults to SQLite for zero-setup testing. For PostgreSQL, create a database and user, then change `DATABASE_URL` in `.env` to the provided PostgreSQL example with your real credentials. Tables are created automatically on the first start.

## 2. Test API (PowerShell)

```powershell
$headers = @{ 'X-API-Key'='change-this-long-random-secret' }
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5000/api/readings -Method Post -Headers $headers -ContentType 'application/json' -Body '{"occupied":true,"temperature_c":19.5,"humidity_percent":55,"light_level":420}'
Invoke-RestMethod http://localhost:5000/api/readings/latest -Headers $headers
Invoke-RestMethod http://localhost:5000/api/preferences -Headers $headers
Invoke-RestMethod http://localhost:5000/api/alarms -Method Post -Headers $headers -ContentType 'application/json' -Body '{"time":"07:30","label":"Wake up","snooze_minutes":5}'
Invoke-RestMethod http://localhost:5000/api/device/commands -Headers $headers
```

## 3. API endpoints

| Method | Route | Function |
|---|---|---|
| GET | `/api/health` | API health check (public) |
| POST | `/api/readings` | Ingest new sensor data (can be used as simulator or secure integration endpoint) |
| GET | `/api/readings/latest` | Latest reading |
| GET | `/api/readings?limit=50` | Reading history |
| GET | `/api/readings?minutes=480&limit=500` | Readings from the last N minutes, thinned evenly to at most `limit` (newest always kept) |
| GET | `/api/preferences` | Current settings |
| PATCH | `/api/preferences` | Update heating enabled, target temperature, light warning threshold |
| GET | `/api/alarms` | List alarms |
| POST | `/api/alarms` | Create alarm |
| PATCH | `/api/alarms/<id>` | Update alarm |
| DELETE | `/api/alarms/<id>` | Delete alarm |
| POST | `/api/alarms/<id>/snooze` | Snooze alarm |
| POST | `/api/alarms/<id>/dismiss` | Dismiss alarm for current local day |
| GET | `/api/device/commands` | Pi polls for heating LED, light warning and buzzer commands |
| GET | `/api/sleep/nights?days=7` | One summary per night (noon to noon, local time): bedtime, wake, minutes in bed, bed exits, average temperature |

All endpoints except `/api/health` require the `X-API-Key` header. Sensor fields are `occupied` (boolean), `temperature_c` (number), `humidity_percent` (number) and `light_level` (integer 0–1023). For example, an FSR402 raw reading must first be converted by the Pi into occupancy using a calibrated threshold.

Heating simulation is ON if heating is enabled, the bed is occupied and measured room temperature is below the user's target temperature. A high LDR raw reading triggers `light_warning` above the configured threshold; reverse the comparison if your divider circuit produces higher ADC values in darkness. These are demonstration rules, not real heating safety logic.

## 4. PubNub integration contract

The Flask ingest endpoint is the **HTTP-facing bridge contract**, not a completed PubNub subscription. Raspberry Pi firmware should publish JSON with the four sensor fields on a PubNub channel (e.g., `smartbed.readings`). The PubNub integration worker, to be added once publish/subscribe keys and channel are agreed, should validate/forward received messages to `POST /api/readings` with its backend API key. Do not publish the backend API key in PubNub messages or client JavaScript. Until then, POST sample readings directly to simulate the hardware.

The physical Pi should periodically GET `/api/device/commands` and control the buzzer/LED on its own GPIO pins. For reliable scheduled alarms, leave the Pi polling continuously. A due alarm keeps the buzzer requested until it is dismissed or snoozed, or for 30 minutes if nobody answers, so a Pi that polls less than once a minute still hears it. Daylight saving follows `BED_TIMEZONE`, and real deployments must handle connectivity and clock issues. Do not rely on this prototype for critical care or safety.

## 5. Demo data and Pi simulator

```bash
<<<<<<< HEAD
python seed_demo.py      # a week of realistic nights, written straight to the database
python simulate.py       # posts a reading every 5 s like the Pi; press Enter to toggle in/out of bed
=======
python seed_demo.py
python simulate.py
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
```

The React dashboard in `../frontend` reads all of this; see its README.

## 6. Testing

```bash
pytest -q
```

## 7. Important production TODOs

- Implement the PubNub subscriber/bridge and reconnect/replay handling.
- Add **real user accounts, caregiver roles, authorisation and audit logs**. A shared API key alone must not be exposed in a public frontend.
- Add alarm duration/timeout, scheduling edge cases, notification state and hardware acknowledgements.
- Avoid exposing Flask development server to the public Internet; use HTTPS and an appropriate production server/proxy.
- Protect health-adjacent occupancy data through consent, minimal retention and secure access.
- Use migrations (Alembic/Flask-Migrate), retention limits and robust error monitoring.
