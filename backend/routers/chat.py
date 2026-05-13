"""Chat router with streaming and RAG."""

import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from backend.dependencies import get_current_user
from backend.schemas import ChatRequest
from backend.services.guardrail import check_input, filter_output
from backend.services.llm import build_prompt_with_context, chat_stream
from backend.services.vector import search
from backend.services.data_seed import get_document_by_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream_endpoint(req: ChatRequest, request: Request):
    """Stream chat response with RAG context."""
    ip = request.client.host if request.client else "unknown"
    allowed, reason = check_input(req.message, None, ip)
    if not allowed:
        code = 429 if reason == "rate_limit" else 400
        detail = "Too many requests" if reason == "rate_limit" else "Request blocked by content policy"
        raise HTTPException(status_code=code, detail=detail)

    # Search relevant documents
    search_results = search(req.message, n_results=3)

    # Enrich with full data
    context_docs = []
    for result in search_results:
        full_doc = get_document_by_id(result["id"])
        if full_doc:
            context_docs.append(full_doc)
        else:
            context_docs.append(result)

    messages = build_prompt_with_context(req.message, context_docs)

    # Add chat history
    if req.history:
        history_msgs = []
        for h in req.history[-6:]:  # Keep last 6 messages
            history_msgs.append({"role": h["role"], "content": h["content"]})
        messages = [messages[0]] + history_msgs + [messages[-1]]

    async def generate():
        async for chunk in chat_stream(messages):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")


@router.post("/context")
async def get_context(req: ChatRequest, request: Request):
    """Get RAG context documents for a query (for UI display)."""
    ip = request.client.host if request.client else "unknown"
    allowed, reason = check_input(req.message, None, ip)
    if not allowed:
        code = 429 if reason == "rate_limit" else 400
        detail = "Too many requests" if reason == "rate_limit" else "Request blocked by content policy"
        raise HTTPException(status_code=code, detail=detail)
    try:
        results = search(req.message, n_results=3)
    except Exception as exc:
        logger.error("Vector search failed: %s", exc)
        raise HTTPException(status_code=503, detail="Vector search unavailable")
    enriched = []
    for r in results:
        full_doc = get_document_by_id(r["id"])
        if full_doc:
            enriched.append({
                "id": full_doc["id"],
                "title": full_doc["title"],
                "domain": full_doc["domain"],
                "distance": r.get("distance"),
            })
    return {"context": enriched}
