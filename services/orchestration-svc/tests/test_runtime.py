from app.runtime import Step, _parse_steps, _resolve_input_map, _build_llm_messages


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
