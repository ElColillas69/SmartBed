from contextlib import asynccontextmanager
from fastapi import FastAPI
from .database import Base, engine
from . import models
from .routers import beds as bed_routes
from .routers import auth as auth_routes

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine) # creates missing tables on startup
    yield

app = FastAPI(title="SmartBed",lifespan=lifespan)
app.include_router(auth_routes.router)
app.include_router(bed_routes.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

