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

# Forgenta v3.4 체크리스트 — DGX Spark 런타임 재배치 (Phase D0~D5)
> PRD: `docs/prd/Forgenta PRD v3.4.md` (v3.2 + DGX 프로필 합본). 브랜치 `feat/v3.4-dgx-rebuild`.
> v3.4 MVP = **Phase D0~D5 + Phase 11~14**. D 시리즈가 11번 시리즈에 **선행**.

## Phase D0 — 호스트 사전점검 (DGX 프로필)
- [x] GB10 GPU + CUDA 13 + nvidia-ctk 1.19 확인
- [x] go 1.26.4 (apt 1.22 + go.work `toolchain` 디렉티브 자동 다운로드 고정)
- [x] `hf` (HuggingFace CLI 1.20) 설치 — `--break-system-packages` 경유
- [x] 9 Go 서비스 build+vet 통과 (api-gateway/identity-svc/orchestration-svc/headroom-proxy/catalog-svc/artifact-svc/governance-svc/inference-gateway/shared)
- [x] nvidia-ctk runtime configure (containerd/k3s 경유 발효 — `runtimeClassName: nvidia` 로 dcgm-exporter Pod 가동, commit 4fc747a)
- [x] /var/lib/forgenta/{models,postgres,qdrant,minio} 디렉터리 생성 (hf/ollama/trtllm/vllm 서브디렉터리 ready, 2026-06-23 확인)
- [~] verify: `docker run --rm --gpus all nvcr.io/nvidia/cuda:13.0.0-base-ubuntu24.04 nvidia-smi` → k3s native 채택으로 docker 경로는 미사용(PRD v3.4 §16.2 fallback). 대신 k3s 인-클러스터 Pod 에서 GB10 노출 검증 — D1 verify 항목 참조.

## Phase D1 — k3d + NVIDIA device plugin (GPU passthrough)
- [x] cluster.yaml ARM64 image pin + hostPath /var/lib/forgenta/models 마운트
- [x] namespaces.yaml에 `forgenta-llm` 추가 (5개)
- [x] infra/k3d/nvidia-device-plugin.yaml (vendored DaemonSet)
- [x] bootstrap.sh DGX 분기 (GB10 감지 → --gpus all + device plugin install + rollout 대기)
- [x] k3s native + device plugin v0.17.4 — `kubectl describe node | grep nvidia.com/gpu` = 1 ✅ (commit 4fc747a, 2026-06-23 재확인)
- [x] verify: GPU 패스스루 Pod — dcgm-exporter (`runtimeClassName: nvidia` + `nvidia.com/gpu:1`) 가 GB10 NVML 메트릭 13종 export (driver 580.159.03, temp 39C, idle power 4.46W). nvidia-smi 등가 검증 ✅

## Phase D2 — Inference Stack (vLLM + Ollama fallback)
- [x] infra/helm/forgenta-llm 차트 (Chart.yaml + values + _helpers.tpl)
- [x] vllm-{planner,executor,router,summarizer,embed} 템플릿 (planner+ollama 1차 enable, 나머지 D2-second에서)
- [x] Ollama 폴백 (init 컨테이너로 qwen3:1.7b/8b pre-pull)
- [x] priorityClass `llm-critical`
- [x] pull-models-dgx.sh (hf download, Planner/Executor/Router/Summarizer/Embed)
- [x] helm lint clean
- [ ] 클러스터 배포 후 `/v1/models` 노출 + SSE 토큰 수신 + DCGM util > 0

## Phase D3 — services/inference-gateway (Go, 8800)
- [x] cmd/main + config + router(glob+fallback) + proxy(SSE pass-through+5xx detect) + server(OpenAI-호환 + sensitive 가드) + metrics(Prom)
- [x] go.work 등록, build/vet/test 통과 (router_test 3/3)
- [x] forgenta-core/templates/inference-gateway.yaml (Deployment+Service ClusterIP+ConfigMap 라우팅)
- [x] values-dgx.yaml에서 enable, build-images.sh 배선
- [x] 비GPU in-cluster 가동 검증: /health 200, unknown→404, claude→403, vllm-planner→502(no backend)
- [x] Prom 메트릭 수집 확인 (`route_decisions_total`, `requests_total{status=404/403/502}`)
- [ ] vLLM 백엔드 가동 후 정상 라우팅 + fallback 시나리오 (D2 후)

## Phase D4 — orchestration-svc 재배선
- [x] config.py: INFERENCE_GATEWAY_URL + planner/summarizer/embed/critic 기본값 (v3.4 §3.5)
- [x] providers.py: ig OpenAI-호환 SSE + sensitive 헤더 전파 + ollama 직접 폴백
- [x] router.py: planner/long_context + `_is_local`에 vllm/nim/trtllm 추가
- [x] main.py: ready aggregate(ig+ollama), ttft_ms+backend usage_event 필드
- [x] orchestration-svc.yaml에 신규 모델 env 옵셔널 분기
- [x] router_test 7/7 통과 (DGX + Mac 베이스라인 동시)
- [x] in-cluster 가동: `/health/ready` 200, 신규 image rollout 성공
- [ ] integration-test 갱신 (backend=vllm usage_event 기록)

## Phase D5 — Observability + SLO 게이트
- [x] forgenta-obs 차트에 Prometheus + DCGM Exporter + Grafana Prom 데이터소스 + 대시보드 provisioning
- [x] gpu-inference.json (TTFT p95<0.7s SLO 임계, KV cache, fallback rate, GPU util/mem/power)
- [x] Prometheus scrape configs (dcgm-exporter, vllm, inference-gateway)
- [x] helm lint clean. 비GPU 부분 가동(Prom+Grafana Running)
- [x] DCGM Exporter 4.1.1 가동 ✅ (3.x → 4.1.1 승격으로 GB10 인식, 13 DCGM_FI 시계열 export, Prometheus targets up — commit 4fc747a)
- [ ] verify: TTFT p95 < 0.7s, Executor 32B ≥ 60 tok/s, e2e GPU 회귀 케이스 (vLLM 백엔드 가동 후)

## Phase D6 (선택) — NIM / TensorRT-LLM 승격
- [ ] Planner/Executor 안정화 후 NGC NIM 또는 TRT-LLM 엔진 빌드
- [ ] inference-gateway 라우팅 테이블 swap 무중단

## Phase D7 (선택) — 2-DGX 클러스터
- [ ] 2번째 노드 추가, vLLM `--tensor-parallel-size 2`로 120B+ 서빙

---

# Forgenta v3 체크리스트 (Workflow Fabric — PLAN.md §5 / CLAUDE.md Loop 7 매핑)
> v3 MVP = Phase 11~14. PRD: `docs/prd/Forgenta PRD v3.md` + `docs/prd/Forgenta PRD v3.4.md`. Warp 플랜 `plan_id e7a37d0d`.

## Phase 11 — v3 데이터 파운데이션 (Loop 2 확장)
- [x] `db/migrations/000008_workflow.up.sql`/`.down.sql`: `workflow` / `workflow_run` / `workflow_step_run` (merge: main `dab88e2`, PR #3)
- [x] 인덱스 (workspace별 목록, run별 step 조회)
- [x] enum 정합 v3.4: `kind` CHECK(`llm|tool|approval|export`) + `workflow_run.status` `pending` + `source` `nl|demo|manual`
- [x] verify ✅ (2026-06-20): `make migrate-down && make migrate` 재적용 후 version 8 clean + 3 테이블 +
      `workflow_step_run_kind_check`(llm|tool|approval|export) + `workflow_run.status`에 pending 확인.
      (부수 수정: `infra/scripts/migrate.sh`가 `"down 1"`을 단일 인자로 넘기던 버그 → 토큰 분리하도록 수정)

## Phase 12 — workflow-svc + Compiler (Loop 3 확장) ✅
- [x] `services/workflow-svc`(Go, catalog-svc 패턴, 8006): workflow/run CRUD + clone(`entity_type='workflow'`) (merge: main `645852f`, PR #8)
- [x] 내부 write API: `POST /v1/runs`, `PATCH /v1/runs/{id}`, `POST /v1/runs/{id}/steps`, `PATCH /v1/steps/{id}`
- [x] 게이트웨이 `/api/workflow/` 서브트리 프록시 + `WORKFLOW_URL` / go.work / Helm(`workflow.*`,8006) / `workflow-svc.yaml` / build-images.sh
- [x] orchestration `app/compiler.py` + `POST /v1/workflows/compile` (SSE plan/step). compiler 단위 7건 PASS
- [x] migration 000009: `clone_lineage.entity_type` CHECK 에 `workflow` 추가 (workflow 클론 lineage 기록 가능)
- [x] verify ✅ (2026-06-22): workflow CRUD + clone(계보 row 작성) + compile SSE valid 2-step spec, §6.A 스키마 통과

## Phase 13 — Workflow Runtime (Loop 3/4)
- [x] orchestration `app/runtime.py`: 단계 순차 실행 — `_parse_steps`/`_resolve_input_map`/`_build_llm_messages` + blackboard handoff(`context.<key>` 참조)
- [x] `POST /v1/workflows/{id}/run` SSE — `run.started → (step.started → token* → step.done)+ → run.done`. Cancel 은 후속 (long-poll Cancel 미구현)
- [x] 단계별 workflow-svc write: `POST /v1/runs` → `POST /v1/runs/{id}/steps` → `PATCH /v1/steps/{id}` (best-effort, 실패해도 진행)
- [x] governance `record_usage` 단계별 호출. config.WORKFLOW_URL + 게이트웨이 `POST /api/orchestration/v1/workflows/{id}/run` 라우트 추가
- [x] approval 단계: `awaiting_approval` SSE emit 후 중단 (Phase 14 가 row 작성/resume 책임)
- [x] runtime_test 6/6 PASS (parse 정렬·기본값·input_map 해석·prompt build·truncate)
- [x] in-cluster verify ✅ (2026-06-23): 2-step run → `workflow_step_run` 2건 (status=succeeded, tokens=9+13, latency 측정) +
      blackboard handoff (`context_keys=["greeting","bye"]`, step2 가 step1 출력 참조) + `run.done status=succeeded`.
      부수 발견: status enum 미스매치 — runtime 이 `completed` 를 보내면 schema CHECK(`succeeded|...`) 가 거부 → `succeeded` 로 수정

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
