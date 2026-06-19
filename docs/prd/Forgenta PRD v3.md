# Forgenta PRD v3.0
## Hybrid Agentic AI Platform — Agentic Operations (Workflow Fabric) 확장
Version: 3.0 | Status: DRAFT (문서 전용 · 빌드 미수행) | Date: 2026-06-19 | Author: CAIO/CTO | Runtime: MacOS + k3d
> 본 문서는 PRD v2.0(`docs/prd/Forgenta PRD v2.md`)을 상위 호환으로 계승·확장한다.
> v2의 제품 정의(§1), 시스템 아키텍처(§2), Multi-LLM 전략(§3)은 그대로 유효하며,
> v3는 그 위에 **Akai(by Deel) 스타일의 운영 자동화(Agentic Operations) 기능**을 추가한다.
> 구현/빌드는 본 PRD 범위가 아니다. 본 문서는 설계 합의를 위한 것이다.
# 0. 변경 개요 (What's New in v3)
v2는 단발성(single-shot) 에이전트와 카탈로그·거버넌스·계량을 완성했다(Phase 0~10 완료).
그러나 **여러 단계를 잇고, 여러 에이전트가 서로 핸드오프하며, 실행할수록 똑똑해지는** 운영 워크플로우는 없다.
v3는 이 공백을 메우는 단일 능력 묶음 **Forgenta Agentic Operations(코드네임: Workflow Fabric)** 를 도입한다.
핵심 추가 5종:
1. 자연어/시연 기반 **워크플로우 작성**(Describe-once / Record-once → 단계 자동 매핑).
2. 여러 에이전트가 **공유 컨텍스트로 핸드오프**하며 종단까지 실행되는 **워크플로우 런타임**.
3. 단계별 **휴먼-인-더-루프 승인**(review & approve every step).
4. API 유무와 무관하게 외부 시스템에 접속하는 **커넥터(Connectors)**.
5. 실행 결과를 축적해 **연속 개선(Continuous Improvement)** 하고 **이상 탐지·알림(Anomaly & Alerting)** 을 수행하는 학습 루프.
# 1. 배경 & 영감 — Akai 분석과 갭(Gap)
## 1.1 Akai(by Deel)는 어떻게 동작하는가
출처: https://www.akai.run/ (2026-05-06 게시). 운영팀(ops)을 위한 에이전트 플랫폼으로,
"Show it once. Watch it grow."를 슬로건으로 한다. 동작 3단계:
- STEP 1 — Show a workflow: 워크플로우를 한 번 시연하거나 평문으로 설명하면, 모든 단계를 매핑하고 시스템을 학습해 커넥터를 만들고 워크플로우를 자동 생성.
- STEP 2 — Review, approve, connect: 사람이 모든 단계를 검토·승인한 뒤에만 실행. 각 워크플로우를 서로 연결해 에이전트가 고립되지 않고 **하나의 시스템**으로 동작.
- STEP 3 — Run it, watch it improve: 필요한 만큼 에이전트를 배치, 각 에이전트가 종단까지 실행하며 서로 핸드오프하고 컨텍스트를 공유. 새 워크플로우가 늘수록 전체가 더 똑똑해짐.
차별점(요약): 개발자 없이 ops가 직접 기록/승인 · 실행할수록 누적 학습 · API 없는 시스템도 접근 · 감사 추적/자격증명 암호화/RBAC/휴먼-인-더-루프/실시간 알림 · 에이전트 상호 연결(컨텍스트 공유) · 이상치/예외/패턴 탐지.
대표 유스케이스: 결제 배치 처리, 결제 대사(reconciliation), 정산 리포트 생성, 세무/규제 준수, 물류/공급망.
## 1.2 Forgenta 현재 상태(v2)와 갭
이미 있는 것(재사용 자산):
- 단일 에이전트 카탈로그 + Clone/계보: `catalog-svc`(`services/catalog-svc/internal/server/server.go`), `clone_lineage` 테이블.
- LangGraph 오케스트레이션(router→executor) + Multi-LLM 폴백: `services/orchestration-svc/app/graph.py`, `app/router.py`.
- 승인 큐 + 감사 로그 + 사용량 계량: `governance-svc`(`approval`/`audit_log`/`usage_event` 하이퍼테이블).
- 컨텍스트 압축(`headroom-proxy`), 멀티모달 아티팩트 저장(`artifact-svc`/MinIO).
- 멀티턴 채팅 + 에이전트 귀속 계량: `orchestration-svc/app/main.py`(`/v1/chat/stream`).
없는 것(= v3가 채우는 갭):
- 다단계·다중 에이전트 **워크플로우** 도메인 자체가 없음(에이전트는 단발성).
- 자연어/시연 → 단계 매핑(**Planner/Compiler 노드는 v2에서 의도적으로 보류**: `context-notes.md` Phase 4 기록).
- 단계 간 **공유 컨텍스트 핸드오프** 런타임.
- **단계별** 승인(현재 `approval`은 일반 resource 단위, 실행 흐름과 미결합).
- 외부 시스템 **커넥터**(HTTP/MCP/브라우저) 및 자격증명 관리.
- 실행 누적 **학습 루프** 및 **이상 탐지/알림**.
# 2. v3 제품 확장 정의
## 2.1 한 줄 정의(확장)
Forgenta는 사용자의 입력을 해석해 결과를 만드는 것을 넘어, **반복 가능한 다단계 운영 워크플로우를 자연어/시연으로 작성하고, 여러 에이전트가 공유 컨텍스트로 핸드오프하며 사람이 승인한 단계에 따라 종단까지 실행하고, 실행할수록 학습·개선되는** 하이브리드 에이전틱 운영 자동화 플랫폼이다.
## 2.2 확장 코어 파이프라인
v2 파이프라인(입력→해석→실행→멀티모달 결과→카탈로그화→거버넌스)에 운영 루프를 덧댄다:
작성(Author: describe/record) → 컴파일(Compile: NL→Spec) → 검토·승인(Review/Approve) → 실행(Run: multi-agent handoff + shared context) → 결과/아티팩트(Output) → 계량·감사·이상탐지(Govern/Detect) → 학습(Learn) → (다음 실행 개선)
# 3. 핵심 개념 (New Domain Concepts)
v2 엔티티(agent/app/prompt_template/artifact/approval/audit_log/usage_event)는 유지. v3 신규:
- **Workflow**: 버전 관리되는 다단계 자동화 정의. 출처는 `described`(자연어) 또는 `recorded`(시연). 단계 DAG를 `spec`(JSONB)에 보관(에이전트의 `config` JSONB 패턴과 동일 철학).
- **Workflow Step**: 한 단계. `agent`/`prompt_template`/`connector`/`tool` 중 하나에 바인딩. 입력/출력 매핑, `requires_approval`, `on_error`(retry/skip/halt), 핸드오프 대상 정의.
- **Workflow Run**: 실행 인스턴스. 상태(pending/awaiting_approval/running/succeeded/failed/cancelled), 트리거(manual/scheduled/event), 공유 컨텍스트(blackboard), 요약.
- **Workflow Step Run**: 단계 실행 기록. 입력/출력(아티팩트 참조), 모델/토큰/지연, 오류, 승인 참조.
- **Connector**: 외부 시스템 접속 단위. 종류 `http_api`/`mcp`/`browser`/`db`. 비밀이 아닌 설정은 JSONB, 자격증명은 **secret 참조만** 저장("API 유무 무관 접근").
- **Workflow Schedule**: cron 식 반복 트리거(예: 정산 리포트 정기 생성).
- **Workflow Memory(Learning Store)**: 실행 결과·교정·성공 패턴 누적. Qdrant 임베딩과 결합해 차기 컴파일/실행에 RAG로 주입("실행할수록 똑똑해짐").
- **Alert / Anomaly**: 실행 중 탐지된 이상치/예외와 알림 규칙·이벤트.
# 4. Akai → Forgenta 기능 매핑
- Show once / describe in plain language → **Workflow Compiler(Planner 노드)**: NL(+선택적 녹화 단계) → `workflow.spec`. (`orchestration-svc` 확장)
- Maps steps, learns systems, builds connectors → 컴파일 시 단계 DAG 생성 + **Connector** 제안/바인딩.
- Review, approve every step → **단계별 HITL 승인**(`governance-svc` `approval` 확장: `resource_type='workflow_step_run'`).
- Connect workflows; agents as a system → 워크플로우 간 트리거/서브워크플로우 링크 + **공유 컨텍스트 핸드오프**.
- Run end-to-end, hand off, share context → **Workflow Runtime**(LangGraph 다중 노드 + blackboard). (`orchestration-svc` 확장)
- Gets smarter every run → **Workflow Memory + Qdrant RAG 학습 루프**.
- Any system, with/without API → **Connectors**(http_api/mcp/browser-Playwright/db).
- Compliance & security → 감사 로그 확장 + 커넥터 자격증명 암호화 + RBAC 스코프 + HITL + 알림.
- Catch everything (anomalies) → **Anomaly/Critic 노드 + Alert 규칙/이벤트**.
- Scale without headcount → 다중 런 동시성 + **Schedule** 기반 무인 실행.
# 5. 시스템 아키텍처 변경 (Architecture Delta v3)
## 5.1 신규 서비스
- **Workflow Service (`workflow-svc`, Go)** — `forgenta-core` 네임스페이스, 포트 8006(제안).
  - Workflow/Step(spec)·Connector·Schedule CRUD, Run/StepRun 기록 관리.
  - 기존 `catalog-svc` 패턴 그대로: `pgxpool`, 게이트웨이가 주입하는 `X-Workspace-Id`/`X-User-Id` 헤더 컨텍스트, `httperr`/`health`/`logging` 공유 모듈, distroless 멀티스테이지 이미지, `go.work` 등록.
  - 게이트웨이 서브트리 라우트 `/api/workflow/`(JWT 보호) 추가 — `catalog`/`artifact`/`governance`와 동일한 `stripProxy` 패턴(`services/api-gateway/cmd/main.go`).
## 5.2 Orchestration-Svc 확장 (핵심)
"에이전트가 핸드오프하며 컨텍스트를 공유"하는 두뇌. 현재 `router→executor`(`app/graph.py`)를 확장:
- **Planner/Compiler 노드**(v2 보류분 활성화): 자연어 설명 → 단계 DAG(`workflow.spec`). 단계별로 적합한 에이전트/프롬프트/커넥터를 제안. Qdrant에서 유사 워크플로우/과거 학습을 RAG로 회수.
- **Workflow Runtime**: 컴파일된 spec을 실행하는 LangGraph 그래프. 각 단계는 기존 `router`+`providers.stream` 재사용(에이전트 호출). 단계 간 **공유 컨텍스트(blackboard)** 전달 + 핸드오프 엣지. SSE로 단계/토큰/핸드오프/이상 이벤트 스트리밍(STREAM-FIRST).
- **Critic/Anomaly 노드**: 단계 출력 검증 + 이상치 플래그 → `governance` 알림. (편향 분리 위해 Critic은 클라우드 모델 우선, v2 §3.2 정책 계승)
- **Summarizer 노드**: 런 종료 시 요약 + 학습 메모 작성.
- **Connector Tool 노드**: MCP Gateway/HTTP/Playwright/DB 도구 실행. MCP는 v2 §2.3[3]에 이미 내장 명시. 도구 실패는 그래프 전체를 멈추지 않음(CLAUDE.md §8.3 fault-tolerant 계승).
- **학습 훅**: 런 종료 시 결과·교정을 `workflow_memory`와 Qdrant에 기록.
## 5.3 기존 서비스 확장
- **governance-svc**: ① `approval`을 단계 게이팅에 사용(`resource_type='workflow_step_run'`, 승인 시 런 resume). ② `alert`/`alert_rule` 인입·조회 추가. ③ 워크플로우 생애주기 감사(workflow.compiled/approved/run.started/step.approved 등).
- **identity-svc**: 커넥터 자격증명 암호화 정책, 워크플로우 작성/승인/실행 **RBAC 스코프**(author/approver/runner) 추가.
- **headroom-proxy**: 단계 간 누적되는 공유 컨텍스트를 압축(장기 실행 워크플로우 토큰 폭증 방지). 기존 `HEADROOM_ENABLED` 연동 확장.
- **artifact-svc**: 각 단계 산출물을 아티팩트로 저장, 런 최종 산출물(예: 정산 리포트) 생성/조회. 멀티모달 스펙 그대로 사용.
## 5.4 데이터 계층
신규 테이블은 `forgenta-infra`의 PostgreSQL(pgvector+TimescaleDB)에 추가. 학습 임베딩은 Qdrant. 런/스텝 시계열 집계는 기존 `usage_event` 하이퍼테이블과 연계.
# 6. 데이터 모델 (신규 마이그레이션 제안: 000008~)
v2 스키마(000001~000007)에 이어 신규 마이그레이션으로 추가(golang-migrate, in-cluster Job 패턴 유지).
- `workflow`: id, workspace_id(FK), name, description, spec JSONB(단계 DAG), source(`described`|`recorded`), status(`draft`|`active`|`archived`), version INT, created_by, created_at, updated_at.
- `workflow_step`(선택: spec 정규화 시): id, workflow_id(FK), seq, kind(`agent`|`prompt`|`connector`|`tool`), ref_id, io_map JSONB, requires_approval BOOL, on_error TEXT, handoff_to UUID.
  - 1차 구현은 `agent.config` JSONB 선례를 따라 단계를 `workflow.spec`에 임베드, 정규화 테이블은 후속 옵션으로 명시.
- `workflow_run`: id, workflow_id(FK), workspace_id, status, trigger(`manual`|`scheduled`|`event`), context JSONB(blackboard), summary TEXT, started_at, finished_at.
- `workflow_step_run`: id, run_id(FK), step_seq, kind, agent_id, status, input JSONB, output_artifact_id UUID, prompt_tokens, completion_tokens, latency_ms, error TEXT, approval_id UUID.
- `connector`: id, workspace_id(FK), kind(`http_api`|`mcp`|`browser`|`db`), name, config JSONB(비밀 제외), secret_ref TEXT(k8s Secret/외부 볼트 참조), status, created_by, created_at.
- `workflow_schedule`: id, workflow_id(FK), cron TEXT, timezone TEXT, enabled BOOL, next_run_at, created_by.
- `workflow_memory`: id, workflow_id(FK), run_id, kind(`success_pattern`|`correction`|`feedback`), content TEXT, embedding(pgvector 또는 Qdrant 참조), created_at.
- `alert_rule`: id, workspace_id, name, condition JSONB, severity, enabled. `alert`: id, workspace_id, run_id, rule_id, severity, message, status(`open`|`ack`|`resolved`), created_at.
인덱스/시계열: `workflow_run(workspace_id, started_at DESC)`, `workflow_step_run(run_id)`, `alert(workspace_id, created_at DESC)`. 보안: 커넥터 자격증명 평문 저장 금지 — `secret_ref`만(운영 전 k8s Secret 전환, `context-notes.md` 결정 대기 #3과 정합).
# 7. API 설계 (Gateway + 서비스 엔드포인트)
게이트웨이는 신규 서브트리 `/api/workflow/`를 JWT 보호로 추가(기존 `stripProxy` 패턴). 오케스트레이션은 신규 `/v1` 경로 추가.
워크플로우 서비스(`workflow-svc`, `catalog-svc` 라우트 스타일 계승):
```text
GET    /v1/workflows                 목록(워크스페이스 범위)
POST   /v1/workflows                 생성(draft)
GET    /v1/workflows/{id}            조회
PUT    /v1/workflows/{id}            수정(spec 포함)
DELETE /v1/workflows/{id}            삭제
POST   /v1/workflows/{id}/clone      복제(+clone_lineage, 카탈로그와 동일 계보)
GET    /v1/workflows/{id}/runs       런 목록
GET    /v1/runs/{run_id}             런 상세(스텝 타임라인)
GET    /v1/connectors | POST /v1/connectors | ...   커넥터 CRUD
POST   /v1/schedules | GET /v1/schedules            스케줄 CRUD
```
오케스트레이션(`orchestration-svc`, SSE):
```text
POST /api/orchestration/v1/workflows/compile      NL 설명(+녹화) → 초안 spec (SSE: plan/step 이벤트)
POST /api/orchestration/v1/workflows/{id}/run     런 시작 (SSE: step/token/handoff/anomaly/done)
POST /api/orchestration/v1/runs/{run_id}/resume   승인 후 재개
POST /api/orchestration/v1/runs/{run_id}/cancel   취소
```
거버넌스(`governance-svc`, 기존 승인 재사용 + 알림 신규):
```text
POST /v1/approvals  (resource_type='workflow_step_run')   단계 승인 요청
POST /v1/approvals/{id}/decide  {decision: approved|rejected}   기존 엔드포인트 재사용 → resume 트리거
POST /v1/alerts | GET /v1/alerts | POST /v1/alerts/{id}/ack    이상/알림
```
# 8. 워크플로우 실행 모델 (Runtime)
- **공유 컨텍스트(Blackboard)**: 런 단위 JSONB 컨텍스트를 단계 간 전달. 각 단계는 읽기/쓰기로 핸드오프. 누적 컨텍스트는 `headroom-proxy`로 압축 후 다음 단계 LLM에 투입.
- **핸드오프**: 단계 spec의 `handoff_to`/출력 매핑에 따라 다음 노드로 결과 전달. 동일 `router`/`providers` 재사용으로 단계별 Multi-LLM 라우팅·폴백 유지.
- **단계 승인 게이팅**: `requires_approval=true` 단계는 `awaiting_approval`로 정지 → `governance` 승인 큐 생성 → 승인 시 `/runs/{id}/resume`로 재개, 거부 시 `on_error` 정책 적용.
- **SSE 이벤트 타입**: `meta`(체인/계획), `step_start`, `token`, `handoff`, `step_done`, `approval_required`, `anomaly`, `fallback`, `done`. 기존 `_sse()` 헬퍼(`app/main.py`) 패턴 계승.
- **계량/감사**: 각 단계 종료 시 `usage_event` 기록(기존 `integrations.record_usage` 확장, `agent_id`에 더해 `run_id`/`step_seq` 귀속). 생애주기 이벤트는 `audit_log`.
- **내결함성**: 단계 실패 시 폴백 체인 → `on_error`(retry/skip/halt). 커넥터/도구 실패는 그래프 전체를 멈추지 않음(CLAUDE.md §8 계승).
# 9. 연속 학습 (Continuous Improvement)
"실행할수록 똑똑해진다"를 구체화:
- 런 종료 시 Summarizer가 결과·교정·성공 패턴을 `workflow_memory`에 적재하고 Qdrant에 임베딩.
- 차기 `compile`/`run`에서 Planner가 동일/유사 워크플로우의 과거 학습을 RAG로 회수해 단계·프롬프트·라우팅을 보정.
- 사용자가 단계 출력에 남긴 교정(승인 시 코멘트/수정)을 우선순위 높은 학습 신호로 반영.
- 지표화: 워크플로우별 성공률/평균 지연/토큰 절감 추세를 시간축으로 관측(Grafana, 기존 `forgenta-obs`).
# 10. 거버넌스 · 보안 · 컴플라이언스
- **휴먼-인-더-루프**: 단계 승인 + 런 시작 전 전체 plan 승인(STEP 2 "approve every step").
- **자격증명 암호화**: 커넥터 비밀은 `secret_ref`만 저장, 실제 값은 k8s Secret/외부 볼트. 로그/응답에 평문 비밀 금지(시스템 시크릿 처리 원칙).
- **RBAC 스코프**: author(작성)·approver(승인)·runner(실행) 분리, `identity-svc` 역할 확장.
- **감사 추적**: 컴파일/승인/실행/단계승인/커넥터 사용 전부 `audit_log`.
- **이상 탐지·알림**: Critic/Anomaly 노드 + `alert_rule`로 예외/이상치/패턴 감지, 실시간 알림.
- **데이터 경계**: 민감 데이터 단계는 v2 §3.3 정책에 따라 로컬 LLM ONLY 라우팅 강제(`RouteRequest.sensitive`).
# 11. 프론트엔드 (web) 변경
신규 네비/페이지(기존 Mantine AppShell + react-router 패턴, `web/src/components/Layout.tsx`/`App.tsx` 확장):
- **Workflows** (`/workflows`): 목록 + 빌더. 빌더는 "워크플로우를 설명하세요" 입력 → SSE로 단계 계획 스트리밍 → 단계 검토/편집/승인 → 저장. (선택)Record 모드는 시연 캡처 자리표시. SEARCH-BEFORE-BUILD: 기존 워크플로우 먼저 검색.
- **Runs** (`/runs`): 런 목록 + 런 상세(단계 타임라인, 핸드오프 그래프, 공유 컨텍스트 뷰, 단계 출력, 승인/거부 게이트, 이상/알림). STREAM-FIRST: 라이브 SSE.
- **Connectors** (`/connectors`): 커넥터 등록(HTTP/MCP/browser/db), 자격증명은 쓰기 전용(secret 참조).
- **Admin 확장**: 알림 인박스, 스케줄, 워크플로우 감사, 개선 지표(성공률·절감 시간 추세).
5대 원칙 적용은 §12 참조.
# 12. 5대 설계 원칙 적용 (v2 §1.3 계승)
- STREAM-FIRST: compile/run 모두 SSE로 단계·토큰·핸드오프 실시간 표시.
- OUTPUT-CENTRIC: 런 상세의 단계 출력/최종 아티팩트가 가장 넓은 영역, 멀티모달 탭 전환.
- SEARCH-BEFORE-BUILD: 새 워크플로우 전에 카탈로그/기존 워크플로우 검색·Clone 우선.
- TRANSPARENCY: 단계별 모델/토큰/지연/절감, 어떤 커넥터·승인자·이상치가 관여했는지 항상 노출.
- PROGRESSIVE DISCLOSURE: 기본은 "설명→실행", 단계 편집·라우팅·on_error 등 고급 설정은 필요 시 노출.
# 13. 단계별 도입 (Phasing) & MVP 슬라이스
기존 checklist Phase 0~10에 이어 Phase 11~로 확장(각 Phase는 verify 게이트, Loop Harness 계승). **빌드는 본 PRD 범위 밖**이며 아래는 합의용 순서다.
- Phase 11 — 데이터/서비스 골격: 신규 마이그레이션(000008~) + `workflow-svc` 스캐폴드 + 게이트웨이 `/api/workflow/` 라우트.
- Phase 12 — Compiler(수직 슬라이스 핵심): NL 설명 → `workflow.spec` 컴파일(SSE), 검토/저장.
- Phase 13 — Workflow Runtime: 공유 컨텍스트 핸드오프 + 다단계 순차 실행 + 단계 SSE + 런/스텝 영속화 + 최종 아티팩트.
- Phase 14 — 단계 승인(HITL): `awaiting_approval`/resume, 거버넌스 승인 큐 결합.
- Phase 15 — Connectors: HTTP/MCP 우선(Playwright 브라우저는 후속), 자격증명 secret 참조.
- Phase 16 — 학습 루프 + 이상탐지/알림: `workflow_memory`+Qdrant, alert 규칙.
- Phase 17 — 스케줄 + 무인 실행 + 프론트 Runs/Workflows/Connectors 페이지.
**MVP(권장 최소 슬라이스)**: Phase 11~14 — "설명→컴파일→검토/승인→다중 에이전트 순차 실행(공유 컨텍스트, SSE)→단계 승인→최종 아티팩트". 
**비목표(Non-goals, v3 초기)**: 브라우저 RPA 녹화/재생, 완전 자율 멀티에이전트 동시성, ML 기반 이상탐지 고도화, 워크플로우 마켓플레이스.
# 14. 성공 지표 (KPIs)
- 자동 처리된 런 수 / 절감 시간(시간/월) — Akai식 운영 가치 지표.
- 워크플로우 성공률 및 단계 1회 통과율(첫 시도 무재시도 비율).
- 휴먼-인-더-루프 개입률(승인 필요 단계 비중)과 그 추세(학습으로 감소).
- 토큰 절감률(`tokens_saved`, headroom) 및 단계당 평균 지연.
- 이상치 탐지 적중/오탐률, 알림 평균 대응 시간.
# 15. 미해결 결정 (Open Decisions)
- 단계 저장 방식: `workflow.spec` JSONB 임베드 vs `workflow_step` 정규화 테이블(1차는 JSONB 권장).
- 커넥터 자격증명 백엔드: k8s Secret vs 외부 볼트(v2 결정 대기 #3과 통합 결정 필요).
- Compiler/Runtime 모델: 플래너에 클라우드(고품질) 우선 vs 로컬 기본(비용/민감도) — v2 §3.3 정책 위에서 워크플로우별 오버라이드 허용 여부.
- 스케줄러 구현: in-cluster CronJob vs `workflow-svc` 내부 타이머.
- 브라우저 커넥터(Playwright) 격리/보안 모델(런타임 분리 필요).
# 16. 비고
- 본 문서는 **설계 전용**이며 코드/이미지 빌드를 수행하지 않는다("빌드는 하지 말고").
- 모델 표기는 v2 §3을 따른다(`ollama/qwen3:8b`, `claude-3-7-sonnet`, `gemini-2.5-pro` 등). 신규 서비스/엔드포인트/테이블 명칭은 제안이며 구현 단계에서 확정한다.
- v1.x 상세 산출물(ERD/와이어프레임/API 명세)은 `docs/prd/아카이브.zip` 참조. v3 정합성은 본 PRD + PRD v2 + `CLAUDE.md` 우선.
