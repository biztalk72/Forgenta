> Forgenta v2 재구축 중 내린 결정과 그 근거를 계속 기록한다. 다음 세션이 재추론 없이 이어받기 위함.

# Context Notes — Forgenta v2 Rebuild

## 결정 완료 (Decisions Made)

### 2026-06-19 — v1을 아카이브하고 v2를 처음부터 빌드
- **결정.** v1 구현(FastAPI + ChromaDB + Ollama + AWS ECS/Fargate)을 `archive/v1-fastapi`
  브랜치(origin 푸시 완료)로 보존하고, `main`을 docs+config만 남긴 v2 베이스라인(`8833013`)으로 리셋.
- **근거.** PRD v2의 목표 아키텍처(Go 마이크로서비스 + LangGraph + k3d/Helm + PG/Qdrant/MinIO)는
  v1(FastAPI 단일 백엔드 + ChromaDB + ECS)과 호환되지 않는다. 점진적 마이그레이션보다 재구축이 단순하다.
- **영향.** 기존 코드 자산은 참고용으로만 사용. main에는 코드가 전혀 없는 상태에서 시작.

### 2026-06-19 — 로컬 툴링 파일 gitignore
- **결정.** `.claude/`, `.harness-mem/`, `AGENTS.md`, `settings*.json`, `.DS_Store`를 비추적 처리.
- **근거.** 에이전트 하니스/로컬 설정은 공유 대상이 아니다.

### 2026-06-19 — 빌드 순서는 CLAUDE.md Loop Harness를 따른다
- **결정.** PLAN.md의 Phase 0~10을 CLAUDE.md §3 Loop 1~6에 매핑. 각 Phase는 verify 게이트 통과 필수.
- **근거.** 단일 진실 소스(CLAUDE.md)와의 정합성. 단계별 롤백 가능성 확보.

### 2026-06-19 — 7개 서비스 동시 구축 대신 수직 슬라이스 우선
- **결정.** Phase 4(Orchestration + Ollama 스트리밍)를 핵심 수직 슬라이스로 우선 완성한 뒤
  Headroom/Catalog/Artifact/Governance를 확장.
- **근거.** CLAUDE.md §2 Simplicity First. 가치 흐름(입력→결과)을 가장 빨리 검증.

## 결정 대기 (Open — 빌드 중 확정 필요)

1. **수직 슬라이스 최소 범위.** Phase 3(Identity+Gateway)를 슬라이스에 포함할지, 아니면
   Orchestration 단독으로 먼저 띄우고 인증을 나중에 붙일지.
2. **Ollama 모델 풀 대상.** PRD는 qwen3:8b/14b, gemma3:12b, qwen3:1.7b를 명시. 32GB RAM에서
   동시 상주 가능 조합 확정 필요. (14b + 8b 동시 상주 시 메모리 확인)
3. **시크릿 관리.** k3d에서 LLM API 키(Anthropic/OpenAI/Google)를 Helm values vs k8s Secret vs
   외부 주입 중 어느 방식으로 다룰지.
4. **Helm 차트 분리 단위.** `forgenta-core`를 단일 차트로 둘지 서비스별 서브차트로 나눌지.
5. **DB 확장 가용성.** k3d용 PostgreSQL 이미지에서 pgvector + TimescaleDB를 동시 지원하는
   이미지/빌드 확인 필요.

## 메모 (Notes)

- PRD v2는 §1~§3(제품정의/아키텍처/LLM전략)까지만 작성됨. ERD·와이어프레임·API 명세 등 v1.x 상세 문서는
  `docs/prd/아카이브.zip`에 보관. 필요 시 참고하되 v2 정합성은 PRD v2 + CLAUDE.md 우선.
- CLAUDE.md §8 오류 처리 원칙 5번째 항목이 원문에서 잘려 있음("사용자에게 노출되는 오류 메시지는 절대...").
  구현 전 원문 보강 확인 필요.
- 헬스(§6)/로그(§7) 규격은 공통 라이브러리로 Phase 0에서 고정 → 모든 서비스 준용.
