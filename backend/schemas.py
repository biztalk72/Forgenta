"""Shared Pydantic models for Forgenta API."""

from pydantic import BaseModel


# --- Request models ---

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class PromptRequest(BaseModel):
    text: str


class PromptSaveRequest(BaseModel):
    text: str
    metadata: dict = {}


class CloneRequest(BaseModel):
    name: str
    description: str = ""


# --- Response models ---

class HealthResponse(BaseModel):
    status: str
    product: str
    version: str
    uptime_seconds: float


class ContextDoc(BaseModel):
    id: str
    title: str
    domain: str
    distance: float | None = None


class ContextResponse(BaseModel):
    context: list[ContextDoc]


class CatalogItem(BaseModel):
    id: str
    name: str
    description: str
    domain: str
    type: str
    status: str
    owner: str
    tags: list[str]
    usage_count: int


class CatalogListResponse(BaseModel):
    items: list[CatalogItem]
