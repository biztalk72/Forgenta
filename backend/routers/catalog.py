"""Catalog router for Agent/App management."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

# In-memory catalog store (demo)
AGENTS = [
    {
        "id": "agent-001",
        "name": "품질 불량 분석 에이전트",
        "description": "CNC 가공, 용접, 도장 등 제조 공정의 불량 데이터를 분석하고 원인을 추적합니다.",
        "domain": "manufacturing",
        "type": "agent",
        "status": "Active",
        "owner": "김생산",
        "tags": ["품질", "불량", "제조"],
        "usage_count": 142,
    },
    {
        "id": "agent-002",
        "name": "HR 인사 분석 에이전트",
        "description": "부서별 인원, 채용, 이직, 만족도 등 인사 데이터를 분석합니다.",
        "domain": "hr",
        "type": "agent",
        "status": "Active",
        "owner": "박인사",
        "tags": ["HR", "인사", "채용"],
        "usage_count": 98,
    },
    {
        "id": "agent-003",
        "name": "비용 이상치 탐지 에이전트",
        "description": "예산 대비 실 집행 비용의 이상치를 자동으로 탐지하고 원인을 분석합니다.",
        "domain": "finance",
        "type": "agent",
        "status": "Active",
        "owner": "이재무",
        "tags": ["비용", "이상치", "재무"],
        "usage_count": 76,
    },
    {
        "id": "agent-004",
        "name": "설비 예방정비 스케줄러",
        "description": "설비 가동률과 정비 이력을 분석하여 최적의 예방정비 스케줄을 제안합니다.",
        "domain": "manufacturing",
        "type": "agent",
        "status": "Draft",
        "owner": "최설비",
        "tags": ["설비", "정비", "가동률"],
        "usage_count": 23,
    },
]

APPS = [
    {
        "id": "app-001",
        "name": "제조 대시보드",
        "description": "설비 가동률, 불량률, 재고 현황을 실시간 대시보드로 보여줍니다.",
        "domain": "manufacturing",
        "type": "app",
        "status": "Active",
        "owner": "김생산",
        "tags": ["대시보드", "제조", "실시간"],
        "usage_count": 210,
    },
    {
        "id": "app-002",
        "name": "채용 파이프라인 트래커",
        "description": "채용 프로세스의 각 단계별 현황을 추적하고 리포트를 생성합니다.",
        "domain": "hr",
        "type": "app",
        "status": "Active",
        "owner": "박인사",
        "tags": ["채용", "파이프라인", "HR"],
        "usage_count": 67,
    },
    {
        "id": "app-003",
        "name": "예산 집행 분석기",
        "description": "부서별 예산 집행률을 시각화하고 이상치를 하이라이트합니다.",
        "domain": "finance",
        "type": "app",
        "status": "Active",
        "owner": "이재무",
        "tags": ["예산", "집행", "시각화"],
        "usage_count": 89,
    },
]


@router.get("/agents")
async def list_agents():
    return {"items": AGENTS}


@router.get("/apps")
async def list_apps():
    return {"items": APPS}


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    for a in AGENTS:
        if a["id"] == agent_id:
            return a
    raise HTTPException(status_code=404, detail="Agent not found")


@router.get("/apps/{app_id}")
async def get_app(app_id: str):
    for a in APPS:
        if a["id"] == app_id:
            return a
    raise HTTPException(status_code=404, detail="App not found")


class CloneRequest(BaseModel):
    name: str
    description: str = ""


@router.post("/agents/{agent_id}/clone")
async def clone_agent(agent_id: str, req: CloneRequest):
    for a in AGENTS:
        if a["id"] == agent_id:
            new_agent = {**a, "id": f"agent-clone-{len(AGENTS)+1:03d}", "name": req.name, "status": "Draft", "usage_count": 0}
            if req.description:
                new_agent["description"] = req.description
            AGENTS.append(new_agent)
            return new_agent
    raise HTTPException(status_code=404, detail="Agent not found")
