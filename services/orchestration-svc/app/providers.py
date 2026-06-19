# LLM Provider 추상화 - Ollama(스트리밍) 구현 + 클라우드(미구성 시 Unavailable) 폴백
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


async def stream(cfg: Config, model: str, messages: list[dict]) -> AsyncIterator[str]:
    """단일 모델로 토큰을 스트리밍한다. 사용 불가/오류 시 Unavailable을 던진다."""
    provider, name = resolve(model)
    if provider != "ollama":
        # 클라우드 프로바이더는 Phase 4 범위 밖: 키가 없으면(=현재) Unavailable.
        raise Unavailable(f"{provider} not configured")

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
