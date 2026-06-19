# ModelRouter - PRD v2 §3.3 정책으로 모델 폴백 체인을 산출 (순수 로직, LLM 비호출)
from dataclasses import dataclass


@dataclass
class RouteRequest:
    sensitive: bool = False        # 민감 데이터 포함 → 로컬 ONLY
    budget_ratio: float = 1.0      # 잔여 budget 비율 (<0.2 → 로컬 우선)
    kind: str = "chat"             # chat | code
    quality: str = "normal"        # normal | high
    lang: str = "en"               # ko 등


class ModelRouter:
    def __init__(
        self,
        executor: str,
        coder: str = "ollama/qwen3-coder",
        cloud_high: tuple[str, ...] = ("claude-3-7-sonnet", "gemini-2.5-pro"),
    ):
        self.executor = executor
        self.coder = coder
        self.cloud_high = cloud_high

    def route(self, req: RouteRequest) -> list[str]:
        chain: list[str] = []
        # 고품질 필요 → 클라우드 우선
        if req.quality == "high":
            chain += list(self.cloud_high)
        # 코드 생성 → Coder 우선
        if req.kind == "code":
            chain.append(self.coder)
        # 기본 실행기(로컬)
        chain.append(self.executor)

        # 민감 데이터 → 클라우드 제거 (로컬 ONLY)
        if req.sensitive:
            chain = [m for m in chain if _is_local(m)]
        # 잔여 budget < 20% → 로컬 우선 재정렬
        if req.budget_ratio < 0.2:
            chain = [m for m in chain if _is_local(m)] + [m for m in chain if not _is_local(m)]

        return _dedupe(chain)


def _is_local(model: str) -> bool:
    return model.startswith("ollama/")


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in items:
        if m not in seen:
            seen.add(m)
            out.append(m)
    return out
