"""ModelRouter unit tests — PRD v3.4 §3.5 의미론 검증.

DGX 프로필: planner=72B 로컬, executor=32B 로컬, cloud_high 는 폴백.
Mac 프로필 (planner 미지정): planner==executor 로 자동 폴백.
"""

from app.router import ModelRouter, RouteRequest

# DGX 프로필 라우터
DGX = ModelRouter(
    executor="vllm/qwen3-coder-32b-fp8",
    planner="vllm/qwen3-72b-instruct-nvfp4",
    summarizer="vllm/qwen3-8b-fp8",
    coder="vllm/qwen3-coder-32b-fp8",
)

# Mac 베이스라인 (planner 등 미지정 → executor 로 폴백)
MAC = ModelRouter(executor="ollama/qwen3:8b")


def test_default_chain_is_local_executor():
    assert DGX.route(RouteRequest()) == ["vllm/qwen3-coder-32b-fp8"]
    assert MAC.route(RouteRequest()) == ["ollama/qwen3:8b"]


def test_high_quality_puts_planner_first():
    # DGX: 로컬 72B planner 가 1순위, cloud_high 는 폴백.
    chain = DGX.route(RouteRequest(quality="high"))
    assert chain[0] == "vllm/qwen3-72b-instruct-nvfp4"
    assert "claude-3-7-sonnet" in chain
    assert chain[-1] == "vllm/qwen3-coder-32b-fp8"


def test_sensitive_drops_external():
    # DGX: external (claude/gemini) 제거, vllm 만 남음.
    chain = DGX.route(RouteRequest(quality="high", sensitive=True))
    assert all(m.startswith(("vllm/", "ollama/", "nim/", "trtllm/")) for m in chain)
    assert "claude-3-7-sonnet" not in chain


def test_code_uses_coder():
    chain = DGX.route(RouteRequest(kind="code"))
    # DGX: coder == executor → dedupe 후 단일 모델
    assert chain == ["vllm/qwen3-coder-32b-fp8"]


def test_long_context_adds_summarizer():
    chain = DGX.route(RouteRequest(long_context=True))
    assert "vllm/qwen3-8b-fp8" in chain


def test_low_budget_reorders_local_first():
    chain = DGX.route(RouteRequest(quality="high", budget_ratio=0.1))
    assert chain[0].startswith("vllm/")
    # 외부가 있다면 모두 로컬 뒤에 위치
    locals_idx = [i for i, m in enumerate(chain) if m.startswith(("vllm/", "ollama/"))]
    externals_idx = [i for i, m in enumerate(chain) if not m.startswith(("vllm/", "ollama/"))]
    if externals_idx:
        assert max(locals_idx) < min(externals_idx)


def test_no_duplicates():
    chain = DGX.route(RouteRequest(kind="code", quality="high", long_context=True))
    assert len(chain) == len(set(chain))
