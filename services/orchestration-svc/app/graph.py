# LangGraph StateGraph: router -> executor. 노드 분리 아키텍처(PRD v2 §2.3 [3])의 비스트리밍 제어 흐름.
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .config import Config
from .providers import stream
from .router import ModelRouter, RouteRequest


class State(TypedDict, total=False):
    prompt: str
    routing: dict
    chain: list[str]
    model: str
    output: str


def build_graph(cfg: Config, model_router: ModelRouter):
    def route_node(state: State) -> State:
        req = RouteRequest(**state.get("routing", {}))
        return {"chain": model_router.route(req)}

    async def executor_node(state: State) -> State:
        messages = [{"role": "user", "content": state["prompt"]}]
        last_err = None
        for model in state["chain"]:
            try:
                parts: list[str] = []
                async for tok in stream(cfg, model, messages):
                    parts.append(tok)
                return {"model": model, "output": "".join(parts)}
            except Exception as e:  # noqa: BLE001 - 폴백 체인: 다음 후보로 진행
                last_err = e
                continue
        raise RuntimeError(f"all models failed: {last_err}")

    g = StateGraph(State)
    g.add_node("router", route_node)
    g.add_node("executor", executor_node)
    g.add_edge(START, "router")
    g.add_edge("router", "executor")
    g.add_edge("executor", END)
    return g.compile()
