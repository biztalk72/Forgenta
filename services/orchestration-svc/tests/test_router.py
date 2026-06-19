from app.router import ModelRouter, RouteRequest

R = ModelRouter(executor="ollama/qwen3:8b")


def test_default_chain_is_local_executor():
    assert R.route(RouteRequest()) == ["ollama/qwen3:8b"]


def test_high_quality_puts_cloud_first():
    chain = R.route(RouteRequest(quality="high"))
    assert chain[0] == "claude-3-7-sonnet"
    assert chain[-1] == "ollama/qwen3:8b"


def test_sensitive_drops_cloud():
    chain = R.route(RouteRequest(quality="high", sensitive=True))
    assert all(m.startswith("ollama/") for m in chain)


def test_code_adds_coder_before_executor():
    chain = R.route(RouteRequest(kind="code"))
    assert chain == ["ollama/qwen3-coder", "ollama/qwen3:8b"]


def test_low_budget_reorders_local_first():
    chain = R.route(RouteRequest(quality="high", budget_ratio=0.1))
    assert chain[0].startswith("ollama/")


def test_no_duplicates():
    chain = R.route(RouteRequest(kind="code", quality="high"))
    assert len(chain) == len(set(chain))
