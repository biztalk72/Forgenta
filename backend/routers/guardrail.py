"""Guardrail router: exposes stats for the dashboard."""

from fastapi import APIRouter
from backend.services.guardrail import get_stats

router = APIRouter(prefix="/api/guardrail", tags=["guardrail"])


@router.get("/stats")
async def guardrail_stats():
    return get_stats()
