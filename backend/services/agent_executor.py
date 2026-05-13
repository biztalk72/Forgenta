"""Agent executor: task queue, pipeline chaining, APScheduler cron, WebSocket listeners."""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Callable, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.services.llm import chat_stream

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AgentTask:
    id: str = field(default_factory=lambda: f"task-{uuid.uuid4().hex[:10]}")
    agent_id: str = ""
    agent_name: str = ""
    pipeline_id: Optional[str] = None
    input: str = ""
    status: TaskStatus = TaskStatus.PENDING
    output: str = ""
    error: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "pipeline_id": self.pipeline_id,
            "input": self.input,
            "status": self.status.value,
            "output": self.output,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
        }

    @property
    def duration_ms(self) -> Optional[int]:
        if self.started_at and self.finished_at:
            return int((self.finished_at - self.started_at).total_seconds() * 1000)
        return None


@dataclass
class Pipeline:
    id: str = field(default_factory=lambda: f"pipeline-{uuid.uuid4().hex[:8]}")
    name: str = ""
    steps: list[dict] = field(default_factory=list)  # [{agent_id, agent_name}]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "steps": self.steps,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class Schedule:
    id: str = field(default_factory=lambda: f"sched-{uuid.uuid4().hex[:8]}")
    agent_id: str = ""
    agent_name: str = ""
    input: str = ""
    cron: str = ""
    enabled: bool = True
    last_run: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "input": self.input,
            "cron": self.cron,
            "enabled": self.enabled,
            "last_run": self.last_run.isoformat() if self.last_run else None,
        }


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

_task_store: dict[str, AgentTask] = {}
_pipeline_store: dict[str, Pipeline] = {}
_schedule_store: dict[str, Schedule] = {}
_task_queue: asyncio.Queue = asyncio.Queue()
_ws_listeners: dict[str, list[Callable]] = {}

scheduler = AsyncIOScheduler(timezone="UTC")


# ---------------------------------------------------------------------------
# WebSocket listener registry
# ---------------------------------------------------------------------------

def subscribe(task_id: str, send: Callable) -> None:
    _ws_listeners.setdefault(task_id, []).append(send)


def unsubscribe(task_id: str, send: Callable) -> None:
    listeners = _ws_listeners.get(task_id, [])
    try:
        listeners.remove(send)
    except ValueError:
        pass


async def _notify(task_id: str, message: dict) -> None:
    for send in list(_ws_listeners.get(task_id, [])):
        try:
            await send(message)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Agent lookup (deferred import to avoid circular)
# ---------------------------------------------------------------------------

def _get_agent(agent_id: str) -> dict | None:
    from backend.routers.catalog import agent_store
    return agent_store.get(agent_id)


# ---------------------------------------------------------------------------
# Task execution
# ---------------------------------------------------------------------------

async def _execute(task: AgentTask) -> None:
    task.status = TaskStatus.RUNNING
    task.started_at = datetime.now(timezone.utc)
    await _notify(task.id, {"type": "status", "status": "running"})

    try:
        agent = _get_agent(task.agent_id)
        if not agent:
            raise ValueError(f"Agent '{task.agent_id}' not found in catalog")

        messages = [
            {
                "role": "system",
                "content": (
                    f"당신은 {agent['name']} 에이전트입니다.\n"
                    f"역할: {agent['description']}\n"
                    "주어진 입력을 분석하고 한국어로 명확하게 답변하세요."
                ),
            },
            {"role": "user", "content": task.input},
        ]

        parts: list[str] = []
        async for chunk in chat_stream(messages):
            parts.append(chunk)
            await _notify(task.id, {"type": "chunk", "chunk": chunk})

        task.output = "".join(parts)
        task.status = TaskStatus.DONE

    except Exception as exc:
        logger.error("Task %s failed: %s", task.id, exc)
        task.status = TaskStatus.FAILED
        task.error = str(exc)

    finally:
        task.finished_at = datetime.now(timezone.utc)
        await _notify(task.id, {
            "type": "done",
            "status": task.status.value,
            "output": task.output,
            "error": task.error,
        })


async def _worker() -> None:
    while True:
        task = await _task_queue.get()
        if task.status != TaskStatus.CANCELLED:
            await _execute(task)
        _task_queue.task_done()


# ---------------------------------------------------------------------------
# Public task API
# ---------------------------------------------------------------------------

def enqueue_task(
    agent_id: str,
    input_text: str,
    pipeline_id: Optional[str] = None,
) -> AgentTask:
    agent = _get_agent(agent_id)
    task = AgentTask(
        agent_id=agent_id,
        agent_name=agent["name"] if agent else agent_id,
        pipeline_id=pipeline_id,
        input=input_text,
    )
    _task_store[task.id] = task
    _task_queue.put_nowait(task)
    return task


def get_task(task_id: str) -> Optional[AgentTask]:
    return _task_store.get(task_id)


def list_tasks(limit: int = 50) -> list[AgentTask]:
    return sorted(_task_store.values(), key=lambda t: t.created_at, reverse=True)[:limit]


def cancel_task(task_id: str) -> bool:
    task = _task_store.get(task_id)
    if task and task.status == TaskStatus.PENDING:
        task.status = TaskStatus.CANCELLED
        task.finished_at = datetime.now(timezone.utc)
        return True
    return False


# ---------------------------------------------------------------------------
# Public pipeline API
# ---------------------------------------------------------------------------

def create_pipeline(name: str, steps: list[dict]) -> Pipeline:
    pipeline = Pipeline(name=name, steps=steps)
    _pipeline_store[pipeline.id] = pipeline
    return pipeline


def list_pipelines() -> list[Pipeline]:
    return sorted(_pipeline_store.values(), key=lambda p: p.created_at, reverse=True)


async def run_pipeline(pipeline_id: str, initial_input: str) -> list[AgentTask]:
    pipeline = _pipeline_store.get(pipeline_id)
    if not pipeline:
        raise ValueError(f"Pipeline '{pipeline_id}' not found")

    run_tag = f"prun-{uuid.uuid4().hex[:6]}"
    tasks: list[AgentTask] = []
    current_input = initial_input

    for step in pipeline.steps:
        task = enqueue_task(step["agent_id"], current_input, pipeline_id=run_tag)
        tasks.append(task)

        while task.status in (TaskStatus.PENDING, TaskStatus.RUNNING):
            await asyncio.sleep(0.25)

        if task.status == TaskStatus.FAILED:
            logger.warning("Pipeline %s aborted at step %s", pipeline_id, step["agent_id"])
            break

        current_input = task.output or current_input

    return tasks


# ---------------------------------------------------------------------------
# Public schedule API
# ---------------------------------------------------------------------------

def create_schedule(
    agent_id: str,
    agent_name: str,
    input_text: str,
    cron: str,
) -> Schedule:
    sched = Schedule(
        agent_id=agent_id,
        agent_name=agent_name,
        input=input_text,
        cron=cron,
    )
    _schedule_store[sched.id] = sched

    def _fire() -> None:
        sched.last_run = datetime.now(timezone.utc)
        enqueue_task(agent_id, input_text)

    scheduler.add_job(
        _fire,
        CronTrigger.from_crontab(cron),
        id=sched.id,
        name=f"agent-{agent_id}",
        replace_existing=True,
    )
    return sched


def delete_schedule(schedule_id: str) -> bool:
    if schedule_id not in _schedule_store:
        return False
    del _schedule_store[schedule_id]
    if scheduler.get_job(schedule_id):
        scheduler.remove_job(schedule_id)
    return True


def list_schedules() -> list[Schedule]:
    return list(_schedule_store.values())


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

async def start(num_workers: int = 2) -> None:
    for _ in range(num_workers):
        asyncio.create_task(_worker())
    if not scheduler.running:
        scheduler.start()
    logger.info("Agent executor started (%d workers)", num_workers)


def stop() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
