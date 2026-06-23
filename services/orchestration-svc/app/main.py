# Orchestration-Svc 진입점 - FastAPI. 스트리밍 채팅(SSE) + LangGraph 실행(/v1/run) + 헬스.
import json
import sys
import time
from collections.abc import AsyncIterator

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from . import config, integrations, compiler, runtime
from .graph import build_graph
from .providers import stream
from .router import ModelRouter, RouteRequest


def _provider(model: str | None) -> str:
    if not model:
        return ""
    return model.split("/", 1)[0] if "/" in model else model

VERSION = "0.1.0"
cfg = config.load()
model_router = ModelRouter(
    executor=cfg.executor_model,
    planner=cfg.planner_model,
    summarizer=cfg.summarizer_model,
    coder=cfg.executor_model,           # PRD v3.4 §3.5: coder=executor (qwen3-coder-32b)
    critic=cfg.critic_model,
)
graph = build_graph(cfg, model_router)
app = FastAPI(title="orchestration-svc")


def _backend(model: str | None) -> str:
    """모델 prefix 로 backend 분류 (usage_event/log 의 `backend` 필드)."""
    if not model:
        return ""
    if "/" not in model:
        # claude/gpt/gemini → external
        return "external"
    return model.split("/", 1)[0]       # vllm | ollama | nim | trtllm


def log(msg: str, **fields):
    rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "level": "info", "service": "orchestration-svc", "version": VERSION, "msg": msg}
    rec.update(fields)
    print(json.dumps(rec), file=sys.stdout, flush=True)


class ChatRequest(BaseModel):
    prompt: str = ""              # 단일 입력 (하위 호환)
    messages: list[dict] = []     # 멀티턴 대화 [{role, content}, ...]
    routing: dict = {}
    agent_id: str = ""            # 선택된 카탈로그 Agent (계량 귀속)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.get("/health")
def health():
    return {"status": "ok", "service": "orchestration-svc", "version": VERSION}


@app.get("/health/ready")
async def ready():
    """readiness — inference-gateway 가 설정되어 있으면 그쪽을 우선 체크, 없으면 ollama."""
    checks: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=3.0) as c:
        if cfg.inference_gateway_url:
            try:
                r = await c.get(f"{cfg.inference_gateway_url}/health/ready")
                checks["inference_gateway"] = "ok" if r.status_code == 200 else "unhealthy"
            except httpx.HTTPError:
                checks["inference_gateway"] = "unhealthy"
        try:
            r = await c.get(f"{cfg.ollama_host}/api/version")
            checks["ollama"] = "ok" if r.status_code == 200 else "unhealthy"
        except httpx.HTTPError:
            checks["ollama"] = "unhealthy"
    ok = any(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=200 if ok else 503,
        content={"status": "ok" if ok else "unhealthy",
                 "service": "orchestration-svc", "version": VERSION,
                 "checks": checks},
    )


@app.post("/v1/chat/stream")
async def chat_stream(req: ChatRequest, request: Request):
    ws = request.headers.get("X-Workspace-Id", "")
    user = request.headers.get("X-User-Id", "")
    # 멀티턴: messages 우선, 없으면 단일 prompt로 폴백
    messages = req.messages if req.messages else [{"role": "user", "content": req.prompt}]
    orig_tok, comp_tok = 0, 0
    # 최신 사용자 메시지만 압축 (대화 구조 유지)
    if cfg.headroom_enabled and messages and messages[-1].get("role") == "user":
        compressed, orig_tok, comp_tok = await integrations.compress(cfg, messages[-1].get("content", ""))
        messages = messages[:-1] + [{"role": "user", "content": compressed}]
    chain = model_router.route(RouteRequest(**req.routing))
    last_content = messages[-1].get("content", "") if messages else ""
    prompt_tok = comp_tok or (len(last_content) // 4 + 1)

    async def gen() -> AsyncIterator[str]:
        yield _sse("meta", {"chain": chain})
        start = time.time()
        first_token_at: float | None = None
        served, ntok = None, 0
        sensitive = bool(req.routing.get("sensitive", False))
        for model in chain:
            try:
                async for tok in stream(cfg, model, messages, sensitive=sensitive):
                    if first_token_at is None:
                        first_token_at = time.time()
                    ntok += 1
                    yield _sse("token", {"text": tok})
                served = model
                break
            except Exception as e:  # noqa: BLE001 - 폴백 체인
                yield _sse("fallback", {"model": model, "reason": str(e)})
                continue
        latency_ms = int((time.time() - start) * 1000)
        ttft_ms = int((first_token_at - start) * 1000) if first_token_at else None
        backend = _backend(served)
        log("llm_call_complete", model=served, provider=_provider(served), backend=backend,
            agent_id=req.agent_id, prompt_tokens=prompt_tok, completion_tokens=ntok,
            original_tokens=orig_tok, compressed_tokens=comp_tok,
            latency_ms=latency_ms, ttft_ms=ttft_ms, success=served is not None)
        await integrations.record_usage(cfg, ws, user, {
            "agent_id": req.agent_id,
            "provider": _provider(served), "backend": backend, "model": served or "",
            "prompt_tokens": prompt_tok, "completion_tokens": ntok,
            "original_tokens": orig_tok, "compressed_tokens": comp_tok,
            "latency_ms": latency_ms, "ttft_ms": ttft_ms,
            "success": served is not None,
        })
        yield _sse("done", {"model": served, "backend": backend,
                            "completion_tokens": ntok,
                            "latency_ms": latency_ms, "ttft_ms": ttft_ms,
                            "success": served is not None})

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.post("/v1/run")
async def run(req: ChatRequest):
    result = await graph.ainvoke({"prompt": req.prompt, "routing": req.routing})
    return {"model": result.get("model"), "output": result.get("output")}


class CompileRequest(BaseModel):
    description: str
    routing: dict = {}


@app.post("/v1/workflows/compile")
async def workflows_compile(req: CompileRequest):
    # NL 설명 → workflow.spec(§6.A). SSE: plan → step* → done(spec, valid)
    chain = model_router.route(RouteRequest(**req.routing))
    messages_desc = req.description

    async def gen() -> AsyncIterator[str]:
        yield _sse("plan", {"message": "compiling", "chain": chain})
        spec, err, fb = await compiler.compile_spec(cfg, messages_desc, chain)
        for st in spec.get("steps", []):
            yield _sse("step", {"seq": st.get("seq"), "kind": st.get("kind"), "name": st.get("name")})
        log("workflow_compile", steps=len(spec.get("steps", [])), valid=err is None, fallback=fb)
        yield _sse("done", {"spec": spec, "valid": err is None, "error": err, "fallback": fb})

    return StreamingResponse(gen(), media_type="text/event-stream")


class RunRequest(BaseModel):
    routing: dict = {}
    initial_context: dict = {}
    trigger: str = "manual"


@app.post("/v1/workflows/{workflow_id}/run")
async def workflow_run(workflow_id: str, req: RunRequest, request: Request):
    # workflow.spec(§6.A) 의 단계를 순차 실행 — SSE: run.started → step.* → run.done
    ws = request.headers.get("X-Workspace-Id", "")
    user = request.headers.get("X-User-Id", "")
    chain = model_router.route(RouteRequest(**req.routing))

    async def gen() -> AsyncIterator[str]:
        spec = await runtime.fetch_spec(cfg, workflow_id, ws, user)
        if spec is None:
            yield _sse("error", {"reason": "workflow not found or workflow-svc unavailable"})
            return
        async for ev in runtime.run_workflow(
            cfg,
            workflow_id=workflow_id, spec=spec,
            ws=ws, user=user,
            routing=req.routing, chain=chain,
            initial_context=req.initial_context,
            record_usage_fn=integrations.record_usage,
            log_fn=log,
        ):
            yield ev

    return StreamingResponse(gen(), media_type="text/event-stream")


class ResumeRequest(BaseModel):
    routing: dict = {}


@app.post("/v1/workflows/runs/{run_id}/resume")
async def workflow_resume(run_id: str, req: ResumeRequest, request: Request):
    # Phase 14: governance approval 결정(approved/rejected/pending) 을 읽고 awaiting run 을 재개/halt.
    # SSE: run.resumed → (approved: step.* → run.done) | (rejected: run.done(cancelled))
    ws = request.headers.get("X-Workspace-Id", "")
    user = request.headers.get("X-User-Id", "")
    chain = model_router.route(RouteRequest(**req.routing))

    async def gen() -> AsyncIterator[str]:
        async for ev in runtime.resume_workflow(
            cfg,
            run_id=run_id,
            ws=ws, user=user,
            routing=req.routing, chain=chain,
            record_usage_fn=integrations.record_usage,
            log_fn=log,
        ):
            yield ev

    return StreamingResponse(gen(), media_type="text/event-stream")
