"""Chat router with streaming and RAG."""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.services.llm import build_prompt_with_context, chat_stream
from backend.services.vector import search
from backend.services.data_seed import get_document_by_id

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/stream")
async def chat_stream_endpoint(req: ChatRequest):
    """Stream chat response with RAG context."""
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
async def get_context(req: ChatRequest):
    """Get RAG context documents for a query (for UI display)."""
    results = search(req.message, n_results=3)
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
