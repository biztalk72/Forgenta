"""Prompt refinement and comparison router."""

import logging
import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from backend.schemas import PromptRequest, PromptSaveRequest
from backend.services.guardrail import check_input, filter_output
from backend.services.llm import refine_prompt, refine_prompt_stream
from backend.services.vector import search_similar_prompts, add_prompt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/prompt", tags=["prompt"])


def _guardrail(text: str, request: Request):
    ip = request.client.host if request.client else "unknown"
    allowed, reason = check_input(text, None, ip)
    if not allowed:
        code = 429 if reason == "rate_limit" else 400
        detail = "Too many requests" if reason == "rate_limit" else "Request blocked by content policy"
        raise HTTPException(status_code=code, detail=detail)


@router.post("/refine")
async def refine(req: PromptRequest, request: Request):
    """Refine a user prompt."""
    _guardrail(req.text, request)
    try:
        refined = refine_prompt(req.text)
    except Exception as exc:
        logger.error("Prompt refinement failed: %s", exc)
        raise HTTPException(status_code=503, detail="LLM service unavailable")
    ip = request.client.host if request.client else "unknown"
    refined = filter_output(refined, None, ip)
    return {"original": req.text, "refined": refined}


@router.post("/refine/stream")
async def refine_stream(req: PromptRequest, request: Request):
    """Stream prompt refinement tokens."""
    _guardrail(req.text, request)

    async def generate():
        async for token in refine_prompt_stream(req.text):
            yield token

    return StreamingResponse(generate(), media_type="text/plain")


@router.post("/similar")
async def similar(req: PromptRequest, request: Request):
    """Find similar prompts."""
    _guardrail(req.text, request)
    results = search_similar_prompts(req.text, n_results=5)
    return {"query": req.text, "similar": results}


@router.post("/save")
async def save_prompt(req: PromptSaveRequest, request: Request):
    """Save a prompt to the vector store."""
    _guardrail(req.text, request)
    prompt_id = f"p-{uuid.uuid4().hex[:8]}"
    add_prompt(prompt_id, req.text, req.metadata)
    return {"id": prompt_id, "text": req.text}
