# 환경변수 기반 Orchestration-Svc 설정 (CLAUDE.md §5)
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    port: str
    ollama_host: str
    executor_model: str
    router_model: str
    summarizer_model: str
    anthropic_key: str
    google_key: str
    openai_key: str


def load() -> Config:
    return Config(
        port=os.getenv("ORCHESTRATION_SVC_PORT", "8002"),
        ollama_host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
        executor_model=os.getenv("DEFAULT_EXECUTOR_MODEL", "ollama/qwen3:8b"),
        router_model=os.getenv("DEFAULT_ROUTER_MODEL", "ollama/qwen3:1.7b"),
        summarizer_model=os.getenv("DEFAULT_SUMMARIZER_MODEL", "ollama/qwen3:1.7b"),
        anthropic_key=os.getenv("ANTHROPIC_API_KEY", ""),
        google_key=os.getenv("GOOGLE_API_KEY", ""),
        openai_key=os.getenv("OPENAI_API_KEY", ""),
    )
