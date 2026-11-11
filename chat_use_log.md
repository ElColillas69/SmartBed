# Generative AI chat use log

_Declaration of Use for the SmartBed G-CA2 submission._

## Declaration

I used generative AI to help write the FastAPI rewrite of the SmartBed backend. That covers the backend itself, the MQTT link, the Raspberry Pi script, the frontend sign-in and the deployment files.

| |                                                                                                                                                       |
|---|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| **AI system** | Claude (model: Claude Opus 5.5) by Anthropic, used through claude.ai, <https://claude.ai>                                                             |
| **Dates** | 10 November 2026                                                                                                                                      |
| **Purpose** | Rewriting the backend from Flask to FastAPI, with accounts, linking the Pi to a bed, MQTT pub-sub, simulated beds, frontend login and cloud deployment |
| **How the output was used** | **From 10 Nov 19:52:** it wrote the generated code, which I reviewed. Every file it wrote or changed says so in its first line.            |

**How it was checked:** before handing the code over, Claude ran 9 automated backend tests and the frontend tests. It also ran the MQTT link end to end against a local broker. I reviewed every line change, committed it if it also appeared to be logically correct. Tests will be continuously done regardless of initial reviews to confirm ongoing integration. The deployment files and the Pi script have not yet been tested on a real cloud server or on the real Pi.

## Prompt log

All times are Irish time (GMT). The prompts are my exact words, except where a message was mostly pasted code.

| # | Date, time | My prompt                                                                                                                                                                                                                          | What Claude did                                                                                                             |
|---|---|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| 1 | 10 Nov, 19:52 | "Check against the documents you have received outlining the requirements of the assignment and our group's requirements for this project. Detail what is remaining, how to continue and then go ahead and complete a part of it." | **Wrote the code**: bed routes, MQTT bridge, simulator, Pi script, frontend sign-in, deployment files, 9 tests and a guide. |
| 2 | 10 Nov, 21:54 | "Create the declaration of use and an appendix"                                                                                                                                                                                    | Listed the requirements of DKIT's Declaration of Use. Drafted the declaration as a document.                                |
| 3 | 10 Nov, 22:07 | "Please make it as an .md"                                                                                                                                                                                                         | Turned the Claude artifact into an .md file which is this.                                                                  |

## Which files came from the AI

Each file says so in its first line.

| Area | Written by Claude | Partly written by Claude | Written by me                                                                                                                 |
|---|---|---|-------------------------------------------------------------------------------------------------------------------------------|
| `backend-fastapi/` | `app/mqtt.py`, `app/fake.py`, `app/routers/readings.py`, `settings.py`, `alarms.py`, `device.py`, `simulate.py`, `tests/`, `Dockerfile`, `.env.example` | `app/__init__.py`, `app/schemas.py`, `app/ingest.py`, `app/main.py`, `app/routers/beds.py`, `seed.py`, `requirements.txt` | `app/models.py`, `app/auth.py`, `app/database.py`, `app/routers/auth.py`, and `app/logic.py` (copied from the old team backend) |
| `frontend/` | `src/Gate.jsx`, `src/lib/Session.jsx`, `src/pages/Login.jsx`, `src/components/ClaimBed.jsx` | `src/lib/api.js`, `src/lib/BedData.jsx`, `src/lib/care.js`, `src/App.jsx`, `src/main.jsx`, `src/pages/Settings.jsx`, `src/pages/NoData.jsx`, `vite.config.js`, the sign-in block of `src/styles.css` | everything else was written by the team earlier                                                                               |
| `hardware/` | `main.py`, `actuators/leds.py`, `actuators/buzzer.py`, `.env.example` | `requirements.txt` | `sensors/dht22.py` (by the team)                                                                                              |
| `deploy/` | all files | |                                                                                                                               |
| `docs/` | `fastapi-guide.md`, this log | |                                                                                                                               |

## Reference (Cite Them Right Harvard)

**Reference list:** Anthropic (2026) *Claude Opus 5.5 response to Aleksy C*, 10 November.

**In text:** The MQTT bridge, simulated beds and deployment files were generated with Claude and then reviewed by the author (Anthropic, 2026).
