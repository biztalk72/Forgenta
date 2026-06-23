import json

import httpx
import pytest
import respx

from app.config import Config
from app.runtime import (
    Step,
    _build_llm_messages,
    _parse_steps,
    _resolve_input_map,
    resume_workflow,
    run_workflow,
)


def test_parse_steps_sorts_by_seq():
    spec = {"steps": [
        {"seq": 2, "kind": "llm", "name": "B"},
        {"seq": 1, "kind": "llm", "name": "A"},
    ]}
    steps = _parse_steps(spec)
    assert [s.seq for s in steps] == [1, 2]
    assert steps[0].name == "A"


def test_parse_steps_defaults_apply():
    steps = _parse_steps({"steps": [{"seq": 1, "kind": "tool", "name": "T"}]})
    s = steps[0]
    assert s.on_error == "halt"
    assert s.handoff_to is None
    assert s.requires_approval is False
    assert s.input_map == {} and s.ref == {}


def test_resolve_input_map_pulls_blackboard():
    step = Step(seq=2, kind="llm", name="Review",
                input_map={"draft": "context.draft", "literal": "fixed-value"})
    bb = {"draft": "DRAFT-TEXT", "ignored": "x"}
    inputs = _resolve_input_map(step, bb)
    assert inputs == {"draft": "DRAFT-TEXT", "literal": "fixed-value"}


def test_resolve_input_map_missing_key_blank():
    step = Step(seq=2, kind="llm", name="Review", input_map={"draft": "context.absent"})
    assert _resolve_input_map(step, {})["draft"] == ""


def test_build_llm_messages_includes_inputs():
    step = Step(seq=2, kind="llm", name="Review draft")
    msgs = _build_llm_messages(step, {"draft": "hello world"})
    assert len(msgs) == 1
    content = msgs[0]["content"]
    assert "Step: Review draft" in content
    assert "draft: hello world" in content
    assert "/no_think" in content


def test_build_llm_messages_truncates_long_inputs():
    step = Step(seq=1, kind="llm", name="Summarize")
    big = "x" * 3000
    msgs = _build_llm_messages(step, {"src": big})
    assert "[truncated]" in msgs[0]["content"]
    assert len(msgs[0]["content"]) < 2500


# ── Phase 14: approval row 작성 + resume 플로우 ──
# runtime 은 workflow-svc/governance-svc 에 httpx 로 호출 — respx 로 모킹한다.
# governance UsageEvent / log 함수는 no-op stub.

WS = "00000000-0000-0000-0000-000000000001"
USER = "00000000-0000-0000-0000-0000000000aa"
WF_ID = "11111111-1111-1111-1111-111111111111"
RUN_ID = "22222222-2222-2222-2222-222222222222"
STEP1_ID = "33333333-3333-3333-3333-333333333331"
STEP2_ID = "33333333-3333-3333-3333-333333333332"
APPROVAL_ID = "44444444-4444-4444-4444-444444444444"


def _cfg() -> Config:
    return Config(
        port="8002",
        inference_gateway_url="",
        ollama_host="http://ollama.test",
        planner_model="vllm/p", executor_model="vllm/e",
        summarizer_model="vllm/s", router_model="vllm/r",
        embed_model="vllm/em", critic_model="claude-test",
        anthropic_key="", google_key="", openai_key="",
        headroom_url="http://headroom.test",
        governance_url="http://gov.test",
        workflow_url="http://wf.test",
        headroom_enabled=False,
    )


async def _noop_record_usage(*args, **kwargs):
    return None


def _noop_log(*args, **kwargs):
    return None


def _parse_sse(events: list[str]) -> list[tuple[str, dict]]:
    """SSE 문자열 리스트를 (event, data_dict) 로 파싱."""
    out: list[tuple[str, dict]] = []
    for raw in events:
        if not raw or not raw.startswith("event:"):
            continue
        lines = raw.strip().split("\n")
        event = lines[0].split(":", 1)[1].strip()
        data_line = lines[1].split(":", 1)[1].strip() if len(lines) > 1 else "{}"
        out.append((event, json.loads(data_line)))
    return out


@pytest.mark.asyncio
async def test_run_workflow_creates_approval_and_stops():
    """approval 단계: step_run(awaiting_approval) + governance approval row 생성 후 정지."""
    spec = {"steps": [
        {"seq": 1, "kind": "approval", "name": "Manager review", "input_map": {}},
        {"seq": 2, "kind": "tool", "name": "Should not run"},
    ]}
    cfg = _cfg()
    created_approval = {}
    patched_step = {}
    final_run_patch = {}

    with respx.mock(assert_all_called=False) as mock:
        mock.post(f"{cfg.workflow_url}/v1/runs").mock(
            return_value=httpx.Response(201, json={"id": RUN_ID, "status": "running"}))
        mock.post(f"{cfg.workflow_url}/v1/runs/{RUN_ID}/steps").mock(
            return_value=httpx.Response(201, json={"id": STEP1_ID}))

        def _approval_handler(request):
            created_approval["body"] = json.loads(request.content)
            created_approval["ws"] = request.headers.get("X-Workspace-Id")
            return httpx.Response(201, json={"id": APPROVAL_ID, "status": "pending"})

        mock.post(f"{cfg.governance_url}/v1/approvals").mock(side_effect=_approval_handler)

        def _patch_step_handler(request):
            patched_step["body"] = json.loads(request.content)
            return httpx.Response(200, json={"status": "updated"})

        mock.patch(f"{cfg.workflow_url}/v1/steps/{STEP1_ID}").mock(side_effect=_patch_step_handler)

        def _patch_run_handler(request):
            final_run_patch["body"] = json.loads(request.content)
            return httpx.Response(200, json={"status": "updated"})

        mock.patch(f"{cfg.workflow_url}/v1/runs/{RUN_ID}").mock(side_effect=_patch_run_handler)

        events = []
        async for ev in run_workflow(
            cfg, workflow_id=WF_ID, spec=spec,
            ws=WS, user=USER,
            routing={}, chain=["vllm/e"],
            initial_context=None,
            record_usage_fn=_noop_record_usage, log_fn=_noop_log,
        ):
            events.append(ev)

    parsed = _parse_sse(events)
    kinds = [e for e, _ in parsed]
    # run.started → awaiting_approval → run.done (두 번째 step 은 실행되지 않음)
    assert kinds == ["run.started", "awaiting_approval", "run.done"]

    awaiting = next(d for e, d in parsed if e == "awaiting_approval")
    assert awaiting["seq"] == 1
    assert awaiting["step_id"] == STEP1_ID
    assert awaiting["approval_id"] == APPROVAL_ID

    # governance 에 resource_type=workflow_step_run, resource_id=STEP1_ID 로 호출됐는지.
    assert created_approval["body"] == {
        "resource_type": "workflow_step_run",
        "resource_id": STEP1_ID,
    }
    assert created_approval["ws"] == WS
    # step_run 이 approval_id 로 PATCH 됐는지.
    assert patched_step["body"]["approval_id"] == APPROVAL_ID
    assert patched_step["body"]["status"] == "awaiting_approval"
    # workflow_run finalize: awaiting_approval, finished=False.
    assert final_run_patch["body"]["status"] == "awaiting_approval"
    assert final_run_patch["body"]["finished"] is False

    done = next(d for e, d in parsed if e == "run.done")
    assert done["status"] == "awaiting_approval"


@pytest.mark.asyncio
async def test_resume_rejected_halts_run():
    """rejected 결정: awaiting step → failed, run → cancelled, 후속 단계 미실행."""
    cfg = _cfg()
    spec = {"steps": [
        {"seq": 1, "kind": "approval", "name": "Review"},
        {"seq": 2, "kind": "tool", "name": "Skipped"},
    ]}
    final_run_patch = {}

    with respx.mock(assert_all_called=False) as mock:
        mock.get(f"{cfg.workflow_url}/v1/runs/{RUN_ID}").mock(return_value=httpx.Response(200, json={
            "id": RUN_ID, "workflow_id": WF_ID, "status": "awaiting_approval",
            "trigger": "manual", "summary": "", "context": {"key1": "val1"},
            "steps": [{"id": STEP1_ID, "step_seq": 1, "kind": "approval",
                       "status": "awaiting_approval", "error": "",
                       "approval_id": APPROVAL_ID,
                       "prompt_tokens": 0, "completion_tokens": 0, "latency_ms": 0}],
        }))
        mock.get(f"{cfg.workflow_url}/v1/workflows/{WF_ID}").mock(return_value=httpx.Response(200, json={
            "id": WF_ID, "spec": spec,
        }))
        # governance approval 조회 — _fetch_approval 은 approved/rejected/pending 순으로 list 호출.
        mock.get(f"{cfg.governance_url}/v1/approvals", params={"status": "approved"}).mock(
            return_value=httpx.Response(200, json=[]))
        mock.get(f"{cfg.governance_url}/v1/approvals", params={"status": "rejected"}).mock(
            return_value=httpx.Response(200, json=[{"id": APPROVAL_ID, "status": "rejected"}]))
        # patch step / run
        step_patches = []
        run_patches = []

        def _patch_step(request):
            step_patches.append(json.loads(request.content))
            return httpx.Response(200, json={"status": "updated"})

        def _patch_run(request):
            body = json.loads(request.content)
            run_patches.append(body)
            final_run_patch["body"] = body
            return httpx.Response(200, json={"status": "updated"})

        mock.patch(f"{cfg.workflow_url}/v1/steps/{STEP1_ID}").mock(side_effect=_patch_step)
        mock.patch(f"{cfg.workflow_url}/v1/runs/{RUN_ID}").mock(side_effect=_patch_run)

        events = []
        async for ev in resume_workflow(
            cfg, run_id=RUN_ID, ws=WS, user=USER,
            routing={}, chain=["vllm/e"],
            record_usage_fn=_noop_record_usage, log_fn=_noop_log,
        ):
            events.append(ev)

    parsed = _parse_sse(events)
    kinds = [e for e, _ in parsed]
    assert kinds == ["run.resumed", "run.done"]

    resumed = next(d for e, d in parsed if e == "run.resumed")
    assert resumed["decision"] == "rejected"
    assert resumed["awaiting_seq"] == 1

    # step_run PATCH: failed (with approval rejected error)
    assert step_patches[0]["status"] == "failed"
    # workflow_run PATCH: cancelled + finished=True
    assert final_run_patch["body"]["status"] == "cancelled"
    assert final_run_patch["body"]["finished"] is True

    done = next(d for e, d in parsed if e == "run.done")
    assert done["status"] == "cancelled"


@pytest.mark.asyncio
async def test_resume_approved_continues_remaining_steps():
    """approved 결정: awaiting step → succeeded, run → running → 남은 tool step 실행 → succeeded."""
    cfg = _cfg()
    spec = {"steps": [
        {"seq": 1, "kind": "approval", "name": "Review"},
        {"seq": 2, "kind": "tool", "name": "Apply", "output_key": "applied",
         "input_map": {"src": "context.key1"}},
    ]}
    final_run_patch = {}

    with respx.mock(assert_all_called=False) as mock:
        mock.get(f"{cfg.workflow_url}/v1/runs/{RUN_ID}").mock(return_value=httpx.Response(200, json={
            "id": RUN_ID, "workflow_id": WF_ID, "status": "awaiting_approval",
            "trigger": "manual", "summary": "", "context": {"key1": "draft-text"},
            "steps": [{"id": STEP1_ID, "step_seq": 1, "kind": "approval",
                       "status": "awaiting_approval", "error": "",
                       "approval_id": APPROVAL_ID,
                       "prompt_tokens": 0, "completion_tokens": 0, "latency_ms": 0}],
        }))
        mock.get(f"{cfg.workflow_url}/v1/workflows/{WF_ID}").mock(return_value=httpx.Response(200, json={
            "id": WF_ID, "spec": spec,
        }))
        mock.get(f"{cfg.governance_url}/v1/approvals", params={"status": "approved"}).mock(
            return_value=httpx.Response(200, json=[{"id": APPROVAL_ID, "status": "approved"}]))

        # 남은 step 의 createStep + patchStep
        mock.post(f"{cfg.workflow_url}/v1/runs/{RUN_ID}/steps").mock(
            return_value=httpx.Response(201, json={"id": STEP2_ID}))
        mock.patch(f"{cfg.workflow_url}/v1/steps/{STEP1_ID}").mock(
            return_value=httpx.Response(200, json={"status": "updated"}))
        mock.patch(f"{cfg.workflow_url}/v1/steps/{STEP2_ID}").mock(
            return_value=httpx.Response(200, json={"status": "updated"}))

        def _patch_run(request):
            body = json.loads(request.content)
            final_run_patch.setdefault("first_status", body.get("status"))
            final_run_patch["body"] = body
            return httpx.Response(200, json={"status": "updated"})

        mock.patch(f"{cfg.workflow_url}/v1/runs/{RUN_ID}").mock(side_effect=_patch_run)

        events = []
        async for ev in resume_workflow(
            cfg, run_id=RUN_ID, ws=WS, user=USER,
            routing={}, chain=["vllm/e"],
            record_usage_fn=_noop_record_usage, log_fn=_noop_log,
        ):
            events.append(ev)

    parsed = _parse_sse(events)
    kinds = [e for e, _ in parsed]
    # run.resumed → step.started → step.done → run.done
    assert kinds[0] == "run.resumed"
    assert "step.started" in kinds and "step.done" in kinds
    assert kinds[-1] == "run.done"

    resumed = next(d for e, d in parsed if e == "run.resumed")
    assert resumed["decision"] == "approved"

    step_done = next(d for e, d in parsed if e == "step.done")
    assert step_done["seq"] == 2
    assert step_done["status"] == "succeeded"
    assert step_done["output_key"] == "applied"

    done = next(d for e, d in parsed if e == "run.done")
    assert done["status"] == "succeeded"
    # 최종 patch run 은 succeeded + finished=True.
    assert final_run_patch["body"]["status"] == "succeeded"
    assert final_run_patch["body"]["finished"] is True


@pytest.mark.asyncio
async def test_resume_pending_returns_awaiting():
    """결정이 아직 pending: awaiting_approval 재emit 후 종료, 후속 단계 미실행."""
    cfg = _cfg()
    spec = {"steps": [
        {"seq": 1, "kind": "approval", "name": "Review"},
        {"seq": 2, "kind": "tool", "name": "Apply"},
    ]}

    with respx.mock(assert_all_called=False) as mock:
        mock.get(f"{cfg.workflow_url}/v1/runs/{RUN_ID}").mock(return_value=httpx.Response(200, json={
            "id": RUN_ID, "workflow_id": WF_ID, "status": "awaiting_approval",
            "trigger": "manual", "summary": "", "context": {},
            "steps": [{"id": STEP1_ID, "step_seq": 1, "kind": "approval",
                       "status": "awaiting_approval", "error": "",
                       "approval_id": APPROVAL_ID,
                       "prompt_tokens": 0, "completion_tokens": 0, "latency_ms": 0}],
        }))
        mock.get(f"{cfg.workflow_url}/v1/workflows/{WF_ID}").mock(return_value=httpx.Response(200, json={
            "id": WF_ID, "spec": spec,
        }))
        # 모든 status 쿼리에 빈 → approved → 빈 → rejected → APPROVAL_ID(pending) 매칭.
        mock.get(f"{cfg.governance_url}/v1/approvals", params={"status": "approved"}).mock(
            return_value=httpx.Response(200, json=[]))
        mock.get(f"{cfg.governance_url}/v1/approvals", params={"status": "rejected"}).mock(
            return_value=httpx.Response(200, json=[]))
        mock.get(f"{cfg.governance_url}/v1/approvals", params={"status": "pending"}).mock(
            return_value=httpx.Response(200, json=[{"id": APPROVAL_ID, "status": "pending"}]))

        events = []
        async for ev in resume_workflow(
            cfg, run_id=RUN_ID, ws=WS, user=USER,
            routing={}, chain=["vllm/e"],
            record_usage_fn=_noop_record_usage, log_fn=_noop_log,
        ):
            events.append(ev)

    parsed = _parse_sse(events)
    kinds = [e for e, _ in parsed]
    assert kinds == ["run.resumed", "awaiting_approval"]
    resumed = parsed[0][1]
    assert resumed["decision"] == "pending"
