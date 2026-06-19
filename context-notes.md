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

### 2026-06-19 — Phase 1 완료 (verify 통과). 결정 대기 #5 해소
- **Postgres 이미지.** `timescale/timescaledb-ha:pg16` 채택 → 단일 이미지에 **TimescaleDB 2.27.2 + pgvector 0.8.2**
  모두 포함 확인(`CREATE EXTENSION` 성공). 결정 대기 #5 해소.
- **배포 방식.** 외부 차트 의존 없이 `forgenta-infra` 차트에 평문 매니페스트 작성(StatefulSet=postgres,
  Deployment=redis/qdrant/minio, local-path PVC). Simplicity First.
- **결과.** 4개 Pod(postgresql-0/redis/qdrant/minio) Running/Ready, readiness probe 통과.
- **보안 메모.** DB/MinIO 자격증명을 values.yaml 평문으로 둠(로컬 dev). 운영 전 k8s Secret 전환 필요(결정 대기 #3).

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

### 2026-06-19 — Phase 0 완료 (verify 통과)
- **환경.** 프리플라이트 결과 docker(UP)/k3d v5.9.0/helm **v4.2.0**/kubectl v1.34.1/ollama/python3/node 존재.
  **Go 미설치** — Phase 3(Identity/Gateway) 시작 전 `brew install go` 필요. Phase 0~2는 영향 없음.
- **클러스터.** `k3d cluster create`로 server1+agent2 기동, k3s **v1.35.5+k3s1**. 4개 네임스페이스 Active.
  cluster.yaml에 k3s 이미지 핀 생략 → k3d 기본 이미지 사용(견고성 우선).
- **Helm 차트.** 3종 스캐폴드(values 전부 enabled:false) lint 통과. Phase별로 컴포넌트 활성화 예정.
- **이연(defer) 결정.** ① 공통 라이브러리(헬스/로그/오류) 코드는 소비 서비스가 생기는 Phase 3/4로 이연
  (현재 작성 시 speculative). ② Go/Python 서비스 Makefile 템플릿도 각 서비스 Phase에서 작성.
- **`.env.example` 가드.** Write/Bash 모두 `.env*` 시크릿 가드로 차단됨. 내용은 PLAN/세션에 확정되어 있으나
  **사용자가 직접 생성**해야 함(플레이스홀더만 포함, 실제 키 없음). CLAUDE.md §5와 동일.

## 메모 (Notes)

- PRD v2는 §1~§3(제품정의/아키텍처/LLM전략)까지만 작성됨. ERD·와이어프레임·API 명세 등 v1.x 상세 문서는
  `docs/prd/아카이브.zip`에 보관. 필요 시 참고하되 v2 정합성은 PRD v2 + CLAUDE.md 우선.
- CLAUDE.md §8 오류 처리 원칙 5번째 항목이 원문에서 잘려 있음("사용자에게 노출되는 오류 메시지는 절대...").
  구현 전 원문 보강 확인 필요.
- 헬스(§6)/로그(§7) 규격은 공통 라이브러리로 Phase 0에서 고정 → 모든 서비스 준용.
