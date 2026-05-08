"""Forgenta: Hybrid Agentic AI - App Platform - Backend."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import chat, prompt, catalog
from backend.services.data_seed import load_seed_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load seed data into ChromaDB
    print("🔄 Loading seed data into ChromaDB...")
    count = load_seed_data()
    print(f"✅ Loaded {count} documents into vector store.")
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
    return {"status": "ok", "product": "Forgenta"}
