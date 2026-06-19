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

### 2026-06-19 — Phase 2 완료 (verify 통과)
- **스키마 근거.** PRD v2 서비스 맵에서 최소 스키마 도출(아카이브 v1 ERD 미사용). 6개 마이그레이션:
  init_extensions / core_identity / catalog / artifact / governance_metering / seed.
- **테이블 13종.** workspace, users, role, workspace_member, agent, app, prompt_template,
  clone_lineage, artifact, approval, audit_log, usage_event(+schema_migrations).
- **하이퍼테이블.** `usage_event`를 `create_hypertable(...,'time')` 레거시 시그니처로 변환(2.27에서 동작).
  FK 생략(인제스트 성능), PK=(time,id).
- **마이그레이션 실행 방식.** 로컬 migrate CLI 대신 in-cluster Job(`migrate/migrate` 이미지 + ConfigMap 마운트).
  CLAUDE.md Loop 2 스니펫은 볼륨 마운트가 빠져 있어 `infra/scripts/migrate.sh`로 보완.
- **시드 사용자.** 실제 개인 이메일 대신 `admin@forgenta.local` 사용(커밋 데이터에 PII 미포함).
- **Go 설치 완료.** `brew install go` → go1.26.4 (/opt/homebrew/bin). Phase 3 차단 해제.

### 2026-06-19 — Phase 3 완료 (verify 통과)
- **Go 레이아웃.** `go.work` + 모듈 3종(`services/shared`, `identity-svc`, `api-gateway`).
  consumer go.mod에 `replace github.com/forgenta/shared => ../shared` 추가(go.work 없이/Docker 빌드 대비).
- **공통 모듈.** Phase 0에서 이연했던 헬스(§6)/JSON 로거(§7, time→ts)/httperr(§8)를 `services/shared`에 구현.
  JWT 발급/검증은 `shared/token`에 두어 identity(발급)·gateway(검증)가 공유. 의존: golang-jwt/jwt v5.
- **Identity-Svc.** pgxpool + bcrypt. `/auth/login`(이메일/비번→JWT), `/auth/me`(클레임 조회). 첫 멤버십을
  워크스페이스/역할로 사용. OIDC/SAML은 MVP 범위 밖 → 후속.
- **API Gateway.** stdlib ServeMux 메서드 라우팅 + httputil 리버스 프록시(/api/identity→identity-svc).
  Rate Limiting은 IP별 x/time/rate 토큰버킷(20rps/burst40). Auth 미들웨어가 JWT 검증 후 X-User-Id/X-Workspace-Id/X-Role 주입.
- **검증 방식.** 로컬 `go run` 2개 + `kubectl port-forward svc/postgresql`로 e2e 확인. 컨테이너화/배포는 이연.
- **dev 비밀번호.** migration 000007에서 admin@forgenta.local에 bcrypt('forgenta') 설정(dev 전용). $2y$ 해시는 Go bcrypt 호환.
- **zsh 주의.** Bash 도구 셸이 zsh → 따옴표 없는 변수 단어분리 안 됨. curl 플래그는 인라인으로.

### 2026-06-19 — Phase 4 완료 (verify 통과). 결정 대기 #2 해소
- **모델 세트.** 결정대로 `qwen3:8b`(executor) + `qwen3:1.7b`(router/summarizer)만 풀. ollama에 기존 대형
  모델(qwen3-coder:30b, qwen3.5:27b, gemma4) 존재하나 슬라이스는 경량 2종만 사용. 결정 대기 #2 해소.
- **언어/런타임.** Python 3.12 venv 사용(3.14는 wheel 위험으로 회피). LangGraph 0.2+ 정상 설치.
- **구성.** FastAPI. `app/router.py`(정책, 순수·테스트됨), `app/providers.py`(Ollama 스트리밍 + 클라우드 Unavailable),
  `app/graph.py`(LangGraph router→executor, /v1/run), `app/main.py`(SSE /v1/chat/stream + /v1/run + 헬스).
- **스트리밍 vs 그래프.** 토큰 스트리밍 경로는 providers.stream을 직접 사용(LangGraph 토큰 스트리밍 복잡도 회피),
  /v1/run은 그래프 ainvoke로 노드 분리 데모. 둘 다 router+providers 공유.
- **폴백 검증.** quality:high → [claude, gemini, qwen3:8b]. 클라우드 키 없음 → Unavailable → fallback 이벤트 후
  qwen3:8b 성공. 클라우드 프로바이더는 Phase 4에서 스텁(Unavailable). 실제 호출은 후속.
- **계량 메모.** usage는 §7 JSON 로그로만 기록(완료 시 model/tokens/latency). DB UsageEvent 기록은 Phase 7.
- **게이트웨이.** 스트리밍 위해 ReverseProxy.FlushInterval=-1. /api/orchestration/* JWT 보호.

### 2026-06-19 — 컨테이너화 + k3d 배포 (3개 서비스 in-cluster)
- **이미지.** Go 2종: 멀티스테이지(golang:1.26 → distroless/static), repo 루트 컨텍스트로 shared 모듈 포함.
  Python: python:3.12-slim. 모두 linux/arm64. 로컬 레지스트리 없이 `k3d image import` + imagePullPolicy: IfNotPresent.
- **forgenta-core 배포.** identity-svc/orchestration-svc/api-gateway Deployment+Service. 게이트웨이는 in-namespace
  DNS(identity-svc:8001, orchestration-svc:8002)로 라우팅. DB는 cross-ns(postgresql.forgenta-infra.svc...),
  Ollama는 host.k3d.internal:11434.
- **헬퍼.** `infra/scripts/build-images.sh`, `make images`, `make deploy-core`.
- **검증.** `kubectl port-forward svc/api-gateway` 경유 로그인→/auth/me→스트리밍 모두 in-cluster 동작 확인.
  Phase 3/4의 "로컬 실행만" 이연 항목 해소.
- **시크릿 메모.** JWT_SECRET/DB URL은 아직 values.yaml 평문 → 운영 전 k8s Secret 전환(결정 대기 #3) 유효.

### 2026-06-19 — Phase 5 진행중 (코드 완료, 배포/검증 미완) — RESUME 지점
- **완료.** headroom-proxy Go 서비스(compress: text/json/code, safe/aggressive, invalid-json→text 폴백),
  단위 테스트 4 통과, go.work 등록, Makefile/Dockerfile, forgenta-core values/template/build-images.sh 갱신.
- **미완(재개 작업).**
  1. `make images` (또는 headroom 이미지만 build + `k3d image import ... -c forgenta`)
  2. `make deploy-core` → `kubectl rollout status deploy/headroom-proxy -n forgenta-core`
  3. verify: `kubectl port-forward svc/headroom-proxy 8787` 후 POST /v1/compress (safe vs aggressive ratio 비교),
     compress_complete 로그에 compression_ratio 확인.
- **현재 클러스터 상태.** forgenta-core에 api-gateway/identity-svc/orchestration-svc 3개 Running.
  headroom-proxy는 아직 미배포(코드만 커밋됨).
- **다음 단계.** Phase 5 마무리 → Phase 6(Catalog+Artifact) → Phase 7(Governance), 그 후 보고 (auto mode: Phase 7까지).
- **`.env.example` 미해결.** harness PreToolUse 훅이 `.env*` 쓰기를 차단 → 에이전트가 생성 불가. 사용자가 직접 생성 필요.

### 2026-06-19 — Phase 6 완료 (verify 통과)
- **Catalog-Svc.** Agent CRUD + clone(트랜잭션으로 복제 + clone_lineage 기록). App/PromptTemplate은 동일 패턴
  으로 확장 예정(미구현). 워크스페이스/유저는 게이트웨이가 주입하는 X-Workspace-Id/X-User-Id 헤더에서 읽음.
- **Artifact-Svc.** minio-go로 PutObject/GetObject, 시작 시 버킷 보장. content는 평문 저장(텍스트), 라운드트립 확인.
- **게이트웨이.** /api/catalog/ , /api/artifact/ 를 서브트리(트레일링 슬래시) 패턴으로 전체 메서드 프록시 + JWT 보호.
  **함정:** 게이트웨이 Deployment에 CATALOG_URL/ARTIFACT_URL env 누락 시 기본값 localhost로 502 → 템플릿에 추가함.
- **검증.** create→list→clone(Summarizer (copy), clone_lineage 1건)→artifact 저장→content 라운드트립 모두 통과.
- **현재 forgenta-core: 6개 서비스 in-cluster** (gateway/identity/orchestration/headroom/catalog/artifact).

### 2026-06-19 — Phase 7 완료 (verify 통과). auto-mode(Phase 7까지) 완료 지점
- **governance-svc.** /v1/usage(ingest)+/v1/usage/summary(events/prompt/completion/tokens_saved 집계),
  /v1/approvals(create/list/decide) 승인 큐, /v1/audit 감사 로그(승인 트랜잭션에서 기록).
- **게이트웨이.** /api/governance/ 서브트리 JWT 보호 프록시 + GOVERNANCE_URL env.
- **검증.** usage 2건→summary(prompt 200/completion 60/saved 200), 승인 create→approve→0 pending,
  audit(approval.requested + approval.approved) 통과.
- **크레딧 정책/MCP 계량.** PRD 항목이나 MVP에서는 usage 집계 + tokens_saved까지. 정책 적용은 후속.
- **현재 forgenta-core: 7개 서비스 전부 in-cluster** (gateway/identity/orchestration/headroom/catalog/artifact/governance).
- **남은 단계:** Phase 8(통합테스트) → 9(프론트엔드) → 10(관측+E2E). orchestration→headroom 연동은 Phase 8에서.

### 2026-06-19 — Phase 8 완료 (verify 통과)
- **서비스 간 배선.** orchestration이 요청 시 (1) headroom으로 프롬프트 압축(HEADROOM_ENABLED, 실패→무압축),
  (2) 스트림 완료 후 governance /v1/usage로 UsageEvent 기록(X-Workspace-Id/X-User-Id 헤더 전달, fault-tolerant).
  `app/integrations.py`에 compress/record_usage. orchestration deployment에 HEADROOM_PROXY_URL/GOVERNANCE_URL/HEADROOM_ENABLED env 추가.
- **통합 테스트.** `infra/scripts/integration-test.sh`(make integration-test): 게이트웨이 경유 login→/auth/me,
  stream 후 usage events +1, catalog create/get/delete, 무토큰 401. 6/6 통과.
- **검증.** usage_event에 original_tokens/compressed_tokens 채워짐(headroom 호출 확인). 짧은 프롬프트라 9→9(압축 0).
- **남은 단계:** Phase 9(프론트엔드 — 디자인 결정 필요) → Phase 10(관측 Loki/Prometheus/Grafana + E2E).

### 2026-06-19 — Phase 9 완료 (verify 통과)
- **선택.** Full dashboard + Component library(Mantine v7). React 18 + Vite 5 + TS, react-router v6.
- **구성.** web/: lib/api(REST+JWT), lib/stream(SSE-over-fetch, POST+헤더), stores/auth(localStorage),
  Layout(AppShell), pages/{Login,Dashboard,Catalog,Admin}, components/OutputPanel(Text/Raw/Events 탭).
- **5원칙 반영.** STREAM-FIRST(SSE 토큰), OUTPUT-CENTRIC(OutputPanel 탭), SEARCH-BEFORE-BUILD(카탈로그 검색),
  TRANSPARENCY(model/chain/tokens/latency 상태바 + Admin usage), PROGRESSIVE DISCLOSURE(라우팅 옵션 체크박스).
- **테스트.** vitest + RTL. jsdom에 matchMedia/ResizeObserver 폴리필 필요(Mantine) → src/test/setup.ts. 1 통과.
- **배포.** nginx 멀티스테이지(Vite build→nginx), nginx.conf가 / SPA fallback + /api→api-gateway.forgenta-core 프록시(SSE 위해 proxy_buffering off).
  forgenta-ui 차트로 배포. port-forward로 index/SPA fallback/JS/로그인(API 프록시) 검증.
- **남은 단계:** Phase 10(관측 Loki/Prometheus/Grafana + E2E 3플로우). 현재 8개 워크로드 in-cluster(7 core + web).

### 2026-06-19 — Phase 10 완료 (verify 통과). 전체 10단계 완료
- **버그 수정.** integration-test 플레이키: 로컬 8000을 Docker(com.docke)가 점유 → kubectl port-forward 경합으로
  로그인이 엉뚱한 리스너에 도달. 18080 포트 + /health 폴링 선행으로 수정. 전체 테스트(go/pytest/vitest) green.
- **E2E.** `infra/scripts/e2e-test.sh`(make e2e-test): 배포된 web(nginx)→게이트웨이 경유 3대 플로우 7/7 통과.
- **관측.** forgenta-obs: Loki(단일바이너리, tsdb/filesystem, ephemeral) + promtail(DaemonSet, /var/log/pods 정적 tail,
  RBAC 불요) + Grafana(anonymous Admin, Loki 데이터소스 프로비저닝). Loki 로그 인제스트 + Grafana health 확인.
- **관측 후속.** Prometheus 메트릭은 서비스 /metrics 계측 필요 → 미구현(로그 관측만 제공). OTel 트레이싱도 후속.
- **전체 클러스터.** forgenta-infra(PG/Redis/Qdrant/MinIO) + forgenta-core(7 서비스) + forgenta-ui(web) +
  forgenta-obs(loki/promtail/grafana). 헬퍼: make cluster-up/migrate/images/deploy-core/integration-test/e2e-test.

### 2026-06-19 — UI Ingress 노출
- **Traefik Ingress.** forgenta-ui 차트에 ingress.yaml 추가(catch-all, ingressClassName=traefik). k3d loadbalancer
  8080→80 → Traefik → web. http://localhost:8080 에서 port-forward 없이 접속(index/SPA/API 검증). host 비우면 catch-all.
- **main origin 푸시 완료** (9a58e33..8865b66, 이후 ingress 커밋 추가 푸시).

### 2026-06-20 — UI/UX: 멀티턴 채팅 + 스크롤
- **백엔드.** orchestration ChatRequest에 `messages: list[dict]` 추가(prompt와 하위호환). chat_stream은 messages
  우선 사용, 없으면 [{user, prompt}]. Headroom은 **최신 사용자 메시지만** 압축(대화 구조 유지). /v1/run은 prompt 유지.
- **프론트.** Dashboard를 멀티턴 채팅으로 재작성: messages 상태 누적, 전체 히스토리를 백엔드로 전송, ScrollArea
  viewportRef로 토큰마다 하단 auto-scroll, 하단 고정 입력(Enter 전송/Shift+Enter 줄바꿈). 단일출력용 OutputPanel.tsx
  제거하고 ChatMessage.tsx(user/assistant 버블 + 투명성 메타) 추가. lib/stream.streamChat(messages, routing)로 시그니처 변경.
- **검증.** 멀티턴 컨텍스트 회상("42") 확인, web/orchestration 재배포, e2e 7/7(단일 prompt 하위호환), web 빌드+테스트 통과.

### 2026-06-20 — 카탈로그 Agent와 채팅 연동
- **흐름.** Catalog 각 행에 Chat 버튼 → `/?agent=<id>`. Dashboard가 useSearchParams로 agent 로드(GET catalog),
  config.system_prompt를 매 요청 system 메시지로 prepend(화면 버블엔 미표시), config.routing을 라우팅 기본값으로 병합.
- **계량 귀속.** ChatRequest.agent_id 추가 → orchestration이 record_usage/§7 로그에 agent_id 포함 → usage_event.agent_id 채워짐.
- **카탈로그 생성 확장.** Agent 생성 시 시스템 프롬프트 입력(선택) → config.system_prompt 저장.
- **검증.** "ALL UPPERCASE" 시스템 프롬프트 Agent 생성→채팅→출력 대문자 확인, usage_event.agent_id 귀속 1건. e2e 회귀 OK 예상(단일 prompt 유지).
- **메모.** system 메시지는 messages[] role:system으로 전송(ollama 지원). 시스템 프롬프트는 화면 대화 버블에는 넣지 않고 payload에만 prepend.

## ★ RESUME SNAPSHOT (2026-06-20)
- **상태:** 전체 10단계 완료 + UI 확장. main = `70f4ae0`, origin/main과 동기(0/0). 워킹트리 clean.
- **클러스터(가동 중):** forgenta-infra(PG/Redis/Qdrant/MinIO) · forgenta-core(7: gateway/identity/orchestration/
  headroom/catalog/artifact/governance) · forgenta-ui(web) · forgenta-obs(loki/promtail×3/grafana). 전부 Running.
- **접속:** UI http://forgenta.localhost:8080 (Traefik ingress, host=forgenta.localhost). 로그인 admin@forgenta.local / forgenta.
  Grafana: `kubectl port-forward -n forgenta-obs svc/grafana 3000:3000`.
- **재기동(클러스터 내렸을 때):** `make cluster-up` → `make migrate` → `make images` → `make deploy-core`
  → `helm upgrade --install forgenta-ui infra/helm/forgenta-ui -n forgenta-ui`
  → `helm upgrade --install forgenta-obs infra/helm/forgenta-obs -n forgenta-obs`. 검증 `make integration-test`/`make e2e-test`.
- **UI 기능:** 멀티턴 채팅(auto-scroll) · Agent 피커 드롭다운 · Catalog Chat 버튼 · 시스템 프롬프트 Agent 생성 · 에이전트별 계량.
- **다음 후보(미결):** ① 피커의 테스트 데이터 정리(Shouty/e2e-src 등 8개 — 사용자 결정 대기) ② App/PromptTemplate
  카탈로그 엔드포인트+UI ③ Prometheus 메트릭(서비스 /metrics 계측) ④ 클라우드 LLM 실제 연동 ⑤ OIDC/SAML ⑥ k8s Secret 전환.
- **`.env.example`:** 여전히 미생성(내장 시크릿 가드). 사용자가 `!` heredoc로 생성 필요.

## ★ V3 PLANNING SNAPSHOT (2026-06-20) — Akai 벤치마킹: PRD v3 + 구현 플랜 (빌드 없음)
- **요청.** akai.run 분석 → 유사 기능을 Forgenta에 추가 → "PRD v3으로 업데이트", 빌드 금지.
- **Akai 핵심(파악).** "Show once" 운영 자동화: 자연어/시연으로 워크플로우 작성 → 단계 자동 매핑·커넥터 생성 →
  사람이 단계 검토/승인 → 다중 에이전트가 **공유 컨텍스트로 핸드오프**하며 종단 실행 → 실행할수록 학습.
  차별점: HITL, 커넥터(API 유무 무관), 감사/RBAC/자격증명 암호화, 이상탐지/실시간 알림.
- **산출물 1 — PRD v3.** `docs/prd/Forgenta PRD v3.md` 생성(git tracked, v2 상위호환). 신규 능력
  **Agentic Operations(코드네임 Workflow Fabric)**: ① NL/시연 워크플로우 작성 ② 공유 컨텍스트 핸드오프 런타임
  ③ 단계별 HITL 승인 ④ 커넥터 ⑤ 연속 학습+이상탐지. 실제 코드 매핑(orchestration router→executor, catalog 패턴,
  governance approval, usage_event, gateway stripProxy). 마이그레이션/엔드포인트/테이블/프론트/Phase 11~17/KPI 포함.
- **산출물 2 — 구현 플랜.** Warp 플랜 아티팩트 plan_id `e7a37d0d-68af-42b1-9434-8576305b7a99`.
  1차 범위 = PRD v3 §13 MVP(**Phase 11~14**): 000008 마이그레이션(workflow/workflow_run/workflow_step_run) ·
  신규 **workflow-svc**(Go, 포트 8006, catalog-svc 패턴) · orchestration `compiler.py`/`runtime.py` +
  `/v1/workflows/compile|run`·`/v1/runs/{id}/resume|cancel` SSE · governance approval 재사용
  (`resource_type='workflow_step_run'`) · gateway `/api/workflow/` 라우트 + go.work/Helm/build-images 배선 ·
  프론트 `/workflows`+`/runs`.
- **오케스트레이션 설정(검토 확정).** orchestration config = **local**, 자식 에이전트 **4개**(wf-svc/orch-ext/gov-ext/frontend),
  실행 순서 = **Foundation 순차 → 이후 병렬** → 단일 PR. 모델/하니스는 기본 상속.
  Foundation 내용: 000008 마이그레이션 + API/SSE 계약 + workflow-svc skeleton + gateway 라우트 + go.work/Helm/build 자리.
- **세션 진행(2026-06-20).** resume 후 사용자가 '플랜 먼저 수정' → '오케스트레이션' 영역 선택 → 3항목 모두 현재 설계와 동일로 **변경 없이 확정**.
  플랜 `## Launch config`에 확정 사실 명시(plan edit 완료). 그 외 섹션(범위/데이터모델/서비스설계/HITL)은 미변경.
- **상태.** 문서·플랜만 작성. **코드 변경/빌드 없음.** 기존 빌드 상태는 위 RESUME SNAPSHOT(전체 10단계 완료) 그대로 유효.
- **★ RESUME 지점.** 오케스트레이션 검토·확정 완료. 현재 **사용자 실행 go 신호 대기**(또는 다른 영역 수정 요청).
  실행 시: ① Foundation부터 실행 → ② `run_agents`로 4개 에이전트 fan-out(`plan_id` e7a37d0d 사용) →
  ③ `make images`/`make deploy-core` + integration/e2e 검증. 플랜 본문은 Warp 플랜(plan_id)에서 조회.

### 2026-06-20 — 피커 정리 + Admin 에이전트별 사용량 (별도 세션 작업)
- **피커 정리.** 테스트 에이전트 8개(Shouty/e2e-src*/Summarizer*/test) 삭제 후 실예시 3개 시드
  (요약가/번역가/코드리뷰어, config.system_prompt 포함). 런타임 데이터 변경(커밋 아님).
- **에이전트별 사용량.** governance에 `GET /v1/usage/by-agent` 추가(usage_event LEFT JOIN agent,
  agent_id 없음/삭제 → '(general)'). Admin 페이지에 "Usage by Agent" 테이블 추가. governance+web 재빌드/재배포.
- **검증.** by-agent: 코드리뷰어 1건 + (general) 16건. 피커 3개. web 빌드/테스트, go vet 통과.
- **주의.** 이 세션 작업은 위 'V3 PLANNING SNAPSHOT'(병렬 세션의 문서/플랜)와 독립. 그 스냅샷은 보존됨.

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
