# Workflow Compiler - 자연어 설명 → workflow.spec(PRD v3 §6.A). 출력 검증 + 실패 시 재시도(로컬 모델 비결정성 대비)
import json
from collections.abc import AsyncIterator

from .config import Config
from .providers import stream

KINDS = {"llm", "tool", "approval", "export"}
ON_ERROR = {"retry", "skip", "halt"}

SYSTEM = (
    "You are a workflow compiler. Convert the user's request into a JSON workflow spec. "
    "Output ONLY a JSON object, no prose, no markdown fences. Schema: "
    '{"version":1,"name":"<short name>","steps":[{"seq":<int from 1, unique, consecutive>,'
    '"kind":"llm|tool|approval|export","name":"<step name>",'
    '"ref":{},"input_map":{},"output_key":"<key>","requires_approval":false,'
    '"on_error":"halt","handoff_to":<next seq or null>}]}. '
    "Produce at least 2 steps. kind must be one of llm/tool/approval/export. "
    "For kind=export, ref MUST include connector_id. on_error in retry/skip/halt. /no_think"
)


def _extract_json(text: str) -> dict | None:
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        obj = json.loads(text[start : end + 1])
        return obj if isinstance(obj, dict) else None
    except ValueError:
        return None


def validate(spec: dict | None) -> str | None:
    """§6.A 검증. 유효하면 None, 아니면 오류 메시지."""
    if not isinstance(spec, dict):
        return "not an object"
    if not isinstance(spec.get("version"), int):
        return "version missing/not int"
    steps = spec.get("steps")
    if not isinstance(steps, list) or len(steps) < 1:
        return "steps must be a non-empty list"
    seqs = []
    for st in steps:
        if not isinstance(st, dict):
            return "step not an object"
        if st.get("kind") not in KINDS:
            return f"invalid kind: {st.get('kind')}"
        if not isinstance(st.get("seq"), int):
            return "step seq missing/not int"
        seqs.append(st["seq"])
        if st.get("kind") == "export" and not (st.get("ref") or {}).get("connector_id"):
            return "export step requires ref.connector_id"
        if st.get("on_error", "halt") not in ON_ERROR:
            return f"invalid on_error: {st.get('on_error')}"
        ht = st.get("handoff_to")
        if ht is not None and not isinstance(ht, int):
            return "handoff_to must be int or null"
    if sorted(seqs) != list(range(1, len(seqs) + 1)):
        return f"seq not unique/consecutive from 1: {seqs}"
    return None


def _fallback_spec(description: str) -> dict:
    """LLM이 유효 spec을 못 내면 사용하는 결정적 2-step 기본값(정직하게 fallback 표시)."""
    name = (description.strip().splitlines()[0] if description.strip() else "workflow")[:60]
    return {
        "version": 1,
        "name": name or "workflow",
        "steps": [
            {"seq": 1, "kind": "llm", "name": "Draft", "ref": {}, "input_map": {},
             "output_key": "draft", "requires_approval": False, "on_error": "halt", "handoff_to": 2},
            {"seq": 2, "kind": "llm", "name": "Review", "ref": {}, "input_map": {"draft": "context.draft"},
             "output_key": "result", "requires_approval": False, "on_error": "halt", "handoff_to": None},
        ],
    }


async def compile_spec(cfg: Config, description: str, chain: list[str], retries: int = 3) -> tuple[dict, str | None, bool]:
    """(spec, error, used_fallback). error=None이면 유효."""
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": description}]
    last_err = "no output"
    for _ in range(retries):
        text = ""
        for model in chain:
            try:
                async for tok in stream(cfg, model, messages):
                    text += tok
                break
            except Exception:  # noqa: BLE001 - 폴백 체인
                continue
        spec = _extract_json(text)
        err = validate(spec)
        if err is None:
            return spec, None, False
        last_err = err
    fb = _fallback_spec(description)
    return fb, last_err, True
