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

## Phase 9 — Frontend (Loop 5)
- [ ] Login / Dashboard
- [ ] 프롬프트 입력 + Output Panel (멀티모달 탭)
- [ ] Catalog 검색 / Admin·Usage
- [ ] verify: 빌드 + 컴포넌트 테스트

## Phase 10 — Observability + E2E (Loop 6)
- [ ] `forgenta-obs`: Loki / Prometheus / Grafana / OTel
- [ ] verify: 3대 E2E 플로우 완료
