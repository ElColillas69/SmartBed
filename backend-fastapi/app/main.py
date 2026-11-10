# Partly generated with Claude (Anthropic, 2026): new routers registered and MQTT started in lifespan.
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import models  # noqa: F401  (importing registers the tables with Base)
from . import mqtt
from .database import Base, engine
from .routers import alarms as alarm_routes
from .routers import auth as auth_routes
from .routers import beds as bed_routes
from .routers import device as device_routes
from .routers import readings as reading_routes
from .routers import settings as settings_routes

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code before `yield` runs once at startup, code after it once at shutdown.
    # Docs: https://fastapi.tiangolo.com/advanced/events/
    Base.metadata.create_all(engine)   # creates missing tables (never alters existing ones)
    mqtt.start()
    yield
    mqtt.stop()


app = FastAPI(title="SmartBed", lifespan=lifespan)
app.include_router(auth_routes.router)
app.include_router(bed_routes.router)
app.include_router(reading_routes.router)
app.include_router(settings_routes.router)
app.include_router(alarm_routes.router)
app.include_router(device_routes.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
