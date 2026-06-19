> Forgenta v2 재구축 플랜. PRD v2 + CLAUDE.md를 단일 진실 소스로 하는 단계별 빌드 계획.

# Forgenta v2 재구축 플랜 (Rebuild Plan)

Version: 2.0 | Date: 2026-06-19 | Baseline commit: `8833013` (v2 baseline) | Archive: `archive/v1-fastapi`

---

## 0. 무엇을, 왜 (What & Why)

v1(FastAPI + ChromaDB + AWS ECS/Fargate)을 `archive/v1-fastapi` 브랜치로 보존하고, `main`을
PRD v2가 정의하는 **하이브리드 에이전틱 AI 플랫폼**으로 처음부터 다시 빌드한다.

목표 아키텍처는 v1과 완전히 다르다.
- 런타임: MacOS + k3d(경량 k3s) + Helm + Ollama(Metal)
- 백엔드: Go 마이크로서비스 6종 + Python/LangGraph 오케스트레이션 1종
- 데이터: PostgreSQL(pgvector + TimescaleDB), Redis, Qdrant, MinIO
- 관측: Loki, Prometheus, Grafana
- 프론트: React + Vite

코어 파이프라인: 입력 → 해석 → 워크플로우 실행 → 멀티모달 결과 → 카탈로그화 → 거버넌스.

---

## 1. 설계 원칙 적용 (Guiding Constraints)

- **Simplicity First (CLAUDE.md §2).** 7개 서비스를 한 번에 만들지 않는다. 가치가 흐르는
  얇은 수직 슬라이스(입력 → 오케스트레이션 → 스트리밍 결과)를 먼저 완성하고 서비스를 확장한다.
- **Loop Harness (CLAUDE.md §3).** 모든 단계는 WRITE → BUILD → TEST → VERIFY 루프를 따르고,
  검증 기준을 통과하지 못하면 다음 단계로 넘어가지 않는다.
- **공통 규격을 먼저 고정한다.** 헬스 엔드포인트(§6), JSON 로그(§7), 오류 처리(§8),
  Go/Python Makefile 패턴(§4)을 Phase 0에서 합의하고 모든 서비스가 준용한다.

---

## 2. 단계별 플랜 (Phased Plan)

각 단계는 CLAUDE.md의 Loop 번호에 매핑된다. `verify`를 통과해야 단계 완료로 본다.

### Phase 0 — Foundations (선행)
저장소 골격과 공통 규격을 세운다.
- `infra/`, `services/`, `web/`, `db/migrations/`, `docs/adr/`, `docs/runbooks/` 트리 생성.
- `.env.example`(CLAUDE.md §5 전체 변수), 루트 `Makefile`, Go/Python 서비스 Makefile 템플릿.
- `infra/k3d/cluster.yaml`, Helm 차트 스캐폴드 3종(`forgenta-infra`/`core`/`obs`).
- 공통 라이브러리: 헬스 핸들러, 구조화 JSON 로거, 오류/폴백 체인 인터페이스.
- **verify:** `k3d cluster create`로 클러스터 기동, 4개 네임스페이스 생성 확인.

### Phase 1 — Infra (Loop 1)
`forgenta-infra` Helm 차트로 데이터 계층 배포.
- PostgreSQL(pgvector + TimescaleDB), Redis, Qdrant, MinIO.
- `infra/scripts/bootstrap.sh`, `health-check.sh`, `pull-models.sh`.
- **verify:** 모든 Pod Running, 각 헬스 엔드포인트 200 OK.

### Phase 2 — Database (Loop 2)
golang-migrate 마이그레이션으로 코어 스키마 구축.
- 테이블: workspace, user, role, agent, app, prompt_template, artifact,
  usage_event(TimescaleDB hypertable), audit_log, approval, clone_lineage.
- **verify:** 모든 테이블 존재, 시드 데이터 적재 확인.

### Phase 3 — Identity + API Gateway (Loop 3a)
인증/인가와 단일 진입점.
- Identity-Svc(Go): OIDC/JWT, RBAC, 워크스페이스 컨텍스트.
- API Gateway(Go): 라우팅, Rate Limiting, Auth Check, 응답 집계.
- **verify:** 로그인 → JWT 발급 → 게이트웨이가 보호된 요청을 라우팅.

### Phase 4 — Orchestration + Ollama (Loop 3b) ★수직 슬라이스 핵심
LangGraph 오케스트레이션과 로컬 LLM 연동.
- Orchestration-Svc(Python): Planner/Executor/Critic/Summarizer/Router 노드 분리.
- ModelRouter 정책(민감데이터 로컬 전용, budget < 20% 폴백, 코드→Coder 등).
- Ollama 연동(host.k3d.internal:11434), **스트리밍 응답**(STREAM-FIRST).
- **verify:** 프롬프트 입력 → 라우팅 → LLM 스트리밍 결과 수신, 폴백 체인 동작.

### Phase 5 — Headroom Proxy (Loop 3c)
컨텍스트 압축 프록시.
- SmartCrusher(JSON), CodeCompressor(AST), Kompress-base(text), 토큰 계량.
- **verify:** compression_ratio 로그 기록, safe/aggressive 모드, 폴백 정상.

### Phase 6 — Catalog + Artifact (Loop 3d)
카탈로그화와 멀티모달 결과 저장.
- Catalog-Svc(Go): Agent/App/PromptTemplate CRUD, Clone/Use/Edit/Move, CloneLineage.
- Artifact-Svc(Go): OutputArtifact 저장/조회, MinIO, Text/Table/CSV/Image/SVG/2D/3D.
- **verify:** Catalog CRUD + Clone 계보 기록, Artifact 저장/조회 라운드트립.

### Phase 7 — Governance & Metering (Loop 3e)
거버넌스와 계량.
- Approval queue, AuditLog, UsageEvent 수집, 크레딧 정책, MCP 계량.
- **verify:** UsageEvent 기록 확인, 승인 큐 플로우, 감사 로그 적재.

### Phase 8 — Integration (Loop 4)
서비스 간 배선과 통합 테스트.
- **verify (CLAUDE.md §3 Loop 4):** Gateway→각 서비스 라우팅, Orchestration→Ollama,
  Metering UsageEvent 기록, Catalog CRUD 정상.

### Phase 9 — Frontend (Loop 5)
React + Vite 대시보드. PRD v2 5대 원칙 반영.
- Login, Dashboard, 프롬프트 입력 + **Output Panel**(OUTPUT-CENTRIC, 탭 전환),
  Catalog 검색(SEARCH-BEFORE-BUILD), Admin/Usage(TRANSPARENCY).
- **verify:** 빌드 성공, 컴포넌트 테스트 통과.

### Phase 10 — Observability + E2E (Loop 6)
관측 스택과 종단 검증.
- `forgenta-obs` Helm: Loki/Prometheus/Grafana, OTel 수집.
- **verify (CLAUDE.md §3 Loop 6):** 로그인→Dashboard→프롬프트→결과 플로우,
  Catalog 검색→Agent 실행 플로우, Admin→Usage 조회 플로우 완료.

---

## 3. 성공 기준 (Definition of Done)

- `bash infra/scripts/bootstrap.sh` → `health-check.sh`가 모두 200 OK.
- 7개 서비스 단위 테스트 통과 + 이미지 빌드 성공.
- `make integration-test`, `make e2e-test` 통과.
- 프론트 빌드/테스트 통과, 3대 E2E 플로우 완료.

## 4. 미해결 결정 사항 (Open Decisions — 빌드 중 확정)

`context-notes.md`의 "결정 대기" 섹션에서 추적한다. 핵심: 수직 슬라이스 범위 확정,
Ollama 모델 실제 풀 대상(RAM 제약), 시크릿 관리 방식, Helm 차트 분리 단위.

---

## 5. Forgenta v3 플랜 (Agentic Operations — Workflow Fabric)
> PRD v3(`docs/prd/Forgenta PRD v3.md`)를 단일 진실 소스로 하는 v3 확장 플랜. Warp 플랜
> `plan_id e7a37d0d-68af-42b1-9434-8576305b7a99`를 markdown으로 materialize한 것. v2와 동일하게
> Loop Harness(WRITE→BUILD→TEST→VERIFY) + verify 게이트를 따른다.

### 5.0 무엇을, 왜
v2(단발성 에이전트)를 확장해 **자연어로 작성 → 검토/승인 → 여러 에이전트가 공유 컨텍스트로 핸드오프하며
종단 실행**되는 다단계 워크플로우를 추가한다. 1차 목표는 PRD v3 §13의 MVP 슬라이스(Phase 11~14)다.

### 5.1 Loop 매핑
v3 단계는 CLAUDE.md §3 **Loop 7**(워크플로우 수직 슬라이스)에 매핑되며, 내부적으로
Loop 2(DB)/Loop 3(서비스)/Loop 4(통합)/Loop 5(프론트)/Loop 6(E2E)를 재사용한다.

### Phase 11 — 데이터 파운데이션 (Loop 2 확장)
- `db/migrations/000008_workflow.up.sql`/`.down.sql`: `workflow`, `workflow_run`, `workflow_step_run` 3개 테이블.
- `workflow`(workspace FK/name/description/spec JSONB/source/status/version/created_by/ts),
  `workflow_run`(workflow FK/workspace_id/status/trigger/context JSONB/summary/started_at/finished_at),
  `workflow_step_run`(run_id/step_seq/kind/agent_id/status/input JSONB/output_artifact_id/tokens/latency/error/approval_id).
- **verify:** `make migrate` 후 신규 3개 테이블 + migration version 8 clean.

### Phase 12 — workflow-svc + Compiler (Loop 3 확장)
- `services/workflow-svc`(Go, catalog-svc 패턴, 포트 8006): workflow/run CRUD + clone(clone_lineage `entity_type='workflow'`)
  + 오케스트레이션용 내부 write API(`POST /v1/runs`, `PATCH /v1/runs/{id}`, `POST /v1/runs/{id}/steps`, `PATCH /v1/steps/{id}`).
- 게이트웨이 `/api/workflow/` 서브트리 JWT 프록시 + `WORKFLOW_URL`. `go.work`/Helm(`workflow.*`, port 8006)/`workflow-svc.yaml`/`build-images.sh` 배선.
- orchestration `app/compiler.py`: NL 설명 → `workflow.spec` JSON, SSE `plan`/`step`. `app/main.py`에 `POST /v1/workflows/compile`.
- **verify:** workflow-svc build/vet, 게이트웨이 경유 workflow CRUD + clone 계보, compile SSE가 steps≥2 유효 spec 반환.

### Phase 13 — Workflow Runtime (Loop 3/4)
- orchestration `app/runtime.py`: spec steps 실행, 단계별 기존 `ModelRouter`+`providers.stream` 재사용.
  `workflow_run.context`(blackboard) 유지 + 단계 간 handoff, 누적 컨텍스트는 `integrations.compress`로 압축.
- `app/main.py`에 `POST /v1/workflows/{id}/run`(SSE: meta/plan/step_start/token/handoff/step_done/fallback/done) + `POST /v1/runs/{id}/cancel`.
  단계 종료마다 workflow-svc step write + governance usage 기록.
- **verify:** 2단계 run → step_run 2건 + context handoff + done 이벤트.

### Phase 14 — 단계 승인 HITL (Loop 3e/4)
- governance `approval` 재사용: `resource_type='workflow_step_run'`, `resource_id=step_run_id`. 감사 로그에 workflow/run/step 컨텍스트.
- `requires_approval=true` 단계는 step_run을 `awaiting_approval`로 저장 + approval 생성 후 정지. orchestration `POST /v1/runs/{id}/resume`로 재개.
- 프론트(`web/src`): `/workflows`(검색→설명→compile→검토/저장), `/runs`(타임라인·live SSE·approve/reject/resume). `lib/stream.streamCompile`/`streamRun`.
- **verify:** approval 생성/정지 → approve 후 resume 완료, reject 후 halt. integration/e2e에 워크플로우 플로우 추가 + 기존 회귀 유지.

### Phase 15~17 — 후속 증분 (MVP 이후)
- Phase 15 — Connectors: `connector` 테이블 + HTTP/MCP 커넥터(자격증명 `secret_ref`), Playwright 브라우저는 격리 모델 확정 후.
- Phase 16 — 학습 + 이상탐지: `workflow_memory`+Qdrant RAG 학습 루프, `alert`/`alert_rule` 이상탐지/알림.
- Phase 17 — 스케줄 + UI: `workflow_schedule`+스케줄러, `/connectors` 페이지, Admin 관측/알림/개선지표.

### 5.2 오케스트레이션 (병렬 빌드 전략)
- 실행 = **local**. **Foundation**(Phase 11 + Phase 12의 계약/스켈레톤: 000008 마이그레이션 + workflow-svc 스켈레톤
  + gateway 라우트 + go.work/Helm/build 자리)을 오케스트레이터가 순차 완료.
- 이후 **4개 자식 에이전트 병렬**(각자 worktree+branch): `wf-svc`(services/workflow-svc·gateway·Helm/build),
  `orch-ext`(orchestration-svc/app), `gov-ext`(governance-svc), `frontend`(web/src). 단일 PR로 통합.
- Claude Code 단독 진행 시: Foundation → Phase 12 → 13 → 14 순차(각 verify 게이트 통과 필수).

### 5.3 v3 성공 기준 (Definition of Done)
- `make migrate`(v8) + workflow-svc build/test + 이미지 빌드 성공.
- compile SSE 유효 spec, 2단계 run handoff, 단계 승인 resume/halt 동작.
- `make integration-test`/`make e2e-test`에 워크플로우 플로우 추가 후 통과 + 기존 회귀 유지.
