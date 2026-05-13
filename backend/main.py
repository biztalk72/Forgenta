"""Forgenta: Hybrid Agentic AI - App Platform - Backend."""

import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.routers import chat, prompt, catalog, auth, guardrail
from backend.services.data_seed import load_seed_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🔄 Loading seed data into ChromaDB...")
    count = load_seed_data()
    logger.info("✅ Loaded %d documents into vector store.", count)
    yield


app = FastAPI(
    title=settings.app_title,
    description="Hybrid Agentic AI - App Platform",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(guardrail.router)
app.include_router(chat.router)
app.include_router(prompt.router)
app.include_router(catalog.router)


@app.get("/api/health")
async def health():
    uptime = time.time() - START_TIME
    return {
        "status": "ok",
        "product": "Forgenta",
        "version": settings.app_version,
        "uptime_seconds": round(uptime, 2),
    }
