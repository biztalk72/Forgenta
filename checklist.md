> Forgenta v2 재구축 체크리스트. 진행하며 체크박스를 갱신한다. PLAN.md의 단계와 1:1 매핑.

# Forgenta v2 재구축 체크리스트

상태 범례: `[ ]` 미착수 · `[~]` 진행중 · `[x]` 완료(verify 통과)

## Phase 0 — Foundations
- [x] 저장소 트리 생성 (`infra/`, `services/`, `web/`, `db/migrations/`, `docs/adr/`, `docs/runbooks/`)
- [~] `.env.example` 작성 — 내용 확정. 단, 시크릿 가드로 에이전트가 쓸 수 없음 → 사용자 수동 생성 필요
- [x] 루트 `Makefile` (cluster-up/down/health/models)
- [ ] Go/Python 서비스 Makefile 템플릿 → 각 서비스 Phase로 이연 (현재 서비스 없음)
- [x] `infra/k3d/cluster.yaml` + `namespaces.yaml`
- [x] `infra/scripts/` (bootstrap/teardown/health-check/pull-models)
- [x] Helm 스캐폴드 3종 (`forgenta-infra`, `forgenta-core`, `forgenta-obs`) — lint 통과
- [ ] 공통 라이브러리: 헬스 핸들러(§6), JSON 로거(§7), 오류/폴백 인터페이스(§8) → Phase 3/4로 이연 (소비자 생길 때)
- [x] verify: k3d 클러스터 기동 + 4개 네임스페이스 Active 확인 ✅

## Phase 1 — Infra (Loop 1)
- [x] `forgenta-infra` 차트: PostgreSQL (TimescaleDB 2.27.2 + pgvector 0.8.2 검증)
- [x] Redis (7-alpine)
- [x] Qdrant
- [x] MinIO
- [x] `bootstrap.sh`, `health-check.sh`(infra pods 확장), `pull-models.sh`
- [x] verify: 4개 Pod Running/Ready + readiness probe 통과 ✅

## Phase 2 — Database (Loop 2)
- [x] 코어 스키마 마이그레이션 (workspace/users/role/workspace_member/agent/app/prompt_template)
- [x] artifact / usage_event(hypertable) / audit_log / approval / clone_lineage
- [x] 시드 데이터 (role 4 + default workspace + admin + owner 멤버십)
- [x] golang-migrate in-cluster Job 러너 (`infra/scripts/migrate.sh`, make migrate)
- [x] verify: 13 테이블 + usage_event 하이퍼테이블 + version 6 clean + 시드 확인 ✅

## Phase 3 — Identity + API Gateway (Loop 3a)
- [x] Go 워크스페이스(go.work) + 공통 모듈 `services/shared`(token/health/logging/httperr)
- [x] Identity-Svc: JWT 로그인/`/auth/me`, bcrypt, RBAC/워크스페이스 컨텍스트 (OIDC/SAML은 후속)
- [x] API Gateway: 라우팅(리버스 프록시), Rate Limiting(IP별), Auth Check 미들웨어
- [x] 단위 테스트 (shared/token 라운드트립, gateway/auth 미들웨어)
- [x] migration 000007: 관리자 dev 비밀번호(bcrypt) 시드
- [x] verify: 로그인→JWT→`/auth/me`(200) / 무토큰·오답(401) ✅ (로컬 실행 + port-forward DB)
- [x] 컨테이너화(Dockerfile) + forgenta-core 배포 → 완료(in-cluster verify)

## Phase 4 — Orchestration + Ollama (Loop 3b) ★
- [x] LangGraph StateGraph: router → executor (Planner/Critic/Summarizer 노드는 후속 확장)
- [x] ModelRouter 정책 구현 (민감/budget/code/quality, 폴백 체인 산출) + 단위 테스트 6
- [x] Ollama 연동(httpx) + SSE 스트리밍 응답 (STREAM-FIRST)
- [x] 폴백 체인 (클라우드 미구성 → 로컬로 폴백, fallback 이벤트 노출)
- [x] 게이트웨이 프록시(/api/orchestration/*, FlushInterval=-1) + JWT 보호
- [x] verify: 게이트웨이 경유 스트리밍 + quality:high 폴백 + /v1/run(graph) + 401 ✅
- [x] 컨테이너화 + 배포 → 완료(in-cluster verify). Planner/Critic/Summarizer 노드는 워크플로우 단계에서

## Phase 5 — Headroom Proxy (Loop 3c)  ✅
- [x] headroom-proxy Go 서비스: Kompress-base(text)/SmartCrusher(json)/CodeCompressor(code, 정규식 기반)
- [x] 토큰 추정 + safe/aggressive 모드 + invalid-json→text 폴백
- [x] 단위 테스트 4 + go.work 등록 + Makefile/Dockerfile
- [x] forgenta-core 배포 (in-cluster) + build-images.sh에 headroom 추가
- [x] verify: json safe 0.07 vs aggressive 0.29(null 제거), text 압축, invalid→text 폴백, compression_ratio 로그 ✅
- [ ] (선택) orchestration→headroom 연동(HEADROOM_ENABLED, 실패 시 무압축 폴백) → Phase 8 통합에서

## Phase 6 — Catalog + Artifact (Loop 3d)  ✅
- [x] Catalog-Svc: Agent CRUD + Clone(clone_lineage 기록). App/PromptTemplate은 동일 패턴 확장 예정
- [x] Artifact-Svc: OutputArtifact 저장/조회 + MinIO(PutObject/GetObject), 버킷 보장
- [x] go.work 등록, Makefile/Dockerfile, build/vet 통과
- [x] forgenta-core 배포(catalog 8003, artifact 8004) + 게이트웨이 서브트리 라우트(/api/catalog,/api/artifact)
- [x] verify: 게이트웨이 경유 Agent create/list/clone(계보 기록), Artifact 저장→content 라운드트립 ✅

## Phase 7 — Governance & Metering (Loop 3e)  ✅
- [x] governance-svc: UsageEvent 수집/집계, 승인 큐(create/list/decide), 감사 로그(트랜잭션 기록)
- [x] forgenta-core 배포(8005) + 게이트웨이 /api/governance/ 라우트
- [x] verify: usage summary(events/tokens/tokens_saved), 승인 create→approve→0 pending, audit(requested+approved) ✅
- [ ] 크레딧 정책 / MCP 계량 → 후속 (현재 usage 집계 + tokens_saved까지)

## Phase 8 — Integration (Loop 4)  ✅
- [x] orchestration→headroom 압축 연동 (HEADROOM_ENABLED, 실패 시 무압축 폴백)
- [x] orchestration→governance UsageEvent 자동 기록 (fault-tolerant, 스트림 완료 시)
- [x] `infra/scripts/integration-test.sh` + `make integration-test`
- [x] verify: 6/6 통과 (게이트웨이 라우팅, Orchestration→Ollama, Metering UsageEvent, Catalog CRUD, 인증 401) ✅

## Phase 9 — Frontend (Loop 5)  ✅
- [x] React+Vite+TS + Mantine. Login / Dashboard / Catalog / Admin (full dashboard)
- [x] 프롬프트 → SSE 스트리밍 Output Panel (Text/Raw/Events 탭 + 투명성 상태바)
- [x] Catalog 검색/생성/Clone/삭제, Admin Usage 집계 + 승인 큐
- [x] verify: 빌드(tsc+vite) 성공 + 컴포넌트 테스트 1 통과 ✅
- [x] 컨테이너화(nginx) + forgenta-ui 배포: SPA 서빙 + /api 프록시→게이트웨이 검증 ✅
- [x] Traefik Ingress 노출: http://localhost:8080 (port-forward 불요) — index/SPA/API 검증 ✅

## Phase 10 — Observability + E2E (Loop 6)  ✅
- [x] `forgenta-obs`: Loki + promtail(파드 로그 tail) + Grafana(Loki 데이터소스). 로그 인제스트 검증
- [x] E2E 스크립트(`infra/scripts/e2e-test.sh`, make e2e-test): web(nginx)→게이트웨이 3대 플로우
- [x] verify: E2E 7/7 (로그인→스트리밍, 카탈로그 검색→clone, admin usage+승인) ✅
- [x] bug fix: integration-test 포트 경합(8000 Docker 점유) 플레이키 → 18080 + /health 폴링으로 수정
- [ ] Prometheus 메트릭 → 후속 (서비스 /metrics 계측 필요). 현재 obs는 로그 중심.
- [ ] OTel 트레이싱 → 후속

# Forgenta v3 체크리스트 (Workflow Fabric — PLAN.md §5 / CLAUDE.md Loop 7 매핑)
> v3 MVP = Phase 11~14. PRD: `docs/prd/Forgenta PRD v3.md`. Warp 플랜 `plan_id e7a37d0d`.

## Phase 11 — v3 데이터 파운데이션 (Loop 2 확장)
- [ ] `db/migrations/000008_workflow.up.sql`/`.down.sql`: `workflow` / `workflow_run` / `workflow_step_run`
- [ ] 인덱스 (workspace별 목록, run별 step 조회)
- [ ] verify: `make migrate` 후 신규 3 테이블 + migration version 8 clean

## Phase 12 — workflow-svc + Compiler (Loop 3 확장)
- [ ] `services/workflow-svc`(Go, catalog-svc 패턴, 8006): workflow/run CRUD + clone(`entity_type='workflow'`)
- [ ] 내부 write API: `POST /v1/runs`, `PATCH /v1/runs/{id}`, `POST /v1/runs/{id}/steps`, `PATCH /v1/steps/{id}`
- [ ] 게이트웨이 `/api/workflow/` 서브트리 프록시 + `WORKFLOW_URL` / go.work / Helm(`workflow.*`,8006) / `workflow-svc.yaml` / build-images.sh
- [ ] orchestration `app/compiler.py` + `POST /v1/workflows/compile` (SSE plan/step)
- [ ] verify: workflow CRUD + clone 계보, compile SSE steps≥2 + spec이 PRD §6.A 스키마 valid(검증 실패 시 재시도)

## Phase 13 — Workflow Runtime (Loop 3/4)
- [ ] orchestration `app/runtime.py`: 단계 실행(ModelRouter+providers.stream 재사용) + blackboard context handoff
- [ ] `POST /v1/workflows/{id}/run`(SSE) + `POST /v1/runs/{id}/cancel`, 누적 컨텍스트 headroom 압축
- [ ] 단계 종료마다 workflow-svc step write + governance usage 기록
- [ ] verify: 2단계 run → step_run 2건 + context handoff + done 이벤트

## Phase 14 — 단계 승인 HITL (Loop 3e/4)
- [ ] governance approval 재사용(`resource_type='workflow_step_run'`) + audit 컨텍스트
- [ ] `awaiting_approval` 정지 → `POST /v1/runs/{id}/resume` 재개 / reject halt
- [ ] 프론트 `/workflows`+`/runs`(검색·compile·타임라인·live SSE·approve/reject/resume), `lib/stream` 확장
- [ ] DESIGN.md 준수(Mantine 재사용): light/dark 토글·semantic token, 반응형 375/768/1024/1440, 모션 150~320ms, WebGL enhancement-only, 접근성 floor(focus/keyboard/reduced-motion). CLAUDE.md §3.5
- [ ] verify: approval 생성/정지 → approve resume, reject halt + integration/e2e 워크플로우 플로우 추가

## Phase 15~17 — 후속 증분 (MVP 이후)
- [ ] Phase 15 — Connectors + 외부 산출: `connector`(`gworkspace`/`gmail`/`outlook`/`browser`=Playwright MCP/HTTP/MCP, `secret_ref`) + OAuth 최소 스코프(drive.file/gmail.send/Mail.Send). Output/Export 노드(`POST /v1/runs/{id}/export` → Docs/Sheets/Slides/Drive·메일, `external_file_ref`/audit). 입력 트리거: Gmail/Outlook 신규 메일. 착수순서 Google→메일→Playwright MCP(도메인 allowlist+격리). (Obsidian은 v3.3에서 제외)
- [ ] Phase 16 — 학습/이상탐지: `workflow_memory`+Qdrant RAG, `alert`/`alert_rule`
- [ ] Phase 17 — 스케줄/UI: `workflow_schedule`+스케줄러, `/connectors`, Admin 관측/알림/개선지표
