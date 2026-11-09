from contextlib import asynccontextmanager
from fastapi import FastAPI
from .database import Base, engine
from . import models

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine) # creates missing tables on startup
    yield

app = FastAPI(title="SmartBed",lifespan=lifespan)

@app.get("/api/health")
def health():
    return {"status": ok}

