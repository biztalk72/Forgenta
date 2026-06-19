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
- [ ] `forgenta-infra` 차트: PostgreSQL(pgvector + TimescaleDB)
- [ ] Redis
- [ ] Qdrant
- [ ] MinIO
- [ ] `bootstrap.sh`, `health-check.sh`, `pull-models.sh`
- [ ] verify: 모든 Pod Running + 헬스 200 OK

## Phase 2 — Database (Loop 2)
- [ ] 코어 스키마 마이그레이션 (workspace/user/role/agent/app/prompt_template)
- [ ] artifact / usage_event(hypertable) / audit_log / approval / clone_lineage
- [ ] 시드 데이터
- [ ] verify: 테이블 존재 + 시드 확인

## Phase 3 — Identity + API Gateway (Loop 3a)
- [ ] Identity-Svc: OIDC/JWT, RBAC, 워크스페이스 컨텍스트
- [ ] API Gateway: 라우팅, Rate Limiting, Auth Check, 응답 집계
- [ ] 단위 테스트
- [ ] verify: 로그인 → JWT → 보호 요청 라우팅

## Phase 4 — Orchestration + Ollama (Loop 3b) ★
- [ ] LangGraph 노드: Planner/Executor/Critic/Summarizer/Router
- [ ] ModelRouter 정책 구현
- [ ] Ollama 연동 + 스트리밍 응답
- [ ] 폴백 체인
- [ ] verify: 프롬프트 → 스트리밍 결과 + 폴백 동작

## Phase 5 — Headroom Proxy (Loop 3c)
- [ ] SmartCrusher(JSON) / CodeCompressor(AST) / Kompress-base(text)
- [ ] 토큰 계량 + safe/aggressive 모드
- [ ] verify: compression_ratio 로그 + 폴백 정상

## Phase 6 — Catalog + Artifact (Loop 3d)
- [ ] Catalog-Svc: CRUD, Clone/Use/Edit/Move, CloneLineage
- [ ] Artifact-Svc: OutputArtifact 저장/조회, MinIO, 멀티모달 타입
- [ ] verify: Catalog CRUD+Clone, Artifact 라운드트립

## Phase 7 — Governance & Metering (Loop 3e)
- [ ] Approval queue / AuditLog / UsageEvent / 크레딧 정책 / MCP 계량
- [ ] verify: UsageEvent 기록 + 승인 플로우 + 감사 로그

## Phase 8 — Integration (Loop 4)
- [ ] 서비스 간 배선
- [ ] `make integration-test`
- [ ] verify: Loop 4 기준 4종 통과

## Phase 9 — Frontend (Loop 5)
- [ ] Login / Dashboard
- [ ] 프롬프트 입력 + Output Panel (멀티모달 탭)
- [ ] Catalog 검색 / Admin·Usage
- [ ] verify: 빌드 + 컴포넌트 테스트

## Phase 10 — Observability + E2E (Loop 6)
- [ ] `forgenta-obs`: Loki / Prometheus / Grafana / OTel
- [ ] verify: 3대 E2E 플로우 완료
