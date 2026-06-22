# ModelRouter — PRD v2 §3.3 + PRD v3.4 §3.5 (DGX 정책 확장)
# 순수 로직, LLM 비호출. 입력 RouteRequest → 모델 폴백 체인 산출.
from dataclasses import dataclass


@dataclass
class RouteRequest:
    sensitive: bool = False        # 민감 데이터 포함 → 로컬 ONLY (vllm/ollama)
    budget_ratio: float = 1.0      # 잔여 budget 비율 (<0.2 → 로컬 우선)
    kind: str = "chat"             # chat | code
    quality: str = "normal"        # normal | high
    lang: str = "en"               # ko 등
    long_context: bool = False     # 32k+ 컨텍스트 → summarizer 우선 (PRD v3.4 §3.5)


class ModelRouter:
    """모델 폴백 체인을 생성한다.

    DGX 프로필 (PRD v3.4 §3.5):
      - high quality           → planner (vllm/qwen3-72b) 우선
      - code 의도              → executor (vllm/qwen3-coder-32b) 우선
      - long_context           → summarizer (vllm/qwen3-8b) 우선
      - sensitive              → 외부(claude/gpt/gemini) 제거, vllm/ollama 만
      - budget_ratio < 0.2     → 로컬(vllm/ollama) 재정렬 우선

    Mac 베이스라인 호환:
      - planner 가 ollama/* 면 그대로 사용.
    """

    def __init__(
        self,
        executor: str,
        *,
        planner: str | None = None,
        summarizer: str | None = None,
        coder: str | None = None,
        critic: str = "claude-3-7-sonnet",
        cloud_high: tuple[str, ...] = ("claude-3-7-sonnet", "gemini-2.5-pro"),
    ):
        self.executor = executor
        # planner/summarizer/coder 미지정 시 executor 로 폴백 (단발 모델 환경 호환).
        self.planner = planner or executor
        self.summarizer = summarizer or executor
        self.coder = coder or executor
        self.critic = critic
        self.cloud_high = cloud_high

    def route(self, req: RouteRequest) -> list[str]:
        chain: list[str] = []
        # 1) 의도/품질에 따른 1차 후보
        if req.quality == "high":
            chain.append(self.planner)
            chain += list(self.cloud_high)
        if req.kind == "code":
            chain.append(self.coder)
        if req.long_context:
            chain.append(self.summarizer)
        # 2) 기본 실행기 (로컬)
        chain.append(self.executor)
        # 3) 정책 필터
        if req.sensitive:
            chain = [m for m in chain if _is_local(m)]
        if req.budget_ratio < 0.2:
            chain = [m for m in chain if _is_local(m)] + [m for m in chain if not _is_local(m)]
        return _dedupe(chain)


def _is_local(model: str) -> bool:
    """vLLM/NIM/TRT-LLM/Ollama 는 모두 로컬(클러스터 내부) 백엔드."""
    return any(model.startswith(p + "/") for p in ("vllm", "nim", "trtllm", "ollama"))


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in items:
        if m not in seen:
            seen.add(m)
            out.append(m)
    return out
