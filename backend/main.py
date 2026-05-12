"""Forgenta: Hybrid Agentic AI - App Platform - Backend."""

import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import chat, prompt, catalog
from backend.services.data_seed import load_seed_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load seed data into ChromaDB
    logger.info("🔄 Loading seed data into ChromaDB...")
    count = load_seed_data()
    logger.info(f"✅ Loaded {count} documents into vector store.")
    yield


app = FastAPI(
    title="Forgenta API",
    description="Hybrid Agentic AI - App Platform",
    version="0.1.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(prompt.router)
app.include_router(catalog.router)


@app.get("/api/health")
async def health():
    uptime = time.time() - START_TIME
    return {
        "status": "ok",
        "product": "Forgenta",
        "version": "0.1.0",
        "uptime_seconds": round(uptime, 2),
    }
