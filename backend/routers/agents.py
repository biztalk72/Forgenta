"""Agent orchestration: tasks, pipelines, schedules, WebSocket live updates."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from backend.services.agent_executor import (
    cancel_task,
    create_pipeline,
    create_schedule,
    delete_schedule,
    enqueue_task,
    get_task,
    list_pipelines,
    list_schedules,
    list_tasks,
    run_pipeline,
    subscribe,
    unsubscribe,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class RunTaskRequest(BaseModel):
    input: str


class CreatePipelineRequest(BaseModel):
    name: str
    steps: list[dict]  # [{agent_id: str, agent_name: str}]


class RunPipelineRequest(BaseModel):
    input: str


class CreateScheduleRequest(BaseModel):
    agent_id: str
    agent_name: str
    input: str
    cron: str


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@router.post("/tasks/{agent_id}/run", status_code=201)
async def run_task(agent_id: str, req: RunTaskRequest):
    from backend.routers.catalog import agent_store
    if not agent_store.get(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    task = enqueue_task(agent_id, req.input)
    return task.to_dict()


@router.get("/tasks")
async def get_tasks(limit: int = 50):
    return {"tasks": [t.to_dict() for t in list_tasks(limit)]}


@router.get("/tasks/{task_id}")
async def get_task_by_id(task_id: str):
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.to_dict()


@router.delete("/tasks/{task_id}")
async def cancel(task_id: str):
    if not cancel_task(task_id):
        raise HTTPException(status_code=400, detail="Task is not cancellable (already running or finished)")
    return {"cancelled": task_id}


@router.websocket("/tasks/{task_id}/ws")
async def task_ws(websocket: WebSocket, task_id: str):
    await websocket.accept()
    task = get_task(task_id)
    if not task:
        await websocket.send_text(json.dumps({"error": "Task not found"}))
        await websocket.close()
        return

    # Send current snapshot immediately so the client can render existing state
    await websocket.send_text(json.dumps({"type": "snapshot", **task.to_dict()}))

    if task.status.value in ("done", "failed", "cancelled"):
        await websocket.close()
        return

    async def _send(message: dict) -> None:
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            pass

    subscribe(task_id, _send)
    try:
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    finally:
        unsubscribe(task_id, _send)


# ---------------------------------------------------------------------------
# Pipelines
# ---------------------------------------------------------------------------

@router.post("/pipelines", status_code=201)
async def create_pipeline_ep(req: CreatePipelineRequest):
    if not req.steps:
        raise HTTPException(status_code=400, detail="Pipeline must have at least one step")
    pipeline = create_pipeline(req.name, req.steps)
    return pipeline.to_dict()


@router.get("/pipelines")
async def list_pipelines_ep():
    return {"pipelines": [p.to_dict() for p in list_pipelines()]}


@router.post("/pipelines/{pipeline_id}/run", status_code=202)
async def run_pipeline_ep(pipeline_id: str, req: RunPipelineRequest, bg: BackgroundTasks):
    from backend.services import agent_executor as ex
    if pipeline_id not in ex._pipeline_store:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    async def _bg() -> None:
        await run_pipeline(pipeline_id, req.input)

    bg.add_task(_bg)
    return {"pipeline_id": pipeline_id, "status": "started", "input": req.input}


# ---------------------------------------------------------------------------
# Schedules
# ---------------------------------------------------------------------------

@router.post("/schedules", status_code=201)
async def create_schedule_ep(req: CreateScheduleRequest):
    try:
        sched = create_schedule(req.agent_id, req.agent_name, req.input, req.cron)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid schedule: {exc}")
    return sched.to_dict()


@router.get("/schedules")
async def list_schedules_ep():
    return {"schedules": [s.to_dict() for s in list_schedules()]}


@router.delete("/schedules/{schedule_id}")
async def delete_schedule_ep(schedule_id: str):
    if not delete_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"deleted": schedule_id}
