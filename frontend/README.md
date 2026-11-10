<<<<<<< HEAD
# smartBed — web dashboard

React (Vite) dashboard for caretakers and relatives watching over someone's bed: live occupancy, room climate, sleep history, heating and wake-up alarms. It talks to the Flask API in `../backend`.

## Run it

You need Node 20+ and the backend running.

```bash
# terminal 1 — backend
=======
# smartBed dashboard

React dashboard for caretakers and relatives keeping an eye on someone's bed: live occupancy, room climate, sleep history, heating and wake-up alarms. It connects to the Flask API by ../backend


```bash
# terminal running the backend
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
cd backend
python run.py
python seed_demo.py     # optional: a week of demo nights
python simulate.py      # optional: pretend to be the Pi (Enter toggles in/out of bed)

<<<<<<< HEAD
# terminal 2 — frontend
=======
# different terminal running the frontend
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
cd frontend
npm install
npm run dev             # http://localhost:5173
```
<<<<<<< HEAD

The dev server proxies `/api` to `http://127.0.0.1:5000` and adds the `X-API-Key` header itself, reading `API_KEY` from `backend/.env`. The key is never sent to the browser. To point somewhere else, copy `.env.example` to `.env.local`.

`npm test` runs the unit tests; `npm run build` produces `dist/`.

## Pages

| Page | What it shows | API |
|---|---|---|
| Now | In/out of bed with time since change, live alerts, temperature / humidity / light trends, 8-hour occupancy timeline, heater state and controls | `/readings`, `/device/commands`, `/preferences`, `/sleep/nights` |
| Nights | Last 7 nights against the sleep goal: time in bed, bedtime, wake, exits, bed temperature | `/sleep/nights` |
| Alarms | Create, toggle, delete; snooze or dismiss while ringing | `/alarms` |
| Settings | Heating, target temperature, light threshold (stored on the bed); grace period, night hours, sleep goal, climate limits (stored in this browser) | `/preferences` |

Alerts (bed empty past the grace period at night, too cold or warm, humid, light on, no data, alarm ringing) are worked out in the browser from the latest readings, in `src/lib/conditions.js`.

## Design

It is laid out like a night-shift care log rather than a card dashboard: ruled sections, plain sentences ("Maureen is in bed"), and every number and time set in a typewriter face. Night (dark, the default) is warm black; Day is paper and ink. There are no gradients, glows or rounded cards.

Atkinson Hyperlegible is the text face. It was designed for readers with low vision, which suits someone checking a phone at 3 a.m. IBM Plex Mono is used for readings, times and durations. Each colour means one thing: sage is in bed, amber is up or heating, red is "go and check". Everything else is ink.

## Not built yet (needs backend support)

- The care-staff ward view and per-resident pages from the wireframes. The current API serves a single bed; the revised schema in `../database` supports many.
- Logins, roles and the alert escalation / resolution log. Care preferences live in `localStorage` until there is a table for them.
- Boost heat. The API has no timed override.
- Production hosting. `npm run build` gives static files, but the API key must then be added by a reverse proxy or replaced by real user sessions, never put in the bundle.
=======
>>>>>>> 62ba779d97e8db9fee3900b13740929ffaf8da1e
