# LLM Provider 추상화 (PRD v3.4 §3, §5.3)
# 라우팅 우선순위:
#   1) INFERENCE_GATEWAY_URL 설정 + 모델이 "vllm/*" 또는 "ollama/*" → inference-gateway 호출
#      (OpenAI 호환 SSE, fallback 체인은 ig 가 책임)
#   2) "ollama/*" + ig 미설정                                       → Ollama 직접 호출
#   3) "claude*"/"gpt*"/"gemini*"                                   → 키 없으면 Unavailable
import json
from collections.abc import AsyncIterator

import httpx

from .config import Config


class Unavailable(Exception):
    """해당 모델/프로바이더를 사용할 수 없음 (폴백 체인의 다음 후보로 진행)."""


def resolve(model: str) -> tuple[str, str]:
    """모델 문자열을 (provider, name)으로 분해한다."""
    if "/" in model:
        provider, _, name = model.partition("/")
        return provider, name
    if model.startswith("claude"):
        return "anthropic", model
    if model.startswith("gemini"):
        return "google", model
    if model.startswith("gpt"):
        return "openai", model
    return "ollama", model


def _ig_routable(provider: str) -> bool:
    """inference-gateway 가 라우팅하는 백엔드인지."""
    return provider in {"vllm", "nim", "trtllm", "ollama"}


async def _stream_ig(cfg: Config, model: str, messages: list[dict], sensitive: bool) -> AsyncIterator[str]:
    """inference-gateway 경유 OpenAI-호환 chat completions SSE."""
    # ig 에는 prefix 없는 모델명만 전달 (vllm/qwen3-72b-instruct-nvfp4 → qwen3-72b-instruct-nvfp4).
    _, served = resolve(model)
    url = f"{cfg.inference_gateway_url}/v1/chat/completions"
    payload = {
        "model": served,
        "messages": messages,
        "stream": True,
    }
    headers = {"Content-Type": "application/json"}
    if sensitive:
        headers["X-Forgenta-Sensitive"] = "true"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=5.0)) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                if resp.status_code != 200:
                    raise Unavailable(f"inference-gateway status {resp.status_code} for {served}")
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line.removeprefix("data:").strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        obj = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    # OpenAI 호환: choices[0].delta.content
                    choices = obj.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    chunk = delta.get("content", "")
                    if chunk:
                        yield chunk
    except httpx.HTTPError as e:
        raise Unavailable(f"inference-gateway transport error: {e}") from e


async def _stream_ollama_direct(cfg: Config, name: str, messages: list[dict]) -> AsyncIterator[str]:
    """Ollama native /api/chat — ig 미설정 시 폴백."""
    url = f"{cfg.ollama_host}/api/chat"
    payload = {"model": name, "messages": messages, "stream": True}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
            async with client.stream("POST", url, json=payload) as resp:
                if resp.status_code != 200:
                    raise Unavailable(f"ollama status {resp.status_code} for {name}")
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    obj = json.loads(line)
                    if "error" in obj:
                        raise Unavailable(f"ollama error for {name}: {obj['error']}")
                    chunk = obj.get("message", {}).get("content", "")
                    if chunk:
                        yield chunk
    except httpx.HTTPError as e:
        raise Unavailable(f"ollama transport error: {e}") from e


async def stream(
    cfg: Config,
    model: str,
    messages: list[dict],
    *,
    sensitive: bool = False,
) -> AsyncIterator[str]:
    """단일 모델로 토큰을 스트리밍한다. 사용 불가/오류 시 Unavailable 을 던진다.

    DGX 프로필 (INFERENCE_GATEWAY_URL 설정):
        vllm/* · nim/* · trtllm/* · ollama/*    → ig 경유
    Mac 베이스라인 (ig 미설정):
        ollama/*                                → ollama 직접
    공통:
        claude*/gpt*/gemini*                    → 키 없으면 Unavailable
    """
    provider, name = resolve(model)

    if _ig_routable(provider) and cfg.inference_gateway_url:
        async for tok in _stream_ig(cfg, model, messages, sensitive=sensitive):
            yield tok
        return

    if provider == "ollama":
        async for tok in _stream_ollama_direct(cfg, name, messages):
            yield tok
        return

    # 외부 (anthropic/google/openai) — 현재 미구성: Unavailable.
    # PRD v3.4 §3.5: Critic 만 외부 사용. 빌드 진행에 따라 별도 클라이언트 추가 예정.
    raise Unavailable(f"{provider} not configured")
