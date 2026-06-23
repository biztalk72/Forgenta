# Workflow Runtime (Phase 13) — workflow.spec(PRD v3 §6.A) 단계 순차 실행.
#   - llm  : providers.stream 으로 토큰 스트리밍, output_key 로 blackboard 적재
#   - tool : 현재 no-op (Phase 15 connector 까지). input 을 그대로 패스
#   - export   : no-op stub (Phase 15)
#   - approval : awaiting_approval emit 후 정지 (Phase 14 에서 resume 처리)
#
# workflow-svc 의 내부 write API 와 governance UsageEvent 를 모두 best-effort 로 호출 —
# 서비스 간 호출 실패가 워크플로우 실행을 막지 않는다 (CLAUDE.md §8).
import json
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

import httpx

from .config import Config
from .providers import stream


KINDS_KNOWN = {"llm", "tool", "approval", "export"}


@dataclass
class Step:
    seq: int
    kind: str
    name: str
    ref: dict = field(default_factory=dict)
    input_map: dict = field(default_factory=dict)
    output_key: str = ""
    requires_approval: bool = False
    on_error: str = "halt"
    handoff_to: int | None = None


def _parse_steps(spec: dict) -> list[Step]:
    out: list[Step] = []
    for raw in spec.get("steps", []):
        out.append(Step(
            seq=int(raw.get("seq", 0)),
            kind=str(raw.get("kind", "")),
            name=str(raw.get("name", "")),
            ref=dict(raw.get("ref") or {}),
            input_map=dict(raw.get("input_map") or {}),
            output_key=str(raw.get("output_key", "")),
            requires_approval=bool(raw.get("requires_approval", False)),
            on_error=str(raw.get("on_error", "halt")),
            handoff_to=raw.get("handoff_to"),
        ))
    out.sort(key=lambda s: s.seq)
    return out


def _resolve_input_map(step: Step, blackboard: dict) -> dict:
    """input_map 의 "context.<key>" 참조를 blackboard 에서 끌어와 dict 로 반환.
    참조 미존재 시 빈 문자열 — runtime 은 partial input 으로 진행한다 (halt 정책은 상위에서 결정)."""
    resolved: dict[str, str] = {}
    for param, ref in step.input_map.items():
        if isinstance(ref, str) and ref.startswith("context."):
            key = ref[len("context."):]
            val = blackboard.get(key, "")
            resolved[param] = str(val) if val is not None else ""
        else:
            resolved[param] = str(ref)
    return resolved


def _build_llm_messages(step: Step, inputs: dict) -> list[dict]:
    """LLM 단계의 user prompt 빌드: 'Step: <name>' + Inputs 블록.
    spec 이 자체 프롬프트 필드를 정의하지 않으므로 (compiler 가 step.name 으로 의도를 캐리) name 을 instruction 으로 사용."""
    lines = [f"Step: {step.name}".strip() or "Step: (unnamed)"]
    if inputs:
        lines.append("\nInputs:")
        for k, v in inputs.items():
            # 너무 길면 잘라 LLM context 보호 (headroom 압축은 chat_stream 경로에서만 적용 — 여기는 단순 truncate)
            v_short = v if len(v) <= 2000 else v[:2000] + "…[truncated]"
            lines.append(f"- {k}: {v_short}")
    lines.append("\n/no_think")
    return [{"role": "user", "content": "\n".join(lines)}]


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _post(client: httpx.AsyncClient, url: str, json_body: dict, headers: dict) -> dict | None:
    """workflow-svc write — 실패 시 None (호출자는 best-effort 계속)."""
    try:
        r = await client.post(url, json=json_body, headers=headers, timeout=5.0)
        if r.status_code in (200, 201):
            try:
                return r.json()
            except ValueError:
                return None
    except httpx.HTTPError:
        return None
    return None


async def _patch(client: httpx.AsyncClient, url: str, json_body: dict, headers: dict) -> bool:
    try:
        r = await client.patch(url, json=json_body, headers=headers, timeout=5.0)
        return r.status_code in (200, 204)
    except httpx.HTTPError:
        return False


async def fetch_spec(cfg: Config, workflow_id: str, ws: str, user: str) -> dict | None:
    """workflow-svc 에서 workflow 의 spec 을 조회. 워크스페이스 컨텍스트 헤더 필수."""
    headers = {"X-Workspace-Id": ws, "X-User-Id": user}
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{cfg.workflow_url}/v1/workflows/{workflow_id}", headers=headers)
            if r.status_code != 200:
                return None
            wf = r.json()
            spec = wf.get("spec")
            # workflow.spec 은 jsonb — 워크플로우-svc 가 json.RawMessage 로 그대로 반환하므로 dict.
            if isinstance(spec, dict):
                return spec
            if isinstance(spec, str):
                try:
                    return json.loads(spec)
                except ValueError:
                    return None
    except httpx.HTTPError:
        return None
    return None


async def run_workflow(
    cfg: Config,
    *,
    workflow_id: str,
    spec: dict,
    ws: str,
    user: str,
    routing: dict,
    chain: list[str],
    initial_context: dict | None,
    record_usage_fn,
    log_fn,
) -> AsyncIterator[str]:
    """워크플로우 단계를 순차 실행 — SSE 이벤트 스트림.
    이벤트 시퀀스:
      run.started → (step.started → token* → step.done)+ → run.done
    approval 단계를 만나면 awaiting_approval emit 후 중단 (Phase 14 에서 resume)."""
    steps = _parse_steps(spec)
    if not steps:
        yield _sse("error", {"reason": "spec has no steps"})
        return

    headers = {"X-Workspace-Id": ws, "X-User-Id": user}
    blackboard: dict[str, str] = dict(initial_context or {})

    async with httpx.AsyncClient(timeout=5.0) as wfclient:
        # 1) workflow_run 생성
        run = await _post(wfclient, f"{cfg.workflow_url}/v1/runs",
                          {"workflow_id": workflow_id, "trigger": "manual"}, headers)
        run_id = (run or {}).get("id", "")
        yield _sse("run.started", {"run_id": run_id, "steps": len(steps), "chain": chain})

        sensitive = bool(routing.get("sensitive", False))
        terminated_reason: str | None = None

        for step in steps:
            # Phase 14 전: approval 단계는 awaiting_approval emit 후 중단.
            if step.kind == "approval" or step.requires_approval:
                yield _sse("awaiting_approval", {"seq": step.seq, "name": step.name,
                                                 "kind": step.kind, "run_id": run_id})
                # workflow_step_run 을 running 으로 남기지 않고 단순히 emit — Phase 14 가 row 작성/resume 책임.
                terminated_reason = "awaiting_approval"
                break

            if step.kind not in KINDS_KNOWN:
                yield _sse("step.skipped", {"seq": step.seq, "name": step.name,
                                            "reason": f"unknown kind {step.kind}"})
                continue

            inputs = _resolve_input_map(step, blackboard)
            # step_run 생성 (running)
            sr = await _post(wfclient, f"{cfg.workflow_url}/v1/runs/{run_id}/steps",
                             {"step_seq": step.seq, "kind": step.kind,
                              "status": "running", "input": inputs}, headers)
            step_id = (sr or {}).get("id", "")
            yield _sse("step.started", {"seq": step.seq, "kind": step.kind,
                                        "name": step.name, "step_id": step_id})

            t0 = time.time()
            ftt: float | None = None
            output_text = ""
            served: str | None = None
            err: str | None = None

            if step.kind == "llm":
                messages = _build_llm_messages(step, inputs)
                for model in chain:
                    try:
                        async for tok in stream(cfg, model, messages, sensitive=sensitive):
                            if ftt is None:
                                ftt = time.time()
                            output_text += tok
                            yield _sse("token", {"seq": step.seq, "text": tok})
                        served = model
                        break
                    except Exception as e:  # noqa: BLE001 - 폴백 체인
                        yield _sse("fallback", {"seq": step.seq, "model": model, "reason": str(e)})
                        continue
                if served is None:
                    err = "all models failed"

            elif step.kind == "tool":
                # MVP: tool 은 inputs 를 그대로 output 으로 패스 (실제 도구 호출은 Phase 15 connector).
                output_text = json.dumps(inputs, ensure_ascii=False)
                served = "tool"

            elif step.kind == "export":
                # Phase 15 connector 까지 export 는 no-op stub — connector_id 만 기록.
                connector = (step.ref or {}).get("connector_id", "")
                output_text = json.dumps({"export": "stub", "connector_id": connector})
                served = "export-stub"

            latency_ms = int((time.time() - t0) * 1000)
            ttft_ms = int((ftt - t0) * 1000) if ftt else None

            # blackboard 적재 — output_key 가 없으면 step 이름 슬러그 사용.
            key = step.output_key or f"step_{step.seq}"
            blackboard[key] = output_text

            # step_run 마무리 — workflow_step_run.status CHECK 는 succeeded/failed/skipped/...
            patch_body = {
                "status": "succeeded" if err is None else "failed",
                "error": err or "",
                "prompt_tokens": sum(len(v) // 4 for v in inputs.values()),
                "completion_tokens": max(1, len(output_text) // 4) if output_text else 0,
                "latency_ms": latency_ms,
            }
            if step_id:
                await _patch(wfclient, f"{cfg.workflow_url}/v1/steps/{step_id}", patch_body, headers)

            # governance usage — best-effort (현재 사이드카는 모델 단위 측정. step 단위는 v3 후속에서 강화)
            try:
                await record_usage_fn(cfg, ws, user, {
                    "provider": (served.split("/", 1)[0] if served and "/" in served else (served or "")),
                    "backend": (served.split("/", 1)[0] if served and "/" in served else (served or "")),
                    "model": served or "",
                    "prompt_tokens": patch_body["prompt_tokens"],
                    "completion_tokens": patch_body["completion_tokens"],
                    "original_tokens": 0,
                    "compressed_tokens": 0,
                    "latency_ms": latency_ms,
                    "ttft_ms": ttft_ms,
                    "success": err is None,
                })
            except Exception:  # noqa: BLE001 - 계량 실패가 실행을 막지 않는다
                pass

            log_fn("workflow_step_complete", run_id=run_id, step_seq=step.seq,
                   kind=step.kind, success=err is None,
                   latency_ms=latency_ms, ttft_ms=ttft_ms,
                   completion_tokens=patch_body["completion_tokens"])

            yield _sse("step.done", {"seq": step.seq, "output_key": key,
                                     "status": patch_body["status"], "error": err,
                                     "latency_ms": latency_ms, "ttft_ms": ttft_ms,
                                     "completion_tokens": patch_body["completion_tokens"]})

            if err and step.on_error == "halt":
                terminated_reason = f"step {step.seq} failed: {err}"
                break

        # 3) workflow_run finalize — workflow_run.status CHECK 는 succeeded/failed/cancelled/...
        final_status = "awaiting_approval" if terminated_reason == "awaiting_approval" \
            else ("failed" if terminated_reason else "succeeded")
        finished = final_status != "awaiting_approval"
        await _patch(wfclient, f"{cfg.workflow_url}/v1/runs/{run_id}",
                     {"status": final_status,
                      "context": blackboard,
                      "finished": finished}, headers)

        yield _sse("run.done", {"run_id": run_id, "status": final_status,
                                "reason": terminated_reason, "context_keys": sorted(blackboard.keys())})
