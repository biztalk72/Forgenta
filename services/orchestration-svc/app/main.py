# Orchestration-Svc 진입점 - FastAPI. 스트리밍 채팅(SSE) + LangGraph 실행(/v1/run) + 헬스.
import json
import sys
import time
from collections.abc import AsyncIterator

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from . import config, integrations, compiler
from .graph import build_graph
from .providers import stream
from .router import ModelRouter, RouteRequest


def _provider(model: str | None) -> str:
    if not model:
        return ""
    return model.split("/", 1)[0] if "/" in model else model

VERSION = "0.1.0"
cfg = config.load()
model_router = ModelRouter(executor=cfg.executor_model)
graph = build_graph(cfg, model_router)
app = FastAPI(title="orchestration-svc")


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
    try:
        async with httpx.AsyncClient(timeout=3.0) as c:
            r = await c.get(f"{cfg.ollama_host}/api/version")
            ok = r.status_code == 200
    except httpx.HTTPError:
        ok = False
    status = "ok" if ok else "unhealthy"
    code = 200 if ok else 503
    return JSONResponse(
        status_code=code,
        content={"status": status, "service": "orchestration-svc", "version": VERSION,
                 "checks": {"ollama": "ok" if ok else "unhealthy"}},
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
        served, ntok = None, 0
        for model in chain:
            try:
                async for tok in stream(cfg, model, messages):
                    ntok += 1
                    yield _sse("token", {"text": tok})
                served = model
                break
            except Exception as e:  # noqa: BLE001 - 폴백 체인
                yield _sse("fallback", {"model": model, "reason": str(e)})
                continue
        latency_ms = int((time.time() - start) * 1000)
        log("llm_call_complete", model=served, provider=_provider(served),
            agent_id=req.agent_id, prompt_tokens=prompt_tok, completion_tokens=ntok,
            original_tokens=orig_tok, compressed_tokens=comp_tok,
            latency_ms=latency_ms, success=served is not None)
        await integrations.record_usage(cfg, ws, user, {
            "agent_id": req.agent_id,
            "provider": _provider(served), "model": served or "",
            "prompt_tokens": prompt_tok, "completion_tokens": ntok,
            "original_tokens": orig_tok, "compressed_tokens": comp_tok,
            "latency_ms": latency_ms, "success": served is not None,
        })
        yield _sse("done", {"model": served, "completion_tokens": ntok,
                            "latency_ms": latency_ms, "success": served is not None})

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
