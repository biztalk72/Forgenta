"""Centralized configuration for Forgenta backend."""

import os


class Settings:
    """Application settings loaded from environment variables."""

    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen3:0.6b")
    embed_model: str = os.getenv("EMBED_MODEL", "nomic-embed-text")
    app_version: str = "0.1.0"
    app_title: str = "Forgenta API"
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]


settings = Settings()
