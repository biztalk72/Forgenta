"""Centralized configuration for Forgenta backend."""

import os


class Settings:
    """Application settings loaded from environment variables."""

    ollama_host: str = os.getenv("OLLAMA_HOST", "http://llm-dev.intuaos.com:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "ibm/granite4.1:8b")
    embed_model: str = os.getenv("EMBED_MODEL", "ibm/granite4.1:8b")
    app_version: str = "0.1.0"
    app_title: str = "Forgenta API"
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Auth
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production-use-a-long-random-secret")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    api_base_url: str = os.getenv("API_BASE_URL", "")

    # OAuth providers
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    github_client_id: str = os.getenv("GITHUB_CLIENT_ID", "")
    github_client_secret: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    kakao_client_id: str = os.getenv("KAKAO_CLIENT_ID", "")
    kakao_client_secret: str = os.getenv("KAKAO_CLIENT_SECRET", "")


settings = Settings()
