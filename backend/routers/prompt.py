"""Prompt refinement and comparison router."""

import logging
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.schemas import PromptRequest, PromptSaveRequest
from backend.services.llm import refine_prompt, refine_prompt_stream
from backend.services.vector import search_similar_prompts, add_prompt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/prompt", tags=["prompt"])


@router.post("/refine")
async def refine(req: PromptRequest):
    """Refine a user prompt."""
    try:
        refined = refine_prompt(req.text)
    except Exception as exc:
        logger.error("Prompt refinement failed: %s", exc)
        raise HTTPException(status_code=503, detail="LLM service unavailable")
    return {"original": req.text, "refined": refined}


@router.post("/refine/stream")
async def refine_stream(req: PromptRequest):
    """Stream prompt refinement tokens."""
    async def generate():
        async for token in refine_prompt_stream(req.text):
            yield token

    return StreamingResponse(generate(), media_type="text/plain")


@router.post("/similar")
async def similar(req: PromptRequest):
    """Find similar prompts."""
    results = search_similar_prompts(req.text, n_results=5)
    return {"query": req.text, "similar": results}


@router.post("/save")
async def save_prompt(req: PromptSaveRequest):
    """Save a prompt to the vector store."""
    prompt_id = f"p-{uuid.uuid4().hex[:8]}"
    add_prompt(prompt_id, req.text, req.metadata)
    return {"id": prompt_id, "text": req.text}
