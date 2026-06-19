# 서비스 간 연동 (fault-tolerant) - Headroom 압축 + Governance UsageEvent 기록
import httpx

from .config import Config


async def compress(cfg: Config, prompt: str) -> tuple[str, int, int]:
    """Headroom으로 프롬프트를 압축한다. 실패 시 원본 그대로 반환(무압축 폴백)."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.post(f"{cfg.headroom_url}/v1/compress",
                             json={"kind": "text", "mode": "safe", "content": prompt})
            if r.status_code == 200:
                d = r.json()
                return d["compressed"], d["original_tokens"], d["compressed_tokens"]
    except (httpx.HTTPError, KeyError, ValueError):
        pass
    return prompt, 0, 0


async def record_usage(cfg: Config, ws: str, user: str, fields: dict) -> None:
    """Governance에 UsageEvent를 기록한다. 워크스페이스 없거나 실패 시 무시(파이프라인 비차단)."""
    if not ws:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            await c.post(f"{cfg.governance_url}/v1/usage",
                         headers={"X-Workspace-Id": ws, "X-User-Id": user},
                         json=fields)
    except httpx.HTTPError:
        pass
