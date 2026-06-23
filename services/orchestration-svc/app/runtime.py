# Workflow Runtime (Phase 13/14) — workflow.spec(PRD v3 §6.A) 단계 순차 실행.
#   - llm  : providers.stream 으로 토큰 스트리밍, output_key 로 blackboard 적재
#   - tool : 현재 no-op (Phase 15 connector 까지). input 을 그대로 패스
#   - export   : no-op stub (Phase 15)
#   - approval : governance approval row + workflow_step_run(awaiting_approval) 작성 후 정지.
#                resume_workflow() 가 결정(approved/rejected)을 읽어 다음 스텝부터 재개/halt.
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


async def fetch_run(cfg: Config, run_id: str, ws: str, user: str) -> dict | None:
    """workflow-svc 에서 workflow_run + step 타임라인 조회 (resume 경로용)."""
    headers = {"X-Workspace-Id": ws, "X-User-Id": user}
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{cfg.workflow_url}/v1/runs/{run_id}", headers=headers)
            if r.status_code != 200:
                return None
            return r.json()
    except httpx.HTTPError:
        return None
    return None


async def _create_approval(cfg: Config, ws: str, user: str, step_run_id: str) -> str:
    """governance 에 approval row 생성. resource_type='workflow_step_run', resource_id=step_run.id.
    실패 시 빈 문자열 — runtime 은 approval_id 없이도 awaiting 으로 정지 가능 (UI 가 step.id 로 직접 표시)."""
    headers = {"X-Workspace-Id": ws, "X-User-Id": user}
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.post(
                f"{cfg.governance_url}/v1/approvals",
                headers=headers,
                json={"resource_type": "workflow_step_run", "resource_id": step_run_id},
            )
            if r.status_code in (200, 201):
                try:
                    return str((r.json() or {}).get("id", ""))
                except ValueError:
                    return ""
    except httpx.HTTPError:
        return ""
    return ""


async def _fetch_approval(cfg: Config, ws: str, user: str, approval_id: str) -> dict | None:
    """governance 에서 단일 approval row 조회 — list 결과를 필터 (단건 GET 미존재).
    상태가 'pending' 인 approval 은 listApprovals(status=pending)에서 보이고,
    결정된 후에는 status 쿼리에 그대로 매칭됨."""
    if not approval_id:
        return None
    headers = {"X-Workspace-Id": ws, "X-User-Id": user}
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            for st in ("approved", "rejected", "pending"):
                r = await c.get(
                    f"{cfg.governance_url}/v1/approvals?status={st}",
                    headers=headers,
                )
                if r.status_code != 200:
                    continue
                for a in (r.json() or []):
                    if str(a.get("id", "")) == approval_id:
                        return a
    except httpx.HTTPError:
        return None
    return None


async def _execute_steps(
    wfclient: httpx.AsyncClient,
    cfg: Config,
    *,
    run_id: str,
    steps: list[Step],
    blackboard: dict,
    headers: dict,
    ws: str,
    user: str,
    routing: dict,
    chain: list[str],
    record_usage_fn,
    log_fn,
) -> AsyncIterator[tuple[str, tuple[str | None, int | None] | None]]:
    """단계 리스트를 순차 실행. 각 yield 는 (sse_string, sentinel) 튜플.
    sentinel 은 종료 직전 한 번만 (terminated_reason, awaiting_seq) 로 emit;
    그 외에는 None. 호출자는 sentinel != None 인 yield 에서 sse_string 을 무시한다.
    terminated_reason 값: None(완주) | 'awaiting_approval' | 'step N failed: ...'
    awaiting_seq: approval 로 정지한 step 의 seq (그 외 None)."""
    sensitive = bool(routing.get("sensitive", False))
    terminated_reason: str | None = None
    awaiting_seq: int | None = None

    for step in steps:
        # approval 단계: step_run(awaiting_approval) + governance approval row 작성 후 정지.
        if step.kind == "approval" or step.requires_approval:
            inputs = _resolve_input_map(step, blackboard)
            sr = await _post(wfclient, f"{cfg.workflow_url}/v1/runs/{run_id}/steps",
                             {"step_seq": step.seq,
                              "kind": "approval" if step.kind == "approval" else step.kind,
                              "status": "awaiting_approval", "input": inputs}, headers)
            step_id = (sr or {}).get("id", "")
            approval_id = await _create_approval(cfg, ws, user, step_id) if step_id else ""
            if step_id and approval_id:
                await _patch(wfclient, f"{cfg.workflow_url}/v1/steps/{step_id}",
                             {"status": "awaiting_approval", "approval_id": approval_id}, headers)
            log_fn("workflow_step_awaiting_approval", run_id=run_id, step_seq=step.seq,
                   step_id=step_id, approval_id=approval_id)
            yield _sse("awaiting_approval", {"seq": step.seq, "name": step.name,
                                             "kind": step.kind, "run_id": run_id,
                                             "step_id": step_id, "approval_id": approval_id}), None
            terminated_reason = "awaiting_approval"
            awaiting_seq = step.seq
            break

        if step.kind not in KINDS_KNOWN:
            yield _sse("step.skipped", {"seq": step.seq, "name": step.name,
                                        "reason": f"unknown kind {step.kind}"}), None
            continue

        inputs = _resolve_input_map(step, blackboard)
        sr = await _post(wfclient, f"{cfg.workflow_url}/v1/runs/{run_id}/steps",
                         {"step_seq": step.seq, "kind": step.kind,
                          "status": "running", "input": inputs}, headers)
        step_id = (sr or {}).get("id", "")
        yield _sse("step.started", {"seq": step.seq, "kind": step.kind,
                                    "name": step.name, "step_id": step_id}), None

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
                        yield _sse("token", {"seq": step.seq, "text": tok}), None
                    served = model
                    break
                except Exception as e:  # noqa: BLE001 - 폴백 체인
                    yield _sse("fallback", {"seq": step.seq, "model": model, "reason": str(e)}), None
                    continue
            if served is None:
                err = "all models failed"

        elif step.kind == "tool":
            output_text = json.dumps(inputs, ensure_ascii=False)
            served = "tool"

        elif step.kind == "export":
            connector = (step.ref or {}).get("connector_id", "")
            output_text = json.dumps({"export": "stub", "connector_id": connector})
            served = "export-stub"

        latency_ms = int((time.time() - t0) * 1000)
        ttft_ms = int((ftt - t0) * 1000) if ftt else None

        key = step.output_key or f"step_{step.seq}"
        blackboard[key] = output_text

        patch_body = {
            "status": "succeeded" if err is None else "failed",
            "error": err or "",
            "prompt_tokens": sum(len(v) // 4 for v in inputs.values()),
            "completion_tokens": max(1, len(output_text) // 4) if output_text else 0,
            "latency_ms": latency_ms,
        }
        if step_id:
            await _patch(wfclient, f"{cfg.workflow_url}/v1/steps/{step_id}", patch_body, headers)

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
                                 "completion_tokens": patch_body["completion_tokens"]}), None

        if err and step.on_error == "halt":
            terminated_reason = f"step {step.seq} failed: {err}"
            break

    # sentinel — 호출자는 마지막 yield 값으로 종료 사유(reason, awaiting_seq)를 받는다.
    yield "", (terminated_reason, awaiting_seq)


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
    approval 단계를 만나면 step_run/approval row 작성 + awaiting_approval emit 후 정지 — resume_workflow 가 재개."""
    steps = _parse_steps(spec)
    if not steps:
        yield _sse("error", {"reason": "spec has no steps"})
        return

    headers = {"X-Workspace-Id": ws, "X-User-Id": user}
    blackboard: dict[str, str] = dict(initial_context or {})

    async with httpx.AsyncClient(timeout=5.0) as wfclient:
        run = await _post(wfclient, f"{cfg.workflow_url}/v1/runs",
                          {"workflow_id": workflow_id, "trigger": "manual"}, headers)
        run_id = (run or {}).get("id", "")
        yield _sse("run.started", {"run_id": run_id, "steps": len(steps), "chain": chain})

        terminated_reason: str | None = None
        async for sse, sentinel in _execute_steps(
            wfclient, cfg, run_id=run_id, steps=steps, blackboard=blackboard,
            headers=headers, ws=ws, user=user, routing=routing, chain=chain,
            record_usage_fn=record_usage_fn, log_fn=log_fn,
        ):
            if sentinel is not None:
                terminated_reason = sentinel[0]
                continue
            yield sse

        final_status = "awaiting_approval" if terminated_reason == "awaiting_approval" \
            else ("failed" if terminated_reason else "succeeded")
        finished = final_status != "awaiting_approval"
        await _patch(wfclient, f"{cfg.workflow_url}/v1/runs/{run_id}",
                     {"status": final_status,
                      "context": blackboard,
                      "finished": finished}, headers)

        yield _sse("run.done", {"run_id": run_id, "status": final_status,
                                "reason": terminated_reason, "context_keys": sorted(blackboard.keys())})


async def resume_workflow(
    cfg: Config,
    *,
    run_id: str,
    ws: str,
    user: str,
    routing: dict,
    chain: list[str],
    record_usage_fn,
    log_fn,
) -> AsyncIterator[str]:
    """approve/reject 결정에 따라 awaiting_approval 상태인 run 을 재개.
    이벤트 시퀀스:
      run.resumed → (approved → step.* → run.done) | (rejected → run.done(cancelled))"""
    headers = {"X-Workspace-Id": ws, "X-User-Id": user}

    run = await fetch_run(cfg, run_id, ws, user)
    if run is None:
        yield _sse("error", {"reason": "run not found or workflow-svc unavailable"})
        return
    if run.get("status") != "awaiting_approval":
        yield _sse("error", {"reason": f"run is not awaiting_approval (status={run.get('status')})"})
        return

    workflow_id = run.get("workflow_id", "")
    spec = await fetch_spec(cfg, workflow_id, ws, user)
    if spec is None:
        yield _sse("error", {"reason": "workflow spec not found"})
        return

    # awaiting_approval 상태의 step 찾기 (최대 seq).
    awaiting_step = None
    for s in (run.get("steps") or []):
        if s.get("status") == "awaiting_approval":
            awaiting_step = s
    if not awaiting_step:
        yield _sse("error", {"reason": "no awaiting step found"})
        return

    approval_id = str(awaiting_step.get("approval_id", "") or "")
    step_id = str(awaiting_step.get("id", "") or "")
    step_seq = int(awaiting_step.get("step_seq", 0))

    approval = await _fetch_approval(cfg, ws, user, approval_id) if approval_id else None
    decision = (approval or {}).get("status", "pending")

    blackboard: dict[str, str] = {}
    ctx = run.get("context")
    if isinstance(ctx, dict):
        blackboard = {k: str(v) for k, v in ctx.items()}

    yield _sse("run.resumed", {"run_id": run_id, "awaiting_seq": step_seq,
                               "approval_id": approval_id, "decision": decision})

    async with httpx.AsyncClient(timeout=5.0) as wfclient:
        if decision == "pending":
            yield _sse("awaiting_approval", {"seq": step_seq, "run_id": run_id,
                                             "step_id": step_id, "approval_id": approval_id,
                                             "kind": awaiting_step.get("kind", "approval")})
            return

        if decision == "rejected":
            if step_id:
                await _patch(wfclient, f"{cfg.workflow_url}/v1/steps/{step_id}",
                             {"status": "failed", "error": "approval rejected"}, headers)
            await _patch(wfclient, f"{cfg.workflow_url}/v1/runs/{run_id}",
                         {"status": "cancelled", "context": blackboard, "finished": True}, headers)
            log_fn("workflow_resume_rejected", run_id=run_id, step_seq=step_seq, step_id=step_id)
            yield _sse("run.done", {"run_id": run_id, "status": "cancelled",
                                    "reason": "approval rejected",
                                    "context_keys": sorted(blackboard.keys())})
            return

        # approved — awaiting step 을 succeeded 로 닫고, 남은 단계 실행.
        if step_id:
            await _patch(wfclient, f"{cfg.workflow_url}/v1/steps/{step_id}",
                         {"status": "succeeded", "error": ""}, headers)
        await _patch(wfclient, f"{cfg.workflow_url}/v1/runs/{run_id}",
                     {"status": "running"}, headers)
        log_fn("workflow_resume_approved", run_id=run_id, step_seq=step_seq, step_id=step_id)

        # 남은 단계 = spec.steps 중 seq > step_seq 인 것들 (정렬은 _parse_steps 가 보장).
        remaining = [s for s in _parse_steps(spec) if s.seq > step_seq]

        terminated_reason: str | None = None
        async for sse, sentinel in _execute_steps(
            wfclient, cfg, run_id=run_id, steps=remaining, blackboard=blackboard,
            headers=headers, ws=ws, user=user, routing=routing, chain=chain,
            record_usage_fn=record_usage_fn, log_fn=log_fn,
        ):
            if sentinel is not None:
                terminated_reason = sentinel[0]
                continue
            yield sse

        final_status = "awaiting_approval" if terminated_reason == "awaiting_approval" \
            else ("failed" if terminated_reason else "succeeded")
        finished = final_status != "awaiting_approval"
        await _patch(wfclient, f"{cfg.workflow_url}/v1/runs/{run_id}",
                     {"status": final_status, "context": blackboard, "finished": finished}, headers)

        yield _sse("run.done", {"run_id": run_id, "status": final_status,
                                "reason": terminated_reason, "context_keys": sorted(blackboard.keys())})
