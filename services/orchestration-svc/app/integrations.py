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


# ── Workflow-Svc 클라이언트 (런타임이 run/step 기록에 사용) ──

def _wf_headers(ws: str, user: str) -> dict:
    return {"X-Workspace-Id": ws, "X-User-Id": user, "Content-Type": "application/json"}


async def get_workflow(cfg: Config, ws: str, user: str, workflow_id: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{cfg.workflow_url}/v1/workflows/{workflow_id}", headers=_wf_headers(ws, user))
            if r.status_code == 200:
                return r.json()
    except httpx.HTTPError:
        pass
    return None


async def create_run(cfg: Config, ws: str, user: str, workflow_id: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.post(f"{cfg.workflow_url}/v1/runs", headers=_wf_headers(ws, user),
                             json={"workflow_id": workflow_id, "trigger": "manual"})
            if r.status_code in (200, 201):
                return r.json().get("id")
    except httpx.HTTPError:
        pass
    return None


async def create_step(cfg: Config, ws: str, user: str, run_id: str, seq: int, kind: str, agent_id: str, inp: dict) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.post(f"{cfg.workflow_url}/v1/runs/{run_id}/steps", headers=_wf_headers(ws, user),
                             json={"step_seq": seq, "kind": kind, "agent_id": agent_id, "status": "running", "input": inp})
            if r.status_code in (200, 201):
                return r.json().get("id")
    except httpx.HTTPError:
        pass
    return None


async def patch_step(cfg: Config, ws: str, user: str, step_id: str, fields: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            await c.request("PATCH", f"{cfg.workflow_url}/v1/steps/{step_id}", headers=_wf_headers(ws, user), json=fields)
    except httpx.HTTPError:
        pass


async def patch_run(cfg: Config, ws: str, user: str, run_id: str, fields: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            await c.request("PATCH", f"{cfg.workflow_url}/v1/runs/{run_id}", headers=_wf_headers(ws, user), json=fields)
    except httpx.HTTPError:
        pass
