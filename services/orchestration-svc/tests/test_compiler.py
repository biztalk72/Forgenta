from app.compiler import validate, _extract_json, _fallback_spec


def _valid():
    return {
        "version": 1, "name": "wf",
        "steps": [
            {"seq": 1, "kind": "llm", "name": "a", "on_error": "halt", "handoff_to": 2},
            {"seq": 2, "kind": "export", "name": "b", "ref": {"connector_id": "c1"}, "on_error": "halt", "handoff_to": None},
        ],
    }


def test_valid_spec_passes():
    assert validate(_valid()) is None


def test_fallback_is_valid():
    assert validate(_fallback_spec("do a thing")) is None


def test_missing_version():
    s = _valid(); del s["version"]
    assert validate(s) is not None


def test_bad_kind():
    s = _valid(); s["steps"][0]["kind"] = "nope"
    assert validate(s) is not None


def test_non_consecutive_seq():
    s = _valid(); s["steps"][1]["seq"] = 5
    assert validate(s) is not None


def test_export_requires_connector():
    s = _valid(); s["steps"][1]["ref"] = {}
    assert validate(s) is not None


def test_extract_json_from_noise():
    assert _extract_json('blah {"version":1,"steps":[]} tail')["version"] == 1
