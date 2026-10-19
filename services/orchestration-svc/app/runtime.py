# Workflow Runtime - spec steps 순차 실행 + blackboard 핸드오프 (PRD v3 §8). ModelRouter/providers 재사용.
import json
import time
from collections.abc import AsyncIterator

from . import integrations
from .config import Config
from .providers import stream
from .router import ModelRouter, RouteRequest


def _provider(model: str | None) -> str:
    if not model:
        return ""
    return model.split("/", 1)[0] if "/" in model else model


def _resolve_inputs(input_map: dict, context: dict) -> dict:
    out = {}
    for field, src in (input_map or {}).items():
        key = src.split(".", 1)[1] if isinstance(src, str) and src.startswith("context.") else src
        if isinstance(key, str) and key in context:
            out[field] = context[key]
    return out


async def run_workflow(
    cfg: Config, router: ModelRouter, ws: str, user: str,
    workflow_id: str, initial_input: str, routing: dict,
) -> AsyncIterator[tuple[str, dict]]:
    wf = await integrations.get_workflow(cfg, ws, user, workflow_id)
    if not wf:
        yield ("error", {"message": "workflow not found"})
        return
    spec = wf.get("spec") or {}
    steps = sorted(spec.get("steps", []), key=lambda s: s.get("seq", 0))
    if not steps:
        yield ("error", {"message": "workflow spec has no steps"})
        return

    run_id = await integrations.create_run(cfg, ws, user, workflow_id)
    yield ("meta", {"run_id": run_id, "workflow_id": workflow_id, "name": spec.get("name"), "steps": len(steps)})

    context: dict = {}
    if initial_input:
        context["input"] = initial_input
    chain = router.route(RouteRequest(**routing))
    final_output = ""

    for st in steps:
        seq = st.get("seq")
        kind = st.get("kind", "llm")
        name = st.get("name", f"step{seq}")
        agent_id = (st.get("ref") or {}).get("agent_id", "") or ""
        inp = _resolve_inputs(st.get("input_map") or {}, context)
        yield ("step_start", {"seq": seq, "kind": kind, "name": name})
        step_id = await integrations.create_step(cfg, ws, user, run_id, seq, kind, agent_id, inp)

        start = time.time()
        out = ""
        if kind == "llm":
            ctx_text = json.dumps(inp or context, ensure_ascii=False)[:4000]
            prompt = f"{name}.\n\nInputs:\n{ctx_text}\n\nPerform this step concisely. /no_think"
            comp, ot, ctk = (await integrations.compress(cfg, prompt)) if cfg.headroom_enabled else (prompt, 0, 0)
            messages = [{"role": "user", "content": comp}]
            served, ntok = None, 0
            for model in chain:
                try:
                    async for tok in stream(cfg, model, messages):
                        ntok += 1
                        out += tok
                        yield ("token", {"seq": seq, "text": tok})
                    served = model
                    break
                except Exception as e:  # noqa: BLE001 - 폴백 체인
                    yield ("fallback", {"seq": seq, "model": model, "reason": str(e)})
                    continue
            latency = int((time.time() - start) * 1000)
            await integrations.patch_step(cfg, ws, user, step_id or "", {
                "status": "succeeded" if served else "failed",
                "prompt_tokens": ctk, "completion_tokens": ntok, "latency_ms": latency,
            })
            await integrations.record_usage(cfg, ws, user, {
                "agent_id": agent_id, "provider": _provider(served), "model": served or "",
                "prompt_tokens": ctk, "completion_tokens": ntok,
                "original_tokens": ot, "compressed_tokens": ctk,
                "latency_ms": latency, "success": served is not None,
            })
        else:
            # tool/approval/export — Phase 13에서는 스텁(컨텍스트 통과). 실제 실행은 Phase 14(approval)/15(connectors).
            out = f"[{kind} step '{name}' executed (stub)]"
            await integrations.patch_step(cfg, ws, user, step_id or "", {"status": "succeeded"})

        okey = st.get("output_key") or f"step{seq}"
        context[okey] = out
        final_output = out
        yield ("handoff", {"from": seq, "to": st.get("handoff_to"), "output_key": okey})
        yield ("step_done", {"seq": seq, "status": "succeeded", "output_key": okey})

    await integrations.patch_run(cfg, ws, user, run_id or "", {
        "status": "succeeded", "summary": final_output[:500], "context": context, "finished": True,
    })
    yield ("done", {"run_id": run_id, "status": "succeeded", "steps": len(steps)})
