# 환경변수 기반 Orchestration-Svc 설정 (CLAUDE.md §5, PRD v3.4 §3.5)
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    port: str
    # 추론 게이트웨이 (PRD v3.4 §2.3 [8]). 빈 문자열이면 ig 미사용 (Mac 베이스라인 호환).
    inference_gateway_url: str
    # Ollama 직접 접근 — ig 미가용 시 폴백 또는 ig가 라우팅하는 백엔드.
    ollama_host: str
    # 모델 기본값 (PRD v3.4 §3.5)
    planner_model: str
    executor_model: str
    summarizer_model: str
    router_model: str
    embed_model: str
    critic_model: str
    # 외부 LLM 키
    anthropic_key: str
    google_key: str
    openai_key: str
    # 사이드카
    headroom_url: str
    governance_url: str
    headroom_enabled: bool


def load() -> Config:
    return Config(
        port=os.getenv("ORCHESTRATION_SVC_PORT", "8002"),
        inference_gateway_url=os.getenv("INFERENCE_GATEWAY_URL", ""),
        ollama_host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
        planner_model=os.getenv("DEFAULT_PLANNER_MODEL", "vllm/qwen3-72b-instruct-nvfp4"),
        executor_model=os.getenv("DEFAULT_EXECUTOR_MODEL", "vllm/qwen3-coder-32b-fp8"),
        summarizer_model=os.getenv("DEFAULT_SUMMARIZER_MODEL", "vllm/qwen3-8b-fp8"),
        router_model=os.getenv("DEFAULT_ROUTER_MODEL", "vllm/qwen3-1.7b"),
        embed_model=os.getenv("DEFAULT_EMBED_MODEL", "vllm/bge-m3"),
        critic_model=os.getenv("DEFAULT_CRITIC_MODEL", "claude-3-7-sonnet"),
        anthropic_key=os.getenv("ANTHROPIC_API_KEY", ""),
        google_key=os.getenv("GOOGLE_API_KEY", ""),
        openai_key=os.getenv("OPENAI_API_KEY", ""),
        headroom_url=os.getenv("HEADROOM_PROXY_URL", "http://localhost:8787"),
        governance_url=os.getenv("GOVERNANCE_URL", "http://localhost:8005"),
        headroom_enabled=os.getenv("HEADROOM_ENABLED", "true").lower() == "true",
    )
